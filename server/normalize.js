import { extractMessageMediaInfo } from './media.js';

const PHONE_KEYS = ['phone', 'from', 'sender', 'remoteJid', 'chatId', 'jid', 'number', 'participant'];
const NAME_KEYS = ['pushName', 'senderName', 'contactName', 'name', 'notifyName'];
const TEXT_KEYS = ['message', 'text', 'body', 'caption', 'content', 'conversation'];
const ID_KEYS = ['messageId', 'id', 'keyId', 'stanzaId'];
const WHATSAPP_MEDIA_HOST = 'https://mmg.whatsapp.net';

export function normalizeIncomingMessage(payload, fallbackEvent = 'received') {
  const raw = payload ?? {};
  const data = raw.data || (raw.message && typeof raw.message === 'object' ? raw.message : raw);
  const isGroup = Boolean(data.isGroup ?? raw.isGroup);
  const phone = cleanPhone(firstPhone(data) || firstPhone(raw));
  const text = firstString(data, TEXT_KEYS) || firstNestedText(data) || '';
  const externalId = firstString(data, ID_KEYS) || firstString(raw, ID_KEYS) || null;
  const name = isGroup ? firstGroupName(data) || firstGroupName(raw) || phone : firstName(data) || firstName(raw) || phone;
  const avatarUrl = firstAvatarUrl(data) || firstAvatarUrl(raw) || null;
  const media = firstMediaInfo(data) || firstMediaInfo(raw) || null;
  const mediaPath = firstMediaSource(data) || firstMediaSource(raw) || media?.url || null;
  const timestamp = extractTimestamp(data) || extractTimestamp(raw) || new Date().toISOString();
  const type = firstString(data, ['type', 'messageType', 'mediaType']) || media?.type || inferMessageType(data, text, fallbackEvent);
  const senderName = firstSenderName(data) || firstSenderName(raw) || '';
  const senderPhone = cleanPhone(data.sender?.id || raw.sender?.id || data.participant || raw.participant || '');
  const replyContext = findReplyContext(data) || findReplyContext(raw);
  const fromMe = Boolean(data.fromMe ?? raw.fromMe ?? data.key?.fromMe ?? raw.key?.fromMe);
  const mentions = normalizeMentions([
    ...extractMentions(data),
    ...extractMentions(raw)
  ]);

  return {
    phone,
    name,
    avatarUrl,
    isGroup,
    fromMe,
    senderName,
    senderPhone,
    externalId,
    type,
    body: text || `[${fallbackEvent}]`,
    mediaPath,
    media,
    mentions,
    replyToExternalId: extractReplyExternalId(replyContext),
    replyParticipant: extractReplyParticipant(replyContext),
    replyPreview: extractQuotedPreview(replyContext),
    createdAt: timestamp,
    raw
  };
}

function extractMentions(source) {
  if (!source || typeof source !== 'object') return [];
  const content = source.msgContent || source.message || source;
  const contexts = [
    content.extendedTextMessage?.contextInfo,
    content.imageMessage?.contextInfo,
    content.videoMessage?.contextInfo,
    content.stickerMessage?.contextInfo,
    content.documentMessage?.contextInfo,
    content.audioMessage?.contextInfo,
    content.contextInfo,
    source.contextInfo,
    source.messageContextInfo
  ].filter(Boolean);
  const values = [
    source.mentionedJid,
    source.mentions,
    source.mentioned,
    content.mentionedJid,
    content.mentions,
    content.mentioned,
    ...contexts.flatMap((context) => [context.mentionedJid, context.mentions, context.mentioned])
  ];
  return values.flatMap((value) => Array.isArray(value) ? value : [value]);
}

function normalizeMentions(values = []) {
  return [...new Set(values
    .map((value) => String(value || '').replace(/\s/g, '').trim())
    .filter(Boolean))];
}

export function isReactionPayload(payload) {
  const raw = payload ?? {};
  const data = raw.data || (raw.message && typeof raw.message === 'object' ? raw.message : raw);
  const content = data.msgContent || data.message || data;
  return Boolean(content.reactionMessage || content.reaction);
}

export function isGroupPayload(payload) {
  const raw = payload ?? {};
  const data = raw.data || (raw.message && typeof raw.message === 'object' ? raw.message : raw);
  return Boolean(data.isGroup ?? raw.isGroup);
}

export function normalizeWebhookBatch(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.messages)) return payload.messages;
  return [payload];
}

function firstString(source, keys) {
  if (!source || typeof source !== 'object') return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
    if (value && typeof value === 'object') {
      const nested = firstString(value, keys);
      if (nested) return nested;
    }
  }
  return '';
}

function firstPhone(source) {
  if (!source || typeof source !== 'object') return '';
  return firstString(source, PHONE_KEYS)
    || source.chat?.id
    || source.sender?.id
    || source.key?.remoteJid
    || source.message?.key?.remoteJid
    || '';
}

function firstName(source) {
  if (!source || typeof source !== 'object') return '';
  return firstString(source, NAME_KEYS)
    || source.sender?.pushName
    || source.sender?.verifiedBizName
    || source.chat?.name
    || source.contact?.name
    || '';
}

function firstGroupName(source) {
  if (!source || typeof source !== 'object') return '';
  return source.chat?.name
    || source.chat?.subject
    || source.group?.name
    || source.group?.subject
    || source.subject
    || '';
}

function firstSenderName(source) {
  if (!source || typeof source !== 'object') return '';
  return source.sender?.pushName
    || source.sender?.verifiedBizName
    || source.senderName
    || source.pushName
    || '';
}

function firstAvatarUrl(source) {
  if (!source || typeof source !== 'object') return '';
  return source.chat?.profilePicture
    || source.sender?.profilePicture
    || source.profilePicture
    || source.avatarUrl
    || '';
}

function firstMediaSource(source) {
  if (!source || typeof source !== 'object') return '';
  const media = findVisualMediaMessage(source) || {};
  const generic = extractMessageMediaInfo(source, { requireMediaKey: false });
  const value = media.jpegThumbnail || resolveMediaUrl(media) || generic?.url || source.mediaUrl || source.url || '';
  if (!value) return '';
  if (String(value).startsWith('data:image') || String(value).startsWith('http')) return String(value);
  return `data:${media.mimetype || 'image/jpeg'};base64,${value}`;
}

function firstMediaInfo(source) {
  if (!source || typeof source !== 'object') return null;
  return extractMessageMediaInfo(source, { requireMediaKey: false });
}

function resolveMediaUrl(media) {
  if (!media || typeof media !== 'object') return '';
  const url = [media.url, media.mediaUrl, media.link].find((value) => typeof value === 'string' && value.trim()) || '';
  if (url && !isGenericWhatsAppWebUrl(url)) return url;
  return buildWhatsAppDirectPathUrl(media.directPath) || url;
}

function buildWhatsAppDirectPathUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const path = value.trim();
  if (path.startsWith('http')) return path;
  return `${WHATSAPP_MEDIA_HOST}${path.startsWith('/') ? path : `/${path}`}`;
}

function isGenericWhatsAppWebUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'web.whatsapp.net' && (url.pathname === '' || url.pathname === '/');
  } catch {
    return false;
  }
}

function firstNestedText(source) {
  if (!source || typeof source !== 'object') return '';
  const candidates = [
    source.msgContent?.conversation,
    source.msgContent?.extendedTextMessage?.text,
    source.msgContent?.imageMessage?.caption,
    source.msgContent?.associatedChildMessage?.message?.imageMessage?.caption,
    source.msgContent?.videoMessage?.caption,
    source.msgContent?.documentMessage?.caption,
    source.msgContent?.documentMessage?.fileName,
    source.msgContent?.associatedChildMessage?.message?.videoMessage?.caption,
    source.msgContent?.associatedChildMessage?.message?.documentMessage?.caption,
    source.msgContent?.buttonsResponseMessage?.selectedDisplayText,
    source.msgContent?.listResponseMessage?.title,
    source.msgContent?.listMessage?.description,
    source.message?.conversation,
    source.message?.extendedTextMessage?.text,
    source.message?.imageMessage?.caption,
    source.message?.videoMessage?.caption,
    source.message?.documentMessage?.caption,
    source.message?.documentMessage?.fileName,
    source.text?.message,
    source.content?.text
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function findReplyContext(source) {
  if (!source || typeof source !== 'object') return null;
  const content = source.msgContent || source.message || source;
  const candidates = [
    content.extendedTextMessage?.contextInfo,
    content.imageMessage?.contextInfo,
    content.videoMessage?.contextInfo,
    content.stickerMessage?.contextInfo,
    content.documentMessage?.contextInfo,
    content.contextInfo,
    content.messageContextInfo?.quotedMessage ? content.messageContextInfo : null
  ];
  return candidates.find((item) => item && typeof item === 'object' && (item.stanzaId || item.quotedMessage || item.quotedMessageId || item.messageId || item.key?.id)) || null;
}

function extractReplyExternalId(context) {
  if (!context) return '';
  return context.stanzaId || context.quotedMessageId || context.messageId || context.key?.id || '';
}

function extractReplyParticipant(context) {
  if (!context) return '';
  return String(context.participant || context.key?.participant || context.participantJid || '').replace(/\s/g, '').trim();
}

function extractQuotedPreview(context) {
  const quoted = context?.quotedMessage;
  if (!quoted || typeof quoted !== 'object') return '';
  const text = quoted.conversation
    || quoted.extendedTextMessage?.text
    || quoted.imageMessage?.caption
    || quoted.videoMessage?.caption
    || quoted.documentMessage?.caption
    || '';
  if (text) return String(text).replace(/\s+/g, ' ').trim().slice(0, 220);
  if (quoted.imageMessage) return 'Imagem';
  if (quoted.audioMessage) return 'Audio';
  if (quoted.videoMessage) return 'Video';
  if (quoted.documentMessage) return quoted.documentMessage.fileName || 'Documento';
  if (quoted.stickerMessage) return 'Figurinha';
  return '';
}

function inferMessageType(source, text, fallbackEvent) {
  const content = source?.msgContent || source?.message || {};
  if (findImageMessage(source)) return 'image';
  if (content.stickerMessage || content.sticker) return 'sticker';
  if (content.audioMessage || content.audio) return 'audio';
  if (content.videoMessage || content.video) return 'video';
  if (content.documentMessage || content.document) return 'document';
  const typeKey = Object.keys(content).find((key) => key.endsWith('Message'));
  if (typeKey) return typeKey.replace(/Message$/, '');
  return text ? 'text' : fallbackEvent;
}

function findVisualMediaMessage(source) {
  if (!source || typeof source !== 'object') return null;
  const content = source.msgContent || source.message || source;
  return findImageMessage(source)
    || content.stickerMessage
    || content.sticker
    || content.associatedChildMessage?.message?.stickerMessage
    || content.associatedChildMessage?.message?.sticker
    || null;
}

function findImageMessage(source) {
  if (!source || typeof source !== 'object') return null;
  const content = source.msgContent || source.message || source;
  return content.imageMessage
    || content.image
    || content.associatedChildMessage?.message?.imageMessage
    || content.associatedChildMessage?.message?.image
    || null;
}

function cleanPhone(value) {
  if (!value) return '';
  const cleaned = String(value || '').replace(/\s/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.toLowerCase().endsWith('@g.us')) return cleaned;
  return cleaned.split('@')[0];
}

function extractTimestamp(source) {
  const value = source?.timestamp || source?.messageTimestamp || source?.moment || source?.createdAt || source?.dateTime;
  if (!value) return '';
  if (typeof value === 'number') {
    const milliseconds = value < 10000000000 ? value * 1000 : value;
    return new Date(milliseconds).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? '' : parsed.toISOString();
}
