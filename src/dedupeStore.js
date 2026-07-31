const SEEN_TTL_MS = 10 * 60 * 1000;
const seenMessageIds = new Map();

function isFirstDelivery(messageId) {
  if (!messageId) {
    return true;
  }

  const now = Date.now();
  cleanup(now);

  if (seenMessageIds.has(messageId)) {
    return false;
  }

  seenMessageIds.set(messageId, now);
  return true;
}

function cleanup(now) {
  for (const [id, seenAt] of seenMessageIds) {
    if (now - seenAt > SEEN_TTL_MS) {
      seenMessageIds.delete(id);
    }
  }
}

module.exports = {
  isFirstDelivery
};
