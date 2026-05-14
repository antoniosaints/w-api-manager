import crypto from 'node:crypto';

const MEDIA_INFO = {
  image: 'WhatsApp Image Keys',
  sticker: 'WhatsApp Image Keys',
  video: 'WhatsApp Video Keys',
  audio: 'WhatsApp Audio Keys',
  document: 'WhatsApp Document Keys',
  application: 'WhatsApp Document Keys'
};
const WHATSAPP_MEDIA_HOST = 'https://mmg.whatsapp.net';

export function extractWhatsAppImageInfo(raw) {
  const info = extractMessageMediaInfo(raw, { requireMediaKey: true, visualOnly: true });
  if (!info) return null;
  return {
    url: info.url,
    mimetype: info.mimetype,
    mediaKey: info.mediaKey
  };
}

export function extractWhatsAppMediaInfo(raw) {
  return extractMessageMediaInfo(raw, { requireMediaKey: true });
}

export function extractMessageMediaInfo(raw, options = {}) {
  const found = findMediaMessage(raw, options);
  const media = found?.media;
  const type = found?.type || inferMediaType(media);
  const url = resolveMediaUrl(media, type);
  if (!media || !url) return null;
  if (options.requireMediaKey && !media.mediaKey) return null;

  return {
    type,
    url,
    ...(media.directPath ? { directPath: media.directPath } : {}),
    mimetype: media.mimetype || media.mimeType || defaultMimetype(type),
    mediaKey: media.mediaKey || '',
    fileName: media.fileName || media.filename || media.title || '',
    size: toNumber(media.fileLength ?? media.fileSize ?? media.size),
    duration: toNumber(media.seconds ?? media.duration ?? media.mediaDuration)
  };
}

export async function downloadAndDecryptWhatsAppMedia(raw) {
  const info = extractWhatsAppMediaInfo(raw);
  if (!info) {
    const error = new Error('Midia nao encontrada no payload.');
    error.status = 404;
    throw error;
  }

  const response = await fetch(info.url);
  if (!response.ok) {
    const error = new Error(`Falha ao baixar midia do WhatsApp (${response.status}).`);
    error.status = 502;
    throw error;
  }

  const encrypted = Buffer.from(await response.arrayBuffer());
  return {
    mimetype: info.mimetype,
    fileName: info.fileName,
    buffer: decryptWhatsAppMedia(encrypted, info.mediaKey, info.mimetype)
  };
}

export function downloadAndDecryptWhatsAppImage(raw) {
  return downloadAndDecryptWhatsAppMedia(raw);
}

export function decryptWhatsAppMedia(encryptedPayload, mediaKey, mimetype = 'image/jpeg') {
  const encrypted = Buffer.from(encryptedPayload);
  const key = Buffer.isBuffer(mediaKey) ? mediaKey : Buffer.from(mediaKey, 'base64');
  const mediaType = normalizeMediaTypeFromMime(mimetype);
  const info = MEDIA_INFO[mediaType] || MEDIA_INFO.image;
  const expanded = crypto.hkdfSync('sha256', key, Buffer.alloc(32), Buffer.from(info), 112);
  const keys = Buffer.from(expanded);
  const iv = keys.subarray(0, 16);
  const cipherKey = keys.subarray(16, 48);
  const macKey = keys.subarray(48, 80);
  const ciphertext = encrypted.subarray(0, -10);
  const mac = encrypted.subarray(-10);
  const expectedMac = crypto.createHmac('sha256', macKey).update(Buffer.concat([iv, ciphertext])).digest().subarray(0, 10);

  if (mac.length === 10 && !crypto.timingSafeEqual(mac, expectedMac)) {
    const error = new Error('Assinatura da midia invalida.');
    error.status = 422;
    throw error;
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function findMediaMessage(raw, options = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const roots = [
    raw.data,
    raw.msgContent,
    raw.message,
    raw
  ].filter((item) => item && typeof item === 'object');

  for (const root of roots) {
    const content = root.msgContent || root.message || root;
    const associated = content.associatedChildMessage?.message || {};
    const candidates = [
      ['image', content.imageMessage || content.image || associated.imageMessage || associated.image],
      ['sticker', content.stickerMessage || content.sticker || associated.stickerMessage || associated.sticker],
      ['audio', content.audioMessage || content.audio || associated.audioMessage || associated.audio],
      ['video', content.videoMessage || content.video || associated.videoMessage || associated.video],
      ['document', content.documentMessage || content.document || associated.documentMessage || associated.document]
    ];

    for (const [type, media] of candidates) {
      if (media && typeof media === 'object') {
        if (options.visualOnly && !['image', 'sticker'].includes(type)) continue;
        return { type, media };
      }
    }
  }

  return null;
}

function resolveMediaUrl(media, type = '') {
  if (!media || typeof media !== 'object') return '';
  const url = [media.url, media.mediaUrl, media.link].find((value) => typeof value === 'string' && value.trim()) || '';
  if (url && !isGenericWhatsAppUrl(url, type)) return url;
  return buildWhatsAppDirectPathUrl(media.directPath) || url;
}

function buildWhatsAppDirectPathUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const path = value.trim();
  if (path.startsWith('http')) return path;
  return `${WHATSAPP_MEDIA_HOST}${path.startsWith('/') ? path : `/${path}`}`;
}

function isGenericWhatsAppUrl(value, type = '') {
  try {
    const url = new URL(value);
    const isRoot = url.pathname === '' || url.pathname === '/';
    if (!isRoot) return false;
    if (url.hostname === 'web.whatsapp.net') return true;
    return type === 'sticker' && url.hostname === 'a.whatsapp.net';
  } catch {
    return false;
  }
}

function inferMediaType(media) {
  const mime = String(media?.mimetype || media?.mimeType || '').split(';')[0].trim();
  return normalizeMediaTypeFromMime(mime);
}

function normalizeMediaTypeFromMime(mimetype) {
  const primary = String(mimetype || '').split(';')[0].split('/')[0].trim().toLowerCase();
  if (primary === 'image') return 'image';
  if (primary === 'audio') return 'audio';
  if (primary === 'video') return 'video';
  if (primary === 'application' || primary === 'text') return 'document';
  return primary || 'image';
}

function defaultMimetype(type) {
  if (type === 'audio') return 'audio/ogg';
  if (type === 'video') return 'video/mp4';
  if (type === 'document') return 'application/octet-stream';
  return 'image/jpeg';
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
