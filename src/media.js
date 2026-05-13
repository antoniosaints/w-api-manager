const DOWNLOADABLE_TYPES = ['audio', 'video', 'document'];

export function findMessageImageSource(message) {
  if (!message || typeof message !== 'object') return '';
  const raw = message.raw || {};
  const rawImage = findVisualMediaMessage(raw);
  const image = hasMediaFields(rawImage) ? rawImage : normalizeVisualStoredMedia(raw.normalizedMedia) || {};
  if (message.direction === 'outbound' && isLocalMediaPath(message.mediaPath)) {
    return toImageSource(message.mediaPath, image.mimetype);
  }
  const localRawSource = [image.url, image.mediaUrl, image.link].find(isLocalMediaPath);
  if (localRawSource) return toImageSource(localRawSource, image.mimetype);
  if (message.id && image.url && image.mediaKey) return `/api/messages/${encodeURIComponent(message.id)}/media`;

  if (message.previewImage || (message.type === 'image' && message.previewMedia)) {
    return toImageSource(message.previewImage || message.previewMedia, image.mimetype);
  }

  const thumbnail = image.jpegThumbnail ? toImageSource(image.jpegThumbnail, image.mimetype) : '';
  if (thumbnail && isWhatsAppMediaUrl(message.mediaPath)) return thumbnail;

  const value = message.mediaPath
    || message.mediaUrl
    || thumbnail
    || image.url
    || image.mediaUrl
    || image.link
    || '';

  if (!value) return '';
  return toImageSource(value, image.mimetype);
}

export function getMessageMedia(message) {
  if (!message || typeof message !== 'object') return null;
  const type = normalizeMediaType(message.type);
  if (type === 'image' || type === 'sticker') {
    const src = findMessageImageSource(message);
    if (!src) return null;
    const rawMedia = findVisualMediaMessage(message.raw || {});
    return {
      type,
      src,
      mimeType: rawMedia.mimetype || rawMedia.mimeType || (type === 'sticker' ? 'image/webp' : 'image/jpeg'),
      fileName: rawMedia.fileName || '',
      size: toNumber(rawMedia.fileLength || rawMedia.size),
      duration: 0,
      caption: rawMedia.caption || '',
      encrypted: Boolean(message.id && rawMedia.url && rawMedia.mediaKey)
    };
  }

  const media = findMessageMedia(message);
  if (!media || !DOWNLOADABLE_TYPES.includes(media.type)) return null;

  const encrypted = Boolean(message.id && media.url && media.mediaKey);
  const src = encrypted
    ? `/api/messages/${encodeURIComponent(message.id)}/media`
    : message.previewMedia || message.mediaPath || media.url || media.mediaUrl || media.link || '';

  if (!src) return null;
  return {
    type: media.type,
    src,
    mimeType: media.mimetype || media.mimeType || '',
    fileName: media.fileName || media.filename || '',
    size: toNumber(media.size || media.fileLength || media.fileSize),
    duration: toNumber(media.duration || media.seconds || media.mediaDuration),
    caption: media.caption || '',
    encrypted
  };
}

function findVisualMediaMessage(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const content = raw.msgContent || raw.message || raw;
  const nested = content.message || {};
  return findImageMessage(raw)
    || content.stickerMessage
    || content.sticker
    || nested.stickerMessage
    || nested.sticker
    || content.associatedChildMessage?.message?.stickerMessage
    || content.associatedChildMessage?.message?.sticker
    || {};
}

function findMessageMedia(message) {
  const normalized = normalizeStoredMedia(message.raw?.normalizedMedia);
  if (normalized) return normalized;

  const raw = message.raw || {};
  const content = raw.msgContent || raw.message || raw.data?.msgContent || raw.data?.message || raw;
  const associated = content.associatedChildMessage?.message || {};
  const candidates = [
    ['audio', content.audioMessage || content.audio || associated.audioMessage || associated.audio],
    ['video', content.videoMessage || content.video || associated.videoMessage || associated.video],
    ['document', content.documentMessage || content.document || associated.documentMessage || associated.document]
  ];

  for (const [type, media] of candidates) {
    if (media && typeof media === 'object') return { type, ...media };
  }

  if (DOWNLOADABLE_TYPES.includes(normalizeMediaType(message.type)) && (message.mediaPath || message.previewMedia)) {
    return {
      type: normalizeMediaType(message.type),
      url: message.mediaPath || message.previewMedia || '',
      mimetype: message.raw?.normalizedMedia?.mimetype || ''
    };
  }

  return null;
}

function normalizeStoredMedia(media) {
  if (!media || typeof media !== 'object') return null;
  const type = normalizeMediaType(media.type);
  if (!type) return null;
  return {
    type,
    url: media.url || media.mediaUrl || media.link || '',
    mimetype: media.mimetype || media.mimeType || '',
    mediaKey: media.mediaKey || '',
    fileName: media.fileName || media.filename || '',
    size: toNumber(media.size || media.fileLength || media.fileSize),
    duration: toNumber(media.duration || media.seconds || media.mediaDuration),
    caption: media.caption || ''
  };
}

function findImageMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const content = raw.msgContent || raw.message || raw;
  const nested = content.message || {};
  return content.imageMessage
    || content.image
    || nested.imageMessage
    || nested.image
    || content.associatedChildMessage?.message?.imageMessage
    || content.associatedChildMessage?.message?.image
    || null;
}

function normalizeVisualStoredMedia(media) {
  const normalized = normalizeStoredMedia(media);
  if (!normalized || !['image', 'sticker'].includes(normalized.type)) return null;
  return normalized;
}

function hasMediaFields(media) {
  return Boolean(media && typeof media === 'object' && (
    media.url
    || media.mediaUrl
    || media.link
    || media.jpegThumbnail
    || media.mediaKey
  ));
}

function toImageSource(value, mimetype = 'image/jpeg') {
  const source = String(value || '');
  if (
    source.startsWith('data:image')
    || source.startsWith('http')
    || source.startsWith('blob:')
    || source.startsWith('/uploads/')
    || source.startsWith('/api/')
  ) return source;
  return `data:${mimetype || 'image/jpeg'};base64,${source}`;
}

function isWhatsAppMediaUrl(value) {
  return typeof value === 'string' && value.includes('mmg.whatsapp.net');
}

function isLocalMediaPath(value) {
  return typeof value === 'string' && value.startsWith('/uploads/');
}

function normalizeMediaType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'sticker') return 'sticker';
  if (['image', 'audio', 'video', 'document'].includes(type)) return type;
  return '';
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
