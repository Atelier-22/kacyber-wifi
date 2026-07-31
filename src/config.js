require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0'
  },

  kacyberPay: {
    appId: process.env.KACYBERPAY_APP_ID,
    apiKey: process.env.KACYBERPAY_API_KEY,
    environment: process.env.KACYBERPAY_ENV || 'production',
    // Used to verify X-KaCyber-Signature on incoming airtime/data result
    // callbacks (KaCyber Pay API docs, Airtime 4.4 / Data 4.5). This is a
    // separate secret from the app id/api key above — get it from Bruce/KaCyber,
    // it is NOT the same value as KACYBERPAY_API_KEY.
    callbackSecret: process.env.KACYBER_CALLBACK_SECRET || null
  },

  dataCatalogue: {
    // 12 GB is the requested WhatsApp display limit. Set 0 to show all offers.
    maxBundleMb: Number(process.env.MAX_DATA_BUNDLE_MB || 12288),
    // KaCyber's MoMo collection integration in this bot supports these networks.
    purchasableNetworks: ['MTN', 'AIRTEL'],
    cacheMs: 10 * 60 * 1000
  },

 
  wifiVoucherApi: {
    merchantId: process.env.WIFI_VOUCHER_MERCHANT_ID || null,
    baseUrl:
      process.env.WIFI_VOUCHER_ENV === 'production'
        ? 'https://kacyberpay.com'
        : 'https://sandbox.kacyber.africa'
  },

 
  admin: {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD
  },

  business: {
    name: process.env.BUSINESS_NAME || 'UNIFI WiFi',
    supportPhone: process.env.SUPPORT_PHONE || '+256700000000',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com'
  },

  packages: [
    { id: '1', label: '3 Hours', productCode: 'WIFI_3H', durationHours: 3, price: 1000 },
    { id: '2', label: '16 Hours', productCode: 'WIFI_16H', durationHours: 16, price: 1500 },
    { id: '3', label: '1 Month', productCode: 'WIFI_30D', durationHours: 744, price: 28000 }
  ],

  // ── Preset airtime top-up amounts shown in the "Buy Airtime" list ──
  // Docs (Airtime 4.1 Request Body) state a minimum of UGX 500 — all presets below satisfy that.
  airtimeAmounts: [
    { id: 'airtime_500', amount: 500 },
    { id: 'airtime_1000', amount: 1000 },
    { id: 'airtime_2000', amount: 2000 },
    { id: 'airtime_5000', amount: 5000 },
    { id: 'airtime_10000', amount: 10000 }
  ],

  dataBundles: [
    { id: 'data_mtn_70mb_day', label: '70MB - Daily', quantity: 70, unit: 'MB', validity: 'Day', price: 500, network: 'MTN' },
    { id: 'data_mtn_165mb_day', label: '165MB - Daily', quantity: 165, unit: 'MB', validity: 'Day', price: 1000, network: 'MTN' },
    { id: 'data_airtel_70mb_day', label: '70MB - Daily', quantity: 70, unit: 'MB', validity: 'Day', price: 500, network: 'AIRTEL' }
  ],

  paymentTimeoutMs: 5 * 60 * 1000,
  sessionTtlMs: 5 * 60 * 1000
};
