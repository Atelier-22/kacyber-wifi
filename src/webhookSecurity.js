const crypto = require('crypto');
const config = require('./config');

// ── Captures the raw request body so we can verify its signature ──
// Pass this as the `verify` option to express.json().
function captureRawBody(req, res, buf) {
  req.rawBody = buf;
}

// ── Confirms a webhook POST really came from Meta ───────────────
// Meta signs the raw body with the app secret and sends it as
// X-Hub-Signature-256: sha256=<hex digest>.
function isValidSignature(req) {
  const appSecret = config.whatsapp.appSecret;

  if (!appSecret) {
    console.warn('WHATSAPP_APP_SECRET not set — skipping webhook signature check (dev mode only)');
    return true;
  }

  const signatureHeader = req.get('X-Hub-Signature-256');
  if (!signatureHeader || !req.rawBody) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

module.exports = {
  captureRawBody,
  isValidSignature
};
