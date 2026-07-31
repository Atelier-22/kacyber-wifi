const axios = require('axios');
const config = require('../../config');

const BASE_URL = config.kacyberPay.environment === 'sandbox'
  ? 'https://sandbox.kacyber.africa/api/v1'
  : 'https://kacyberpay.com/api/v1';

function headers() {
  return {
    'X-app-id': config.kacyberPay.appId,
    'X-API-Key': config.kacyberPay.apiKey,
    'Content-Type': 'application/json'
  };
}

function toE164(msisdn) {
  const digits = String(msisdn).replace(/[^\d]/g, '');
  return `+${digits}`;
}

// ── Airtime Send API — POST /v1/airtime/send (doc 4.1) ──
// Minimum amount is 500 UGX per docs. maxNumRetry is optional, 0-3, default 1.
async function sendAirtime({ externalReferenceID, msisdn, network, amount, currency = 'UGX', maxNumRetry = 2 }) {
  const response = await axios.post(
    `${BASE_URL}/airtime/send`,
    {
      externalReferenceID,
      Currency: currency,
      recipients: [{ msisdn: toE164(msisdn), network, amount }],
      maxNumRetry
    },
    { headers: headers() }
  );
  return response.data;
}

async function getAirtimeStatus(reference) {
  const response = await axios.get(`${BASE_URL}/airtime/status`, {
    headers: headers(),
    params: { reference, includeDetails: true }
  });
  return response.data;
}

// ── Data Products Catalog API — GET /v1/data-products (doc 4.1) ──
async function getDataProducts(telco) {
  const response = await axios.get(`${BASE_URL}/data-products`, {
    headers: headers(),
    params: telco ? { telco } : undefined
  });
  return response.data;
}

async function purchaseDataBundle({ externalReferenceID, msisdn, network, quantity, unit, validity, currency = 'UGX' }) {
  const response = await axios.post(
    `${BASE_URL}/data/bundles`,
    {
      externalReferenceID,
      Currency: currency,
      recipients: [{ msisdn: toE164(msisdn), network, quantity, unit, validity }]
    },
    { headers: headers() }
  );
  return response.data;
}

async function getDataBundleStatus(reference) {
  const response = await axios.get(`${BASE_URL}/data/bundles/status`, {
    headers: headers(),
    params: { reference, includeDetails: true }
  });
  return response.data;
}

module.exports = {
  sendAirtime,
  getAirtimeStatus,
  getDataProducts,
  purchaseDataBundle,
  getDataBundleStatus
};
