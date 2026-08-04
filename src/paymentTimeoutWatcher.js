const config = require('./config');
const messages = require('./messages');
const whatsappClient = require('./whatsappClient');
const { STATES, getSessionsByState, resetSession } = require('./sessionStore');

const SWEEP_INTERVAL_MS = 30 * 1000;

async function sweep() {
  const paymentService = require('./integrations/paymentService');
  const conversationFlow = require('./conversationFlow');

  const stale = getSessionsByState(STATES.AWAITING_PAYMENT).filter(
    (session) => Date.now() - session.updatedAt > config.paymentTimeoutMs
  );

  for (const session of stale) {
    const transactionId = session.data && session.data.transactionId;
    if (transactionId) {
      try {
        const { status } = await paymentService.getPaymentStatus(transactionId);
        if (status === 'SUCCESS') {
          const result = await conversationFlow.deliverVoucherOnPaymentSuccess(transactionId);
          if (result) {
            for (const msg of result.message) {
              await whatsappClient.sendMessage(result.userId, msg);
            }
          }
          continue;
        }
      } catch (err) {
        console.error(`Error checking timeout status for transaction ${transactionId}:`, err.message);
      }
    }

    resetSession(session.userId);
    await whatsappClient.sendMessage(session.userId, messages.paymentTimeoutMessage());
  }
}

function start() {
  setInterval(sweep, SWEEP_INTERVAL_MS);
}

module.exports = { start };
