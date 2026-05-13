import webpush from 'web-push';
import {
  deletePushSubscription,
  getPushConfiguration,
  listPushSubscriptionsForSession,
  savePushConfiguration
} from './db.js';

const DEFAULT_PUSH_SUBJECT = 'mailto:push@wapi.local';
let configuredSignature = '';

export function getPushPublicKey() {
  return ensurePushConfiguration().publicKey;
}

export async function sendPushForMessage(message) {
  if (!message || message.direction !== 'inbound' || !message.sessionId) {
    return { attempted: 0, sent: 0, removed: 0 };
  }

  const subscriptions = listPushSubscriptionsForSession(message.sessionId);
  if (!subscriptions.length) {
    return { attempted: 0, sent: 0, removed: 0 };
  }

  ensurePushConfiguration();
  const payload = JSON.stringify(buildPushPayload(message));
  let sent = 0;
  let removed = 0;

  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: subscription.keys
      }, payload);
      sent += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        if (deletePushSubscription({ endpoint: subscription.endpoint })) removed += 1;
      }
      throw error;
    }
  }));

  return {
    attempted: subscriptions.length,
    sent,
    removed,
    failed: results.filter((result) => result.status === 'rejected').length
  };
}

function ensurePushConfiguration() {
  const current = getPushConfiguration();
  let publicKey = String(current.publicKey || '').trim();
  let privateKey = String(current.privateKey || '').trim();
  const subject = String(current.subject || DEFAULT_PUSH_SUBJECT).trim() || DEFAULT_PUSH_SUBJECT;

  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    savePushConfiguration({ publicKey, privateKey, subject });
  }

  const signature = `${subject}|${publicKey}|${privateKey}`;
  if (signature !== configuredSignature) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configuredSignature = signature;
  }

  return { publicKey, privateKey, subject };
}

function buildPushPayload(message) {
  return {
    title: message.name || message.phone || 'Nova mensagem recebida',
    body: buildMessageBody(message),
    icon: '/ura-logo.png',
    badge: '/ura-logo.png',
    tag: `session:${message.sessionId}`,
    data: {
      sessionId: message.sessionId,
      phone: message.phone || '',
      url: `/?view=inbox&session=${encodeURIComponent(message.sessionId)}`
    }
  };
}

function buildMessageBody(message) {
  const text = String(message.body || '').trim();
  if (text && !/^\[[^\]]+\]$/.test(text)) return text.slice(0, 160);

  return {
    image: 'Imagem recebida',
    audio: 'Audio recebido',
    video: 'Video recebido',
    document: 'Documento recebido',
    sticker: 'Figurinha recebida'
  }[message.type] || 'Nova mensagem recebida';
}
