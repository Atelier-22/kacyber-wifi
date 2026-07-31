const config = require('./config');

const STATES = {
  MAIN_MENU: 'MAIN_MENU',
  SELECT_PACKAGE: 'SELECT_PACKAGE',
  SELECT_AIRTIME_AMOUNT: 'SELECT_AIRTIME_AMOUNT',
  SELECT_DATA_NETWORK: 'SELECT_DATA_NETWORK',
  SELECT_DATA_BUNDLE: 'SELECT_DATA_BUNDLE',
  SELECT_DATA_RECIPIENT: 'SELECT_DATA_RECIPIENT',
  ENTER_DATA_RECIPIENT: 'ENTER_DATA_RECIPIENT',
  SELECT_NUMBER: 'SELECT_NUMBER',
  ENTER_PHONE: 'ENTER_PHONE',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  LOOKUP_SELECT_NUMBER: 'LOOKUP_SELECT_NUMBER',
  LOOKUP_ENTER_PHONE: 'LOOKUP_ENTER_PHONE',
  SUPPORT: 'SUPPORT'
};

const sessions = new Map();

function getSession(userId) {
  const existing = sessions.get(userId);
  if (existing && Date.now() - existing.updatedAt < config.sessionTtlMs) {
    return existing;
  }
  const fresh = {
    userId,
    state: STATES.MAIN_MENU,
    data: {},
    updatedAt: Date.now()
  };
  sessions.set(userId, fresh);
  return fresh;
}

function updateSession(userId, patch) {
  const session = getSession(userId);
  const updated = {
    ...session,
    ...patch,
    data: { ...session.data, ...(patch.data || {}) },
    updatedAt: Date.now()
  };
  sessions.set(userId, updated);
  return updated;
}

function resetSession(userId) {
  const fresh = {
    userId,
    state: STATES.MAIN_MENU,
    data: {},
    updatedAt: Date.now()
  };
  sessions.set(userId, fresh);
  return fresh;
}

function findSessionByTransactionId(transactionId) {
  for (const session of sessions.values()) {
    if (session.data.transactionId === transactionId) {
      return session;
    }
  }
  return null;
}

// ── Used by paymentTimeoutWatcher to find stale AWAITING_PAYMENT sessions ──
function getSessionsByState(state) {
  return Array.from(sessions.values()).filter((session) => session.state === state);
}

module.exports = {
  STATES,
  getSession,
  updateSession,
  resetSession,
  findSessionByTransactionId,
  getSessionsByState
};
