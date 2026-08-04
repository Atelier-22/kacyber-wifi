const db = require('../db');
const config = require('../config');
const wifiVoucherApi = require('../wifiVoucherApi');

let cachedPackages = null;
let cachedPackagesAt = 0;
const PACKAGE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

function parsePrice(priceStr) {
  const clean = String(priceStr).replace(/[^\d]/g, '');
  return Number(clean) || 0;
}

function parseValidityToHours(validityStr) {
  const match = /(\d+)\s*(hour|day|week|month|hr|d|w|m)s?/i.exec(String(validityStr));
  if (!match) return 24; // Default fallback to 24 hours
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('h')) return value;
  if (unit.startsWith('d')) return value * 24;
  if (unit.startsWith('w')) return value * 24 * 7;
  if (unit.startsWith('m')) return value * 24 * 30;
  return value;
}

async function getAvailablePackages({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedPackages && (Date.now() - cachedPackagesAt < PACKAGE_CACHE_TTL)) {
    return { packages: cachedPackages, source: 'cache' };
  }

  try {
    const result = await wifiVoucherApi.getAvailableVouchers();
    if (!result || !Array.isArray(result.products)) {
      throw new Error('WiFi Voucher API response does not contain a products list');
    }

    const packages = result.products.map((prod) => ({
      id: prod.productCode, // Use productCode as the unique package ID
      label: prod.name,
      productCode: prod.productCode,
      durationHours: parseValidityToHours(prod.validity),
      price: parsePrice(prod.price),
      availableVouchers: prod.availableVouchers,
      status: prod.status
    }));

    cachedPackages = packages;
    cachedPackagesAt = Date.now();
    return { packages, source: 'live' };
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error('Unable to refresh KaCyber WiFi packages; using local cache/fallback', details);
    if (cachedPackages) {
      return { packages: cachedPackages, source: 'stale_cache' };
    }
    // Dynamic fallback structure matching production products but as local backup
    const fallbacks = [
      { id: 'WIFI_3H', label: '3 Hour Pass', productCode: 'WIFI_3H', durationHours: 3, price: 1000 },
      { id: 'WIFI_16H', label: '16 Hour Pass', productCode: 'WIFI_16H', durationHours: 16, price: 1500 },
      { id: 'WIFI_30D', label: '30 Day Pass', productCode: 'WIFI_30D', durationHours: 744, price: 28000 }
    ];
    return { packages: fallbacks, source: 'fallback' };
  }
}

async function getPackageById(id) {
  const { packages } = await getAvailablePackages();
  return packages.find((p) => p.id === id);
}

function splitVoucherCode(code) {
  const parts = String(code).split('-');
  if (parts.length === 2) {
    return { username: parts[0], password: parts[1] };
  }
  return { username: code, password: code };
}

async function issueVoucher(phoneNumber, packageInfo, meta = {}) {
  const externalReferenceID = meta.transactionId;
  if (!externalReferenceID) {
    throw new Error('Transaction ID is required to retrieve a WiFi voucher');
  }

  try {
    const result = await wifiVoucherApi.getPurchaseStatus(externalReferenceID);
    if (!result || !result.voucher) {
      throw new Error(`WiFi Voucher API purchase status response is missing voucher code for transaction ${externalReferenceID}. Status: ${result ? result.status : 'unknown'}`);
    }

    const { username, password } = splitVoucherCode(result.voucher);

    return {
      username,
      password,
      code: result.voucher,
      phoneNumber,
      packageId: packageInfo.id,
      issuedAt: Date.now(),
      expiresAt: Date.now() + packageInfo.durationHours * 60 * 60 * 1000
    };
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error(`Failed to retrieve WiFi voucher status for transaction ${externalReferenceID}`, details);
    throw error;
  }
}

async function getActiveVoucher(phoneNumber) {
  const row = db.prepare(`
    SELECT * FROM transactions
    WHERE phone_number = ? AND status = 'SUCCESS' AND voucher_code IS NOT NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(phoneNumber, Date.now());

  if (!row) {
    return null;
  }

  const { username, password } = splitVoucherCode(row.voucher_code);

  return {
    username,
    password,
    code: row.voucher_code,
    phoneNumber: row.phone_number,
    packageId: row.package_id,
    issuedAt: row.created_at,
    expiresAt: row.expires_at
  };
}

module.exports = {
  getAvailablePackages,
  getPackageById,
  issueVoucher,
  getActiveVoucher,
  splitVoucherCode
};
