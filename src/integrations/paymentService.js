const db = require('../db');
const config = require('../config');
const kacyberPay = require('./providers/kacyberPay');
const wifiVoucherApi = require('../wifiVoucherApi');

let counter = getHighestCounter();

function getHighestCounter() {
  const row = db.prepare('SELECT transaction_id FROM transactions ORDER BY created_at DESC LIMIT 1').get();
  if (!row || !row.transaction_id) return 1;
  const match = row.transaction_id.match(/\d+$/);
  return match ? Number(match[0]) : 1;
}

function nextTransactionId() {
  counter += 1;
  const timePart = Date.now().toString().slice(-6);
  const countPart = String(counter % 1000).padStart(3, '0');
  return `WF${timePart}${countPart}`;
}

function methodForNetwork(network) {
  if (network === 'MTN') return 'MTN Mobile Money';
  if (network === 'Airtel') return 'Airtel Money';
  return 'Mobile Money';
}

// ── KaCyberPay expects 'MTN' or 'AIRTEL' — maps our internal network name ──
function apiNetworkFor(network) {
  if (network === 'MTN') return 'MTN';
  if (network === 'Airtel') return 'AIRTEL';
  return null;
}

function buildReference(network) {
  const prefix = network === 'MTN' ? 'MM' : network === 'Airtel' ? 'AM' : 'RF';
  return `${prefix}${Math.floor(100000000 + Math.random() * 900000000)}`;
}

function rowToTransaction(row) {
  if (!row) return null;
  return {
    transactionId: row.transaction_id,
    customerName: row.customer_name,
    phoneNumber: row.phone_number,
    recipientPhoneNumber: row.recipient_phone_number,
    productType: row.product_type,
    dataQuantity: row.data_quantity,
    dataUnit: row.data_unit,
    dataValidity: row.data_validity,
    dataNetwork: row.data_network,
    whatsappUserId: row.whatsapp_user_id,
    network: row.network,
    method: row.method,
    packageId: row.package_id,
    packageLabel: row.package_label,
    amount: row.amount,
    status: row.status,
    voucherCode: row.voucher_code,
    voucherStatus: row.voucher_status,
    reference: row.reference,
    deliveryReference: row.delivery_reference,
    deliveryStatus: row.delivery_status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    device: row.device
  };
}

async function initiatePayment(phoneNumber, amount, meta = {}) {
  const transactionId = nextTransactionId();
  const network = meta.network || 'Unknown';

  db.prepare(`
    INSERT INTO transactions (
      transaction_id, customer_name, phone_number, recipient_phone_number, product_type,
      data_quantity, data_unit, data_validity, data_network, whatsapp_user_id, network, method,
      package_id, package_label, amount, status, voucher_code,
      voucher_status, reference, created_at, expires_at, device
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, NULL, 'WhatsApp')
  `).run(
    transactionId,
    meta.customerName || null,
    phoneNumber,
    meta.recipientPhoneNumber || null,
    meta.productType || null,
    meta.dataBundle ? meta.dataBundle.quantity : null,
    meta.dataBundle ? meta.dataBundle.unit : null,
    meta.dataBundle ? meta.dataBundle.validity : null,
    meta.dataBundle ? meta.dataBundle.network : null,
    meta.userId || null,
    network,
    methodForNetwork(network),
    meta.packageId || null,
    meta.packageLabel || null,
    amount,
    Date.now()
  );

  const apiNetwork = apiNetworkFor(network);

  if (!apiNetwork) {
    console.warn(`Unknown network for ${phoneNumber} — skipping KaCyberPay request, marking FAILED`);
    db.prepare('UPDATE transactions SET status = ? WHERE transaction_id = ?').run('FAILED', transactionId);
    return { transactionId, status: 'FAILED' };
  }

  try {
    let result;
    if (meta.productType === 'voucher') {
      const pkg = Array.isArray(config.packages) ? config.packages.find((p) => p.id === meta.packageId) : null;
      const productCode = pkg ? pkg.productCode : (meta.packageId || 'WIFI_3H');
      result = await wifiVoucherApi.purchaseVoucher({
        externalReferenceID: transactionId,
        productCode,
        msisdn: phoneNumber,
        network: apiNetwork,
        customerName: meta.customerName || 'KaCyber Customer'
      });
    } else {
      result = await kacyberPay.initiateCollection({
        externalReferenceID: transactionId,
        customerName: meta.customerName || 'KaCyber Customer',
        narration: meta.packageLabel || 'WiFi Voucher Purchase',
        amount,
        msisdn: phoneNumber,
        network: apiNetwork
      });
    }

    db.prepare('UPDATE transactions SET reference = ? WHERE transaction_id = ?').run(
      result.kacyberReference,
      transactionId
    );
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error('KaCyberPay collection request failed', details);
    db.prepare('UPDATE transactions SET status = ? WHERE transaction_id = ?').run('FAILED', transactionId);
    return { transactionId, status: 'FAILED' };
  }

  return { transactionId, status: 'PENDING' };
}

async function getPaymentStatus(transactionId) {
  const row = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId);
  if (!row) {
    return { status: 'NOT_FOUND' };
  }

  if (row.status === 'PENDING' && row.product_type === 'voucher') {
    try {
      const res = await wifiVoucherApi.getPurchaseStatus(transactionId);
      const isPaid = res && (
        String(res.paymentStatus).toUpperCase() === 'PAID' ||
        String(res.status).toLowerCase() === 'completed' ||
        (res.voucher && String(res.success) === 'true')
      );

      if (isPaid) {
        markPaymentStatus(transactionId, 'SUCCESS');
        if (res.voucher) {
          const voucherService = require('./voucherService');
          const { username, password } = voucherService.splitVoucherCode(res.voucher);
          attachVoucher(transactionId, { username, password, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        }
        return { status: 'SUCCESS', phoneNumber: row.phone_number, amount: row.amount };
      } else if (String(res.status).toLowerCase() === 'failed' || String(res.paymentStatus).toUpperCase() === 'FAILED') {
        markPaymentStatus(transactionId, 'FAILED');
        return { status: 'FAILED', phoneNumber: row.phone_number, amount: row.amount };
      }
    } catch (err) {
      console.warn(`Could not check KaCyber voucher purchase status for ${transactionId}:`, err.message);
    }
  }

  return { status: row.status, phoneNumber: row.phone_number, amount: row.amount };
}

function markPaymentStatus(transactionId, status) {
  const existing = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId);
  if (!existing) {
    return null;
  }

  let reference = existing.reference;
  if ((status === 'SUCCESS' || status === 'REFUNDED') && !reference) {
    reference = buildReference(existing.network);
  }

  db.prepare('UPDATE transactions SET status = ?, reference = ? WHERE transaction_id = ?').run(status, reference, transactionId);

  return rowToTransaction(db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId));
}

function attachVoucher(transactionId, voucher) {
  const existing = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId);
  if (!existing) {
    return null;
  }

  const voucherCode = `${voucher.username}-${voucher.password}`;

  db.prepare('UPDATE transactions SET voucher_code = ?, voucher_status = ?, expires_at = ? WHERE transaction_id = ?').run(
    voucherCode,
    'Unused',
    voucher.expiresAt,
    transactionId
  );

  return rowToTransaction(db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId));
}

// ── Records that an airtime/data request was accepted by KaCyber for processing ──
// (not yet confirmed delivered — see integrations/airtimeDataService.js).
// kacyberReference is what their async result callback will identify the transaction by.
function setDeliveryReference(transactionId, { reference, status }) {
  const existing = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId);
  if (!existing) {
    return null;
  }
  db.prepare('UPDATE transactions SET delivery_reference = ?, delivery_status = ? WHERE transaction_id = ?').run(
    reference || null,
    status || null,
    transactionId
  );
  return rowToTransaction(db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId));
}

// ── Looks up a transaction by the reference KaCyber's delivery callback identifies it by ──
function getTransactionByDeliveryReference(reference) {
  const row = db.prepare('SELECT * FROM transactions WHERE delivery_reference = ?').get(reference);
  return rowToTransaction(row);
}

// ── Looks up a transaction by the reference KaCyberPay assigned ────
// Useful if their status callback identifies the payment by
// kacyberReference rather than by our own externalReferenceID.
function getTransactionByReference(reference) {
  const row = db.prepare('SELECT * FROM transactions WHERE reference = ?').get(reference);
  return rowToTransaction(row);
}

function getAllTransactions() {
  const rows = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all();
  return rows.map(rowToTransaction);
}

function getTransactionById(transactionId) {
  const row = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transactionId);
  return rowToTransaction(row);
}

function randomPhoneNumber() {
  const mtn = ['77', '78', '76'];
  const airtel = ['70', '74', '75'];
  const all = [...mtn, ...airtel];
  const prefix = all[Math.floor(Math.random() * all.length)];
  const rest = String(Math.floor(1000000 + Math.random() * 8999999));
  return `256${prefix}${rest}`;
}

function randomPastTimestamp(daysBack) {
  const now = Date.now();
  const past = now - Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return Math.floor(past);
}

function detectNetworkLocal(phoneNumber) {
  const local = phoneNumber.startsWith('256') ? phoneNumber.slice(3) : phoneNumber;
  const prefix = local.slice(0, 2);
  const mtnPrefixes = ['77', '78', '76', '39'];
  const airtelPrefixes = ['70', '74', '75', '20', '25'];
  if (mtnPrefixes.includes(prefix)) return 'MTN';
  if (airtelPrefixes.includes(prefix)) return 'Airtel';
  return 'Unknown';
}

function seedMockTransactions(count) {
  const existingCount = db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count;
  if (existingCount > 0) {
    return;
  }

  const statusPool = [
    ...Array(70).fill('SUCCESS'),
    ...Array(15).fill('PENDING'),
    ...Array(10).fill('FAILED'),
    ...Array(5).fill('REFUNDED')
  ];

  const insert = db.prepare(`
    INSERT INTO transactions (
      transaction_id, customer_name, phone_number, network, method,
      package_id, package_label, amount, status, voucher_code,
      voucher_status, reference, created_at, expires_at, device
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WhatsApp')
  `);

  const insertMany = (rows) => db.withTransaction(() => {
    for (const row of rows) insert.run(...row);
  });

  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const transactionId = nextTransactionId();
    const pkg = config.packages[Math.floor(Math.random() * config.packages.length)];
    const phoneNumber = randomPhoneNumber();
    const network = detectNetworkLocal(phoneNumber);
    const status = statusPool[Math.floor(Math.random() * statusPool.length)];
    const createdAt = randomPastTimestamp(14);

    let voucherCode = null;
    let voucherStatus = null;
    let reference = null;
    let expiresAt = null;

    if (status === 'SUCCESS' || status === 'REFUNDED') {
      reference = buildReference(network);
      const codeA = Math.random().toString(36).slice(2, 6).toUpperCase();
      const codeB = Math.random().toString(36).slice(2, 6).toUpperCase();
      const codeC = Math.random().toString(36).slice(2, 6).toUpperCase();
      voucherCode = `${codeA}-${codeB}-${codeC}`;
      voucherStatus = Math.random() > 0.4 ? 'Used' : 'Unused';
      expiresAt = createdAt + pkg.durationHours * 60 * 60 * 1000;
    }

    rows.push([
      transactionId,
      phoneNumber,
      network,
      methodForNetwork(network),
      pkg.id,
      pkg.label,
      pkg.price,
      status,
      voucherCode,
      voucherStatus,
      reference,
      createdAt,
      expiresAt
    ]);
  }

  insertMany(rows);
}

module.exports = {
  initiatePayment,
  getPaymentStatus,
  markPaymentStatus,
  attachVoucher,
  setDeliveryReference,
  getTransactionByDeliveryReference,
  getTransactionByReference,
  getAllTransactions,
  getTransactionById,
  seedMockTransactions
};
