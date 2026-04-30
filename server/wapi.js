import { getSettings } from './db.js';

function resolveSettings() {
  const settings = getSettings();
  if (!settings.instanceId) {
    throw new Error('Configure o instanceId da W-API antes de continuar.');
  }
  if (!settings.token) {
    throw new Error('Configure o token da W-API antes de continuar.');
  }
  return settings;
}

async function requestWapi(pathname, { method = 'GET', body } = {}) {
  const settings = resolveSettings();
  const url = new URL(pathname, settings.baseUrl || 'https://api.w-api.app');
  url.searchParams.set('instanceId', settings.instanceId);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${settings.token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = parsePayload(text);

  if (!response.ok) {
    const message = payload?.message || payload?.error || text || `Erro W-API (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function getInstanceStatus() {
  return requestWapi('/v1/instance/status-instance');
}

export function getQrCode() {
  return requestWapi('/v1/instance/qr-code');
}

export function getPaymentStatus() {
  return requestWapi('/v1/payment/status');
}

export function createPixPayment({ payerEmail = '', webhookPaymentUrl = '' } = {}) {
  return requestWapi('/v1/payment/pix/create', {
    method: 'POST',
    body: {
      payerEmail,
      webhookPaymentUrl
    }
  });
}

export function subscribePaymentCard({ payerEmail = '', webhookPaymentUrl = '' } = {}) {
  return requestWapi('/v1/payment/card/subscribe', {
    method: 'POST',
    body: {
      payerEmail,
      webhookPaymentUrl
    }
  });
}

export function togglePaymentAutoRenew() {
  return requestWapi('/v1/payment/auto-renew/toggle', { method: 'POST' });
}

export function sendTextMessage({ phone, message, messageId, delayMessage = 0 }) {
  return requestWapi('/v1/message/send-text', {
    method: 'POST',
    body: {
      phone,
      message,
      messageId: messageId || '',
      delayMessage
    }
  });
}

export function sendImageMessage({ phone, image, caption = '', messageId, delayMessage = 0 }) {
  return requestWapi('/v1/message/send-image', {
    method: 'POST',
    body: {
      phone,
      image,
      caption,
      messageId: messageId || '',
      delayMessage
    }
  });
}

export function sendAudioMessage({ phone, audio, messageId, delayMessage = 0 }) {
  return requestWapi('/v1/message/send-audio', {
    method: 'POST',
    body: {
      phone,
      audio,
      messageId: messageId || '',
      delayMessage
    }
  });
}

export function sendVideoMessage({ phone, video, caption = '', messageId, delayMessage = 0 }) {
  return requestWapi('/v1/message/send-video', {
    method: 'POST',
    body: {
      phone,
      video,
      caption,
      messageId: messageId || '',
      delayMessage
    }
  });
}

export function sendDocumentMessage({ phone, document, extension = '', fileName = '', caption = '', messageId, delayMessage = 0 }) {
  return requestWapi('/v1/message/send-document', {
    method: 'POST',
    body: {
      phone,
      document,
      extension,
      fileName,
      caption,
      messageId: messageId || '',
      delayMessage
    }
  });
}

export function downloadMedia({ mediaKey = '', directPath = '', type = '', mimetype = '' } = {}) {
  return requestWapi('/v1/message/download-media', {
    method: 'POST',
    body: {
      mediaKey,
      directPath,
      type,
      mimetype
    }
  });
}

export function sendLocationMessage({ phone, latitude, longitude, name = '', address = '', delayMessage = 0 }) {
  return requestWapi('/v1/message/send-location', {
    method: 'POST',
    body: {
      phone,
      latitude,
      longitude,
      name,
      address,
      delayMessage
    }
  });
}

export function sendContactMessage({ phone, contactName, contactPhone, contactBusinessDescription = '', messageId, delayMessage = 0 }) {
  return requestWapi('/v1/message/send-contact', {
    method: 'POST',
    body: {
      phone,
      contactName,
      contactPhone,
      contactBusinessDescription,
      messageId: messageId || '',
      delayMessage
    }
  });
}

export function checkPhoneExists(phone) {
  return requestWapi(`/v1/contacts/contacts/phone-exists?phone=${encodeURIComponent(phone)}`);
}

export function updateWebhook(kind, value) {
  const routes = {
    connected: '/v1/webhook/update-webhook-connected',
    disconnected: '/v1/webhook/update-webhook-disconnected',
    delivery: '/v1/webhook/update-webhook-delivery',
    received: '/v1/webhook/update-webhook-received',
    messageStatus: '/v1/webhook/update-webhook-message-status',
    presence: '/v1/webhook/update-webhook-chat-presence'
  };

  if (!routes[kind]) {
    throw new Error(`Webhook desconhecido: ${kind}`);
  }

  return requestWapi(routes[kind], {
    method: 'PUT',
    body: { value }
  });
}

function parsePayload(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
