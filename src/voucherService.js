const db = require('../db');
const wifiVoucherApi = require('./providers/wifiVoucherApi');

function generateCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function splitVoucherCode(code) {
  const parts = String(code).split('-');
  if (parts.length === 2) {
    return { username: parts[0], password: parts[1] };
  }
  return { username: code, password: code };
}

function generateFallbackCode() {
  return `${generateCode(5)}-${generateCode(5)}`;
}

async function issueVoucher(phoneNumber, packageInfo, meta = {}) {
  const externalReferenceID = meta.transactionId || `TX-${Date.now()}`;
  let voucherCode;

  try {
    const result = await wifiVoucherApi.issueVoucher({
      externalReferenceID,
      productCode: packageInfo.productCode,
      msisdn: phoneNumber,
      payment: {
        status: 'PAID',
        reference: meta.paymentReference || externalReferenceID,
        amount: packageInfo.price,
        currency: 'UGX'
      }
    });
    voucherCode = result.voucher;
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error(
      `WiFi Voucher API issue failed for ${externalReferenceID} (product ${packageInfo.productCode}) — falling back to a locally generated code. Reconcile this manually.`,
      details
    );
    voucherCode = generateFallbackCode();
  }

  const { username, password } = splitVoucherCode(voucherCode);

  const voucher = {
    username,
    password,
    code: voucherCode,
    phoneNumber,
    packageId: packageInfo.id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + packageInfo.durationHours * 60 * 60 * 1000
  };

  db.prepare(`
    INSERT INTO vouchers (phone_number, username, password, package_id, issued_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone_number) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      package_id = excluded.package_id,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at
  `).run(phoneNumber, voucher.username, voucher.password, voucher.packageId, voucher.issuedAt, voucher.expiresAt);

  return voucher;
}

async function getActiveVoucher(phoneNumber) {
  const row = db.prepare('SELECT * FROM vouchers WHERE phone_number = ?').get(phoneNumber);
  if (!row) {
    return null;
  }
  if (row.expires_at < Date.now()) {
    return null;
  }
  return {
    username: row.username,
    password: row.password,
    phoneNumber: row.phone_number,
    packageId: row.package_id,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at
  };
}

module.exports = {
  issueVoucher,
  getActiveVoucher
};
