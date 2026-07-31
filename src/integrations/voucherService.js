const db = require('../db');
const config = require('../config');

async function issueVoucher(phoneNumber, packageInfo, meta = {}) {
  const now = Date.now();
  const expiresAt = now + packageInfo.durationHours * 60 * 60 * 1000;
  const allocate = () => db.withTransaction(() => {
    if (meta.transactionId) {
      const existing = db.prepare('SELECT * FROM voucher_inventory WHERE assigned_transaction_id = ?').get(meta.transactionId);
      if (existing) return existing;
    }
    const row = db.prepare(`
      SELECT * FROM voucher_inventory
      WHERE package_id = ? AND status = 'AVAILABLE'
      ORDER BY imported_at, voucher_code LIMIT 1
    `).get(packageInfo.id);
    if (!row) return null;
    db.prepare(`
      UPDATE voucher_inventory
      SET status = 'ASSIGNED', assigned_phone_number = ?, assigned_transaction_id = ?,
          assigned_at = ?, expires_at = ?, merchant_id = COALESCE(merchant_id, ?)
      WHERE voucher_code = ? AND status = 'AVAILABLE'
    `).run(phoneNumber, meta.transactionId || null, now, expiresAt, config.wifiVoucherApi.merchantId, row.voucher_code);
    return db.prepare('SELECT * FROM voucher_inventory WHERE voucher_code = ?').get(row.voucher_code);
  });

  const row = allocate();
  if (!row) {
    throw new Error(`No available ${packageInfo.label} vouchers remain in the database.`);
  }
  return rowToVoucher(row);
}

async function getActiveVoucher(phoneNumber) {
  db.prepare("UPDATE voucher_inventory SET status = 'EXPIRED' WHERE status = 'ASSIGNED' AND expires_at <= ?").run(Date.now());
  const row = db.prepare(`
    SELECT * FROM voucher_inventory
    WHERE assigned_phone_number = ? AND status = 'ASSIGNED' AND expires_at > ?
    ORDER BY assigned_at DESC LIMIT 1
  `).get(phoneNumber, Date.now());
  if (!row) {
    return null;
  }
  if (row.expires_at < Date.now()) {
    return null;
  }
  return rowToVoucher(row);
}

function rowToVoucher(row) {
  return {
    username: row.username,
    password: row.password,
    code: row.voucher_code,
    phoneNumber: row.assigned_phone_number,
    packageId: row.package_id,
    merchantId: row.merchant_id,
    issuedAt: row.assigned_at,
    expiresAt: row.expires_at
  };
}

module.exports = {
  issueVoucher,
  getActiveVoucher
};
