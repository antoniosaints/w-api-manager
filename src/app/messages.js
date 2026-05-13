export function mergeMessageUpdate(items, item) {
  const index = items.findIndex((current) => isSameMessageUpdate(current, item));
  if (index === -1) return [...items, item];
  return items.map((current, currentIndex) => (
    currentIndex === index ? mergeMessage(current, item) : current
  ));
}

function isSameMessageUpdate(current, item) {
  return current.id === item.id
    || (current.externalId && item.externalId && current.externalId === item.externalId);
}

function mergeMessage(current, item) {
  const keepLocalMediaPath = shouldKeepLocalOutboundPreview(current, item);
  const mediaPath = keepLocalMediaPath ? current.mediaPath : item.mediaPath ?? current.mediaPath;
  return {
    ...current,
    ...item,
    mediaPath,
    raw: mergeMessageRaw(current.raw, item.raw, keepLocalMediaPath ? current.mediaPath : '')
  };
}

function mergeMessageRaw(currentRaw = {}, nextRaw = {}, preservedMediaPath = '') {
  const mergedRaw = {
    ...(currentRaw && typeof currentRaw === 'object' ? currentRaw : {}),
    ...(nextRaw && typeof nextRaw === 'object' ? nextRaw : {})
  };
  const currentMedia = currentRaw?.normalizedMedia && typeof currentRaw.normalizedMedia === 'object'
    ? currentRaw.normalizedMedia
    : {};
  const nextMedia = nextRaw?.normalizedMedia && typeof nextRaw.normalizedMedia === 'object'
    ? nextRaw.normalizedMedia
    : {};
  const normalizedMedia = {
    ...currentMedia,
    ...nextMedia
  };

  if (preservedMediaPath && normalizedMedia.type) {
    normalizedMedia.url = preservedMediaPath;
  }

  if (Object.keys(normalizedMedia).length) mergedRaw.normalizedMedia = normalizedMedia;
  return mergedRaw;
}

function shouldKeepLocalOutboundPreview(current = {}, item = {}) {
  return current.direction === 'outbound'
    && ['image', 'sticker'].includes(current.type)
    && isLocalUploadPath(current.mediaPath)
    && !isLocalUploadPath(item.mediaPath);
}

function isLocalUploadPath(value) {
  return typeof value === 'string' && value.startsWith('/uploads/');
}
