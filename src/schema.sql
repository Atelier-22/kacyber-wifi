CREATE TABLE IF NOT EXISTS transactions (
  transaction_id TEXT PRIMARY KEY,
  customer_name TEXT,
  phone_number TEXT NOT NULL,
  recipient_phone_number TEXT,
  product_type TEXT,
  data_quantity REAL,
  data_unit TEXT,
  data_validity TEXT,
  data_network TEXT,
  network TEXT NOT NULL,
  method TEXT NOT NULL,
  package_id TEXT,
  package_label TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  voucher_code TEXT,
  voucher_status TEXT,
  reference TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  device TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE TABLE IF NOT EXISTS vouchers (
  phone_number TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  package_id TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Voucher stock imported from src/unifi_vouchers.xlsx.  Unlike the legacy
-- `vouchers` table above, this keeps every voucher and its assignment history.
CREATE TABLE IF NOT EXISTS voucher_inventory (
  voucher_code TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  package_id TEXT NOT NULL,
  validity_hours INTEGER NOT NULL,
  merchant_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'USED', 'EXPIRED')),
  assigned_phone_number TEXT,
  assigned_transaction_id TEXT UNIQUE,
  imported_at INTEGER NOT NULL,
  assigned_at INTEGER,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_voucher_inventory_available
  ON voucher_inventory(package_id, status, imported_at);
CREATE INDEX IF NOT EXISTS idx_voucher_inventory_phone
  ON voucher_inventory(assigned_phone_number, status, expires_at);
