
const config = require('./config');
const validators = require('./validators');
const kacyberPay = require('./integrations/providers/kacyberPay');

async function main() {
  const rawPhone = process.argv[2];
  const amount = Number(process.argv[3] || 1000);

  if (!rawPhone) {
    console.error('Usage: node testKacyberPayment.js <phone> [amount]');
    process.exit(1);
  }

  console.log('--- Config being used ---');
  console.log('KACYBERPAY_APP_ID set:', Boolean(config.kacyberPay.appId), '| value:', config.kacyberPay.appId);
  console.log('KACYBERPAY_API_KEY set:', Boolean(config.kacyberPay.apiKey), '| first 12 chars:', String(config.kacyberPay.apiKey || '').slice(0, 12));

  const phoneNumber = validators.normalizePhoneNumber(rawPhone);
  if (!phoneNumber) {
    console.error(`"${rawPhone}" did not normalize to a valid phone number. Stopping here — this alone would explain nothing happening.`);
    process.exit(1);
  }

  const network = validators.detectNetwork(phoneNumber);
  console.log('--- Number check ---');
  console.log('Input:', rawPhone, '-> Normalized:', phoneNumber, '-> Detected network:', network);

  if (network === 'Unknown') {
    console.error('Network came back "Unknown" — the bot would silently mark this FAILED and never call KaCyberPay at all. This is likely the root cause.');
    process.exit(1);
  }

  const apiNetwork = network === 'MTN' ? 'MTN' : 'AIRTEL';
  const externalReferenceID = `DIAG-${Date.now()}`;

  console.log('--- Sending collection request ---');
  console.log({ externalReferenceID, amount, msisdn: phoneNumber, network: apiNetwork });

  try {
    const result = await kacyberPay.initiateCollection({
      externalReferenceID,
      customerName: 'Diagnostic Test',
      narration: 'Diagnostic test payment',
      amount,
      msisdn: phoneNumber,
      network: apiNetwork
    });
    console.log('--- SUCCESS response from KaCyberPay ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('\nIf your phone does NOT prompt for a PIN despite this success response, the problem is on KaCyberPay/telco side for this specific reference — screenshot this output for Bruce/Sande.');
  } catch (error) {
    console.error('--- REQUEST FAILED ---');
    console.error('HTTP status:', error.response ? error.response.status : 'no response received');
    console.error('Response body:', error.response ? JSON.stringify(error.response.data, null, 2) : '(none)');
    console.error('Error message:', error.message);
    console.error('\nThis is the actual root cause. Paste this whole block back.');
  }
}

main();
