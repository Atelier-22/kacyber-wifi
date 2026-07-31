const axios = require('axios');
const config = require('../../config');

function headers() {
  return {
    'X-app-id': config.kacyberPay.appId,
    'X-API-Key': config.kacyberPay.apiKey,
    'X-Merchant-ID': config.wifiVoucherApi.merchantId,
    'Content-Type': 'application/json'
  };
}

function baseUrl() {
  return `${config.wifiVoucherApi.baseUrl}/api/v1/wifi/vouchers`;
}

async function getAvailableVouchers() {
  const response = await axios.get(`${baseUrl()}/available`, { headers: headers() });
  return response.data;
}

async function purchaseVoucher({ externalReferenceID, productCode, msisdn, network, customerName }) {
  const response = await axios.post(
    `${baseUrl()}/purchase`,
    { externalReferenceID, productCode, msisdn, network, customerName },
    { headers: headers() }
  );
  return response.data;
}

async function getPurchaseStatus(externalReferenceID) {
  const response = await axios.post(
    `${baseUrl()}/purchase/status`,
    { externalReferenceID },
    { headers: headers() }
  );
  return response.data;
}

async function issueVoucher({ externalReferenceID, productCode, msisdn, payment }) {
  const response = await axios.post(
    `${baseUrl()}/issue`,
    {
      externalReferenceID,
      productCode,
      customer: { msisdn },
      payment: {
        status: payment.status || 'PAID',
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency || 'UGX'
      }
    },
    { headers: headers() }
  );
  return response.data;
}

async function getVoucherStatus(voucher) {
  const response = await axios.post(
    `${baseUrl()}/status`,
    { merchantID: config.wifiVoucherApi.merchantId, voucher },
    { headers: headers() }
  );
  return response.data;
}

async function markVoucherUsed(voucher) {
  const response = await axios.post(
    `${baseUrl()}/mark-used`,
    { merchantID: config.wifiVoucherApi.merchantId, voucher },
    { headers: headers() }
  );
  return response.data;
}

async function getTransaction(kacyberReference) {
  const response = await axios.get(`${baseUrl()}/transaction`, {
    headers: headers(),
    params: { reference: kacyberReference }
  });
  return response.data;
}

module.exports = {
  getAvailableVouchers,
  purchaseVoucher,
  getPurchaseStatus,
  issueVoucher,
  getVoucherStatus,
  markVoucherUsed,
  getTransaction
};
