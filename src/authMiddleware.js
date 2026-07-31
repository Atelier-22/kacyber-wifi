const crypto = require('crypto');
const config = require('./config');

function requireAdminAuth(req, res, next) {
  const { username, password } = config.admin;

  if (!username || !password) {
    console.warn('ADMIN_USERNAME / ADMIN_PASSWORD not set — admin routes are unprotected');
    return next();
  }

  const header = req.get('Authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    const suppliedUser = decoded.slice(0, separatorIndex);
    const suppliedPass = decoded.slice(separatorIndex + 1);

    if (safeCompare(suppliedUser, username) && safeCompare(suppliedPass, password)) {
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Voucher Ops Console"');
  return res.status(401).send('Authentication required');
}

function safeCompare(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

module.exports = {
  requireAdminAuth
};
