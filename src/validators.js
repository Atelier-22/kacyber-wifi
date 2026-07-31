function normalizePhoneNumber(input) {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return '256' + digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('256')) {
    return digits;
  }
  if (digits.length === 9) {
    return '256' + digits;
  }
  return null;
}

function formatPhoneForDisplay(phoneNumber) {
  if (phoneNumber.startsWith('256') && phoneNumber.length === 12) {
    return '0' + phoneNumber.slice(3);
  }
  return phoneNumber;
}

function isValidPhoneNumber(input) {
  return normalizePhoneNumber(input) !== null;
}

function isValidPackageSelection(input, packages) {
  return packages.some((pkg) => pkg.id === input.trim());
}

function isValidMenuSelection(input, validOptions) {
  return validOptions.includes(input.trim());
}

function detectNetwork(phoneNumber) {
  const local = phoneNumber.startsWith('256') ? phoneNumber.slice(3) : phoneNumber;
  const prefix = local.slice(0, 2);
  const mtnPrefixes = ['77', '78', '76', '39'];
  const airtelPrefixes = ['70', '74', '75', '20', '25'];
  if (mtnPrefixes.includes(prefix)) {
    return 'MTN';
  }
  if (airtelPrefixes.includes(prefix)) {
    return 'Airtel';
  }
  return 'Unknown';
}

module.exports = {
  normalizePhoneNumber,
  formatPhoneForDisplay,
  isValidPhoneNumber,
  isValidPackageSelection,
  isValidMenuSelection,
  detectNetwork
};
