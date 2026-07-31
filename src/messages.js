const config = require('./config');

function formatCurrency(amount) {
  return `UGX ${amount.toLocaleString()}`;
}

function kampalaHour() {
  const now = new Date();
  return (now.getUTCHours() + 3) % 24;
}

function getTimeGreeting() {
  const hour = kampalaHour();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

function getDayNightClosing() {
  const hour = kampalaHour();
  if (hour >= 5 && hour < 19) return 'Have a great day!';
  return 'Have a great night!';
}

// ── Alternates the bot's introduced name between Peter and Phiona ──
// every time a new conversation starts (welcome message shown).
let lastBotName = 'Phiona';
function nextBotName() {
  lastBotName = lastBotName === 'Peter' ? 'Phiona' : 'Peter';
  return lastBotName;
}

// ── Message shape helpers ────────────────────────────────────────
function text(body) {
  return { kind: 'text', body };
}

function list({ header, body, footer, buttonText, sections }) {
  return { kind: 'list', header, body, footer, buttonText, sections };
}

function buttons(body, buttonList) {
  return { kind: 'buttons', body, buttons: buttonList };
}

// ── Shared row set for the main menu ─────────────────────────────
function mainMenuSections() {
  return [
    {
      rows: [
        { id: 'buy_voucher', title: 'Buy Voucher', description: 'Get a WiFi voucher' },
        { id: 'buy_airtime', title: 'Buy Airtime', description: 'Top up your airtime' },
        { id: 'buy_data', title: 'Buy Data', description: 'Get a data bundle' },
        { id: 'check_voucher', title: 'Check Voucher', description: 'Look up an active voucher' },
        { id: 'contact_support', title: 'Contact Support', description: 'Reach our support team' }
      ]
    }
  ];
}

function welcomeMessage() {
  return list({
    header: config.business.name,
    body: 'How can I help you?',
    buttonText: 'Select',
    sections: mainMenuSections()
  });
}

function greetingMessage() {
  return text(`${getTimeGreeting()}! I'm ${nextBotName()}, your KaCyber E-Assistant.`);
}

function invalidMenuMessage() {
  return list({
    header: config.business.name,
    body: `That's not a valid option. Please choose from the menu below.`,
    buttonText: 'Select',
    sections: mainMenuSections()
  });
}

// ── Shared row set for package selection ─────────────────────────
function packageSections() {
  return [
    {
      rows: [
        ...config.packages.map((pkg) => ({
          id: pkg.id,
          title: pkg.label,
          description: formatCurrency(pkg.price)
        })),
        { id: 'cancel', title: 'Cancel', description: 'Stop and come back later' }
      ]
    }
  ];
}

function packageListMessage() {
  return list({
    header: 'Choose a Package',
    body: 'Select a WiFi voucher package:',
    buttonText: 'Select',
    sections: packageSections()
  });
}

function invalidPackageMessage() {
  return list({
    header: 'Choose a Package',
    body: `That package doesn't exist. Please choose from the list below.`,
    buttonText: 'Select',
    sections: packageSections()
  });
}

// ── Shared row set for airtime amount selection ───────────────────
function airtimeAmountSections() {
  return [
    {
      rows: [
        ...config.airtimeAmounts.map((preset) => ({
          id: preset.id,
          title: formatCurrency(preset.amount),
          description: 'Airtime top-up'
        })),
        { id: 'cancel', title: 'Cancel', description: 'Stop and come back later' }
      ]
    }
  ];
}

function airtimeAmountMessage() {
  return list({
    header: 'Buy Airtime',
    body: 'Select an airtime amount:',
    buttonText: 'Select',
    sections: airtimeAmountSections()
  });
}

function invalidAirtimeAmountMessage() {
  return list({
    header: 'Buy Airtime',
    body: `That's not a valid amount. Please choose from the list below.`,
    buttonText: 'Select',
    sections: airtimeAmountSections()
  });
}

// ── Shared row set for data bundle selection ──────────────────────
// Network is shown in the title since a bundle only works for the telco
// it's listed under — the customer needs to know before picking a number.
const DATA_BUNDLES_PER_PAGE = 8;

function dataBundleSections(bundles, page) {
  const start = page * DATA_BUNDLES_PER_PAGE;
  const visibleBundles = bundles.slice(start, start + DATA_BUNDLES_PER_PAGE);
  const rows = visibleBundles.map((bundle) => ({
    id: bundle.id,
    title: bundle.label,
    description: `${bundle.network} • ${bundle.validity} • ${formatCurrency(bundle.price)}`
  }));

  if (page > 0) rows.push({ id: 'data_previous_page', title: 'Previous offers', description: 'Go back one page' });
  if (start + DATA_BUNDLES_PER_PAGE < bundles.length) {
    rows.push({ id: 'data_next_page', title: 'More offers', description: 'See the next page' });
  }

  return [
    {
      rows
    }
  ];
}

function dataNetworkMessage(bundles = config.dataBundles, source = 'fallback') {
  const body = source === 'fallback'
    ? 'The live catalogue is temporarily unavailable. Choose a network to see the documented sample offers.'
    : 'Choose the network for the data bundle you want to buy:';
  return buttons(body, [
    { id: 'data_network_mtn', title: 'MTN' },
    { id: 'data_network_airtel', title: 'Airtel' },
    { id: 'cancel', title: 'Cancel' }
  ]);
}

function dataBundleMessage(bundles = config.dataBundles, page = 0, source = 'fallback', network = '') {
  const pageCount = Math.max(1, Math.ceil(bundles.length / DATA_BUNDLES_PER_PAGE));
  const heading = network ? `${network} Data` : 'Buy Data';
  const body = source === 'fallback'
    ? 'The live catalogue is temporarily unavailable. These documented sample offers are shown below.'
    : `Select an ${network || ''} data bundle (page ${page + 1} of ${pageCount}):`;
  return list({
    header: heading,
    body,
    buttonText: 'Select',
    sections: dataBundleSections(bundles, page)
  });
}

function invalidDataBundleMessage(bundles = config.dataBundles, page = 0, source = 'fallback', network = '') {
  return list({
    header: network ? `${network} Data` : 'Buy Data',
    body: `That bundle doesn't exist. Please choose from the list below.`,
    buttonText: 'Select',
    sections: dataBundleSections(bundles, page)
  });
}

function dataNetworkMismatchMessage(bundle, phoneNumberDisplay) {
  return buttons(
    `"${bundle.label}" is only available on ${bundle.network}, but ${phoneNumberDisplay} isn't a ${bundle.network} number. Please choose a bundle that matches, or pay with a different number.`,
    [
      { id: 'buy_data', title: 'Choose Bundle' },
      { id: 'main_menu', title: 'Main Menu' }
    ]
  );
}

function askDataRecipientMessage(network) {
  return buttons(
    `Please enter the ${network} number that should receive the ${network} data bundle (e.g. 0771234567).`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function selectDataRecipientMessage(network, ownNumberDisplay) {
  return buttons(
    `Who should receive the ${network} data bundle?\n\nYour WhatsApp number: ${ownNumberDisplay}`,
    [
      { id: 'data_recipient_self', title: 'Myself' },
      { id: 'data_recipient_other', title: 'Another number' },
      { id: 'cancel', title: 'Cancel' }
    ]
  );
}

function invalidDataRecipientNetworkMessage(network, phoneNumberDisplay) {
  return buttons(
    `${phoneNumberDisplay} is not an ${network} number. Please enter an ${network} number to receive this bundle.`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function selectNumberMessage(ownNumberDisplay) {
  return buttons(
    `Which Mobile Money number should receive the payment prompt?\n\nYour WhatsApp number: ${ownNumberDisplay}`,
    [
      { id: 'use_own_number', title: 'Myself' },
      { id: 'use_different_number', title: 'Another number' },
      { id: 'cancel', title: 'Cancel' }
    ]
  );
}

function invalidSelectNumberMessage(ownNumberDisplay) {
  return buttons(
    `Please choose one of the options below.\n\nYour WhatsApp number: ${ownNumberDisplay}`,
    [
      { id: 'use_own_number', title: 'Myself' },
      { id: 'use_different_number', title: 'Another number' },
      { id: 'cancel', title: 'Cancel' }
    ]
  );
}

function askPhoneNumberMessage() {
  return buttons(
    `Please type the Mobile Money number to receive the payment prompt (e.g. 0771234567).`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function invalidPhoneMessage() {
  return buttons(
    `That doesn't look like a valid phone number. Please type it again (e.g. 0771234567).`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function paymentRequestSentMessage(product, phoneNumberDisplay) {
  return text(
    `A payment request of ${formatCurrency(product.price)} has been sent to ${phoneNumberDisplay}.\n\n` +
    `Enter your Mobile Money PIN on your phone to authorize the payment.`
  );
}

function paymentReceivedMessage(product, phoneNumberDisplay, amount) {
  return text(
    `Payment received.\n\n` +
    `Purchase: ${product.label}\n` +
    `Number: ${phoneNumberDisplay}\n` +
    `Amount paid: ${formatCurrency(amount)}\n\n` +
    `You'll get a confirmation message here shortly once it's delivered.`
  );
}

function paymentPendingMessage() {
  return text(`Still waiting for payment confirmation. This can take a minute.`);
}

function paymentFailedMessage() {
  return buttons(
    `Payment was not completed.`,
    [
      { id: 'main_menu', title: 'Try Again' },
      { id: 'contact_support', title: 'Support' }
    ]
  );
}

function unrecognizedNetworkMessage(phoneNumberDisplay) {
  return buttons(
    `We couldn't tell whether ${phoneNumberDisplay} is on MTN or Airtel, so we can't request payment from it. Please try again with a different number.`,
    [
      { id: 'main_menu', title: 'Try Again' },
      { id: 'contact_support', title: 'Support' }
    ]
  );
}

function productUnavailableMessage() {
  return buttons(
    `Your payment was received, but we couldn't complete the delivery right now. Please contact support so we can sort this out for you.`,
    [{ id: 'contact_support', title: 'Support' }]
  );
}

function voucherUnavailableMessage() {
  return productUnavailableMessage();
}

function paymentTimeoutMessage() {
  return buttons(
    `We didn't receive payment confirmation in time.`,
    [{ id: 'main_menu', title: 'Try Again' }]
  );
}

function voucherDeliveredMessage(voucher, pkg) {
  return text(
    `Your Voucher\n\n` +
    `Username: ${voucher.username}\n` +
    `Password: ${voucher.password}\n\n` +
    `Valid for: ${pkg.label}\n\n` +
    `Thank you for working with KaCyber Technologies. ${getDayNightClosing()}`
  );
}

// ── Sent right after payment, since airtime send is asynchronous —
// real confirmation comes later from KaCyber's result callback. ──
function airtimeProcessingMessage(amount, phoneNumberDisplay) {
  return text(
    `Your ${formatCurrency(amount)} airtime top-up for ${phoneNumberDisplay} is being processed.\n\n` +
    `We'll confirm here as soon as it lands.`
  );
}

function dataProcessingMessage(bundle, phoneNumberDisplay) {
  return text(
    `Your ${bundle.label} data bundle for ${phoneNumberDisplay} is being processed.\n\n` +
    `We'll confirm here as soon as it's activated.`
  );
}


function airtimeDeliveredMessage(amount, phoneNumberDisplay) {
  return text(
    `Airtime Delivered\n\n` +
    `${formatCurrency(amount)} airtime has been sent to ${phoneNumberDisplay}.\n\n` +
    `Thank you for working with KaCyber Technologies. ${getDayNightClosing()}`
  );
}

function dataDeliveredMessage(bundle, phoneNumberDisplay) {
  return text(
    `Data Bundle Delivered\n\n` +
    `${bundle.label} has been activated on ${phoneNumberDisplay}.\n\n` +
    `Thank you for working with KaCyber Technologies. ${getDayNightClosing()}`
  );
}

function askLookupPhoneMessage() {
  return buttons(
    `Please type the phone number used for your purchase.`,
    [{ id: 'cancel', title: 'Cancel' }]
  );
}

function selectLookupNumberMessage(ownNumberDisplay) {
  return buttons(
    `Which number was used to receive the voucher?\n\nYour WhatsApp number: ${ownNumberDisplay}`,
    [
      { id: 'lookup_own_number', title: 'My number' },
      { id: 'lookup_different_number', title: 'Different number' },
      { id: 'cancel', title: 'Cancel' }
    ]
  );
}

function noVoucherFoundMessage() {
  return buttons(
    `We couldn't find an active voucher for that number.`,
    [{ id: 'buy_voucher', title: 'Buy Voucher' }]
  );
}

function voucherLookupResultMessage(voucher, pkg) {
  return text(
    `Here is your active voucher\n\n` +
    `Username: ${voucher.username}\n` +
    `Password: ${voucher.password}\n\n` +
    `Package: ${pkg.label}\n` +
    `Expires: ${new Date(voucher.expiresAt).toLocaleString()}`
  );
}

function supportMessage() {
  return buttons(
    `You can reach us at:\n\nPhone: ${config.business.supportPhone}\nEmail: ${config.business.supportEmail}`,
    [{ id: 'main_menu', title: 'Main Menu' }]
  );
}

function cancelledMessage() {
  return text(`Thank you for using KaCyber's E-Assistant services. We hope to see you soon!`);
}

function sessionExpiredMessage() {
  return text(`Your session has expired. Type "Hello" to start again.`);
}

function fallbackMessage() {
  return text(`Sorry, I didn't understand that. Type "Hello" to see the menu.`);
}

module.exports = {
  formatCurrency,
  DATA_BUNDLES_PER_PAGE,
  getTimeGreeting,
  getDayNightClosing,
  welcomeMessage,
  greetingMessage,
  invalidMenuMessage,
  packageListMessage,
  invalidPackageMessage,
  airtimeAmountMessage,
  invalidAirtimeAmountMessage,
  dataBundleMessage,
  dataNetworkMessage,
  invalidDataBundleMessage,
  dataNetworkMismatchMessage,
  askDataRecipientMessage,
  selectDataRecipientMessage,
  invalidDataRecipientNetworkMessage,
  selectNumberMessage,
  invalidSelectNumberMessage,
  askPhoneNumberMessage,
  invalidPhoneMessage,
  paymentRequestSentMessage,
  paymentReceivedMessage,
  paymentPendingMessage,
  paymentFailedMessage,
  unrecognizedNetworkMessage,
  productUnavailableMessage,
  voucherUnavailableMessage,
  paymentTimeoutMessage,
  voucherDeliveredMessage,
  airtimeProcessingMessage,
  dataProcessingMessage,
  airtimeDeliveredMessage,
  dataDeliveredMessage,
  askLookupPhoneMessage,
  selectLookupNumberMessage,
  noVoucherFoundMessage,
  voucherLookupResultMessage,
  supportMessage,
  cancelledMessage,
  sessionExpiredMessage,
  fallbackMessage
};
