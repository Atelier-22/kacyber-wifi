const axios = require('axios');
const config = require('./config');

function url() {
  return `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;
}

async function post(payload) {
  try {
    await axios.post(url(), payload, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const details = error.response ? error.response.data : error.message;
    console.error('Failed to send WhatsApp message', details);
  }
}

async function sendTextMessage(to, body) {
  await post({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  });
}

async function sendListMessage(to, { header, body, footer, buttonText, sections }) {
  const interactive = {
    type: 'list',
    body: { text: body },
    action: {
      button: buttonText || 'Select',
      sections
    }
  };
  if (header) {
    interactive.header = { type: 'text', text: header };
  }
  if (footer) {
    interactive.footer = { text: footer };
  }

  await post({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive
  });
}

async function sendButtonMessage(to, { body, buttons }) {
  await post({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title }
        }))
      }
    }
  });
}


async function sendMessage(to, message) {
  if (typeof message === 'string') {
    return sendTextMessage(to, message);
  }
  switch (message.kind) {
    case 'list':
      return sendListMessage(to, message);
    case 'buttons':
      return sendButtonMessage(to, message);
    case 'text':
    default:
      return sendTextMessage(to, message.body);
  }
}

module.exports = {
  sendTextMessage,
  sendListMessage,
  sendButtonMessage,
  sendMessage
};
