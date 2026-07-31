const axios = require('axios');
const config = require('../../config');

const BASE_URL = config.kacyberPay.environment === 'sandbox'
  ? 'https://sandbox.kacyber.africa/api/v1'
  : 'https://kacyberpay.com/api/v1';

async function initiateCollection({ externalReferenceID, customerName, narration, amount, msisdn, network, currency = 'UGX' }) {
  const response = await axios.post(
    `${BASE_URL}/momo/collections`,
    {
      externalReferenceID,
      customerName,
      narration,
      Currency: currency,
      amount,
      msisdn,
      network
    },
    {
      headers: {
        'X-app-id': config.kacyberPay.appId,
        'X-API-Key': config.kacyberPay.apiKey,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

module.exports = {
  initiateCollection
};
