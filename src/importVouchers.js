
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const db = require('./db');
const config = require('./config');

function readZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath);
  const eocd = buffer.lastIndexOf(Buffer.from('PK\x05\x06'));
  if (eocd < 0) throw new Error('The voucher file is not a valid XLSX/ZIP file.');
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  let offset = centralDirectoryOffset;

  while (buffer.readUInt32LE(offset) === 0x02014b50) {
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, compression === 0 ? compressed : zlib.inflateRawSync(compressed));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function sharedStrings(xml) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(''))
  );
}

function worksheetRows(xml, strings) {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const values = {};
    for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = /r="([A-Z]+)/.exec(cell[1]);
      const value = /<v>([\s\S]*?)<\/v>/.exec(cell[2]);
      if (!ref || !value) continue;
      values[ref[1]] = /t="s"/.test(cell[1]) ? strings[Number(value[1])] : decodeXml(value[1]);
    }
    return values;
  });
}

function durationToHours(value) {
  const match = /^(\d+)\s*([hd])$/i.exec(String(value || '').trim());
  if (!match) throw new Error(`Unsupported voucher validity "${value}".`);
  return Number(match[1]) * (match[2].toLowerCase() === 'd' ? 24 : 1);
}

function packageForDuration(hours) {
  const packages = Array.isArray(config.packages) ? config.packages : [];
  const packageInfo = packages.find((pkg) => pkg.durationHours === hours);
  if (!packageInfo) return { id: `WIFI_${hours}H` };
  return packageInfo;
}

function importVouchers(filePath) {
  const entries = readZipEntries(filePath);
  const strings = sharedStrings(entries.get('xl/sharedStrings.xml').toString('utf8'));
  const vouchers = [];

  // Sheets 2, 3 and 6 are the populated 3h, 16h and 30d voucher tabs.
  for (const sheetNumber of [2, 3, 6]) {
    const xml = entries.get(`xl/worksheets/sheet${sheetNumber}.xml`);
    if (!xml) throw new Error(`Missing worksheet ${sheetNumber} in voucher workbook.`);
    for (const row of worksheetRows(xml.toString('utf8'), strings).slice(1)) {
      if (!row.B || !row.C) continue;
      const [username, password] = row.B.trim().split('-');
      const hours = durationToHours(row.C);
      if (!username || !password) throw new Error(`Invalid voucher code "${row.B}".`);
      vouchers.push({ voucherCode: row.B.trim(), username, password, packageId: packageForDuration(hours).id, hours });
    }
  }

  const importedAt = Date.now();
  const insert = db.prepare(`
    INSERT INTO voucher_inventory (
      voucher_code, username, password, package_id, validity_hours, merchant_id, source, status, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'unifi_vouchers.xlsx', 'AVAILABLE', ?)
    ON CONFLICT(voucher_code) DO NOTHING
  `);
  let inserted = 0;
  db.withTransaction(() => {
    for (const voucher of vouchers) {
      const result = insert.run(voucher.voucherCode, voucher.username, voucher.password, voucher.packageId, voucher.hours, config.wifiVoucherApi.merchantId, importedAt);
      inserted += Number(result.changes);
    }
  });
  return { found: vouchers.length, inserted, skipped: vouchers.length - inserted };
}

if (require.main === module) {
  const filePath = path.resolve(process.argv[2] || path.join(__dirname, 'unifi_vouchers.xlsx'));
  const result = importVouchers(filePath);
  console.log(`Voucher import complete: ${result.inserted} added, ${result.skipped} already present (${result.found} found).`);
}

module.exports = { importVouchers };
