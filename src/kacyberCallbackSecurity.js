const crypto = require('crypto');
const config = require('./config');

function isValidSignature(req) {
  const secret = config.kacyberPay.callbackSecret;

  if (!secret) {
    console.warn('KACYBER_CALLBACK_SECRET not set — skipping KaCyber delivery callback signature check (dev mode only)');
    return true;
  }

  const signatureHeader = req.get('X-KaCyber-Signature');
  if (!signatureHeader || !req.rawBody) {
    return false;
  }

  const expectedHex = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  const expectedBase64 = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('base64');

  const cleanHeader = String(signatureHeader).trim();

  if (cleanHeader.toLowerCase() === expectedHex.toLowerCase() || cleanHeader === expectedBase64) {
    return true;
  }

  console.warn(`KaCyber signature mismatch. Received: "${cleanHeader}", Expected (hex): "${expectedHex}", Expected (base64): "${expectedBase64}"`);
  return false;
}

module.exports = { isValidSignature };
