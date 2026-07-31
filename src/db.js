const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'data', 'app.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

function addColumnIfMissing(table, column, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    if (!/duplicate column name/i.test(error.message)) {
      throw error;
    }
  }
}

addColumnIfMissing('transactions', 'whatsapp_user_id', 'TEXT');
addColumnIfMissing('transactions', 'recipient_phone_number', 'TEXT');
addColumnIfMissing('transactions', 'product_type', 'TEXT');
addColumnIfMissing('transactions', 'data_quantity', 'REAL');
addColumnIfMissing('transactions', 'data_unit', 'TEXT');
addColumnIfMissing('transactions', 'data_validity', 'TEXT');
addColumnIfMissing('transactions', 'data_network', 'TEXT');
addColumnIfMissing('transactions', 'delivery_reference', 'TEXT');
addColumnIfMissing('transactions', 'delivery_status', 'TEXT');

// node:sqlite's synchronous API does not provide the transaction helper used
// by better-sqlite3. Keep transactions explicit and reusable for stock changes.
db.withTransaction = (work) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

module.exports = db;
