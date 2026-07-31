const provider = require('./providers/kacyberAirtimeData');

// ── KaCyber sends success/status as STRINGS ("true"/"false", "pending"/"failed"),
// not booleans — doc samples show "success": "true" and "success": "false".
function wasAccepted(result) {
  if (!result) return false;
  if (result.success === false || result.success === 'false') return false;
  if (result.status && String(result.status).toLowerCase() === 'failed') return false;
  return true;
}

async function sendAirtimeTopUp(phoneNumber, amount, meta = {}) {
  const externalReferenceID = meta.transactionId || `AT-${Date.now()}`;
  const network = apiNetworkFor(meta.network);

  if (!network) {
    throw new Error(`Cannot send airtime to ${phoneNumber} — unrecognized network.`);
  }

  let result;
  try {
    result = await provider.sendAirtime({
      externalReferenceID,
      msisdn: phoneNumber,
      network,
      amount
    });
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error(`Airtime send failed for ${externalReferenceID} (${phoneNumber}, UGX ${amount})`, details);
    throw error;
  }

  if (!wasAccepted(result)) {
    console.error(`Airtime send was not accepted for ${externalReferenceID}`, result);
    throw new Error(result && result.message ? result.message : 'Airtime provider reported failure');
  }

  return {
    kacyberReference: result.kacyberReference,
    status: result.status,
    amount
  };
}

async function purchaseData(phoneNumber, bundle, meta = {}) {
  const externalReferenceID = meta.transactionId || `DB-${Date.now()}`;
  const network = apiNetworkFor(meta.network);

  if (!network) {
    throw new Error(`Cannot purchase a data bundle for ${phoneNumber} — unrecognized network.`);
  }

  let result;
  try {
    result = await provider.purchaseDataBundle({
      externalReferenceID,
      msisdn: phoneNumber,
      network,
      quantity: bundle.quantity,
      unit: bundle.unit,
      validity: bundle.validity
    });
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error(`Data bundle purchase failed for ${externalReferenceID} (${phoneNumber}, ${bundle.label})`, details);
    throw error;
  }

  if (!wasAccepted(result)) {
    console.error(`Data bundle purchase was not accepted for ${externalReferenceID}`, result);
    throw new Error(result && result.message ? result.message : 'Data bundle provider reported failure');
  }

  return {
    kacyberReference: result.kacyberReference,
    status: result.status,
    bundle
  };
}

// ── KaCyber expects 'MTN' or 'AIRTEL' — our internal validators use 'MTN' / 'Airtel' ──
function apiNetworkFor(network) {
  if (network === 'MTN') return 'MTN';
  if (network === 'Airtel') return 'AIRTEL';
  return null;
}

module.exports = {
  sendAirtimeTopUp,
  purchaseData
};
