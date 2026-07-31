const config = require('../config');
const provider = require('./providers/kacyberAirtimeData');

let cachedBundles = null;
let cachedAt = 0;

function networkName(telco) {
  const value = String(telco || '').toUpperCase();
  if (value.includes('MTN')) return 'MTN';
  if (value.includes('AIRTEL')) return 'AIRTEL';
  return value;
}

function purchaseFields(bundle) {
  // The purchase docs define quantity as an integer. volumeMb is supplied by
  // the catalogue precisely for offers labelled with fractional GB (e.g. 1.5
  // GB), so using it preserves the product's exact volume without sending an
  // invalid decimal quantity.
  if (Number.isInteger(Number(bundle.volumeMb)) && Number(bundle.volumeMb) > 0) {
    return { quantity: Number(bundle.volumeMb), unit: 'MB' };
  }
  const match = String(bundle.label || '').match(/(\d+)\s*(MB|GB)\b/i);
  if (match) return { quantity: Number(match[1]), unit: match[2].toUpperCase() };
  return { quantity: bundle.volumeMb, unit: 'MB' };
}

function normalizeCatalogue(response) {
  const telcos = response && response.data && Array.isArray(response.data.telcos)
    ? response.data.telcos
    : [];

  return telcos.flatMap((telco) => (telco.bundles || []).map((bundle) => {
    const fields = purchaseFields(bundle);
    return {
      id: `data_${bundle.id || `${networkName(telco.telco)}_${bundle.label}_${bundle.validity}`}`,
      providerId: bundle.id || null,
      label: bundle.label,
      quantity: fields.quantity,
      unit: fields.unit,
      validity: bundle.validity,
      price: Number(bundle.amount),
      network: networkName(telco.telco),
      volumeMb: Number(bundle.volumeMb || (fields.unit === 'GB' ? fields.quantity * 1024 : fields.quantity))
    };
  }));
}

function fallbackBundles() {
  return config.dataBundles.map((bundle) => ({ ...bundle, volumeMb: bundle.quantity }));
}

function withinLimit(bundle) {
  const limit = config.dataCatalogue.maxBundleMb;
  const supportedNetwork = config.dataCatalogue.purchasableNetworks.includes(bundle.network);
  return supportedNetwork && (!limit || !bundle.volumeMb || bundle.volumeMb <= limit);
}

async function getAvailableBundles({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedBundles && Date.now() - cachedAt < config.dataCatalogue.cacheMs) {
    return { bundles: cachedBundles, source: 'cache' };
  }

  try {
    const response = await provider.getDataProducts();
    const bundles = normalizeCatalogue(response).filter(withinLimit);
    if (!bundles.length) throw new Error('KaCyber returned no usable data bundles');
    cachedBundles = bundles;
    cachedAt = Date.now();
    return { bundles, source: 'live' };
  } catch (error) {
    console.error('Unable to refresh KaCyber data catalogue; using documented fallback', error.response?.data || error.message);
    return { bundles: fallbackBundles().filter(withinLimit), source: 'fallback' };
  }
}

module.exports = { getAvailableBundles, normalizeCatalogue, purchaseFields };
