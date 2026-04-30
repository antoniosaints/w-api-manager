export const OUTBOUND_MEDIA_LIMITS = {
  image: 20 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  document: 25 * 1024 * 1024
};

const ACCEPTED_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp'],
  audio: ['mp3', 'ogg', 'wav', 'm4a', 'webm'],
  video: ['mp4', 'webm', 'mov'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip']
};

const ACCEPTED_MIME_PREFIXES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/webm'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ]
};

const MEDIA_LABELS = {
  image: 'Imagem',
  audio: 'Audio',
  video: 'Video',
  document: 'Documento'
};

export function normalizeOutboundMedia(input = {}) {
  const reference = String(input.dataUrl || input.url || input.value || '').trim();
  if (!reference) return null;

  const fileName = cleanFileName(input.name || input.fileName || defaultFileName(input.type));
  const extension = normalizeExtension(input.extension || fileName.split('.').pop());
  const mimeType = normalizeMimeType(input.mimeType || input.mimetype || mimeFromDataUrl(reference));
  const type = normalizeMediaType(input.type) || inferMediaType({ mimeType, extension });
  if (!type) {
    const error = new Error('Tipo de arquivo nao suportado para envio.');
    error.status = 400;
    throw error;
  }

  const size = Number(input.size || estimateReferenceBytes(reference) || 0);
  validateMedia({ type, mimeType, extension, size });

  return {
    type,
    reference,
    mimeType,
    fileName,
    extension,
    size
  };
}

export function validateMedia({ type, mimeType, extension, size }) {
  if (!OUTBOUND_MEDIA_LIMITS[type]) {
    const error = new Error('Tipo de midia nao suportado.');
    error.status = 400;
    throw error;
  }

  const extensionOk = !extension || ACCEPTED_EXTENSIONS[type]?.includes(extension);
  const mimeOk = !mimeType || ACCEPTED_MIME_PREFIXES[type]?.some((item) => cleanMime(mimeType) === item);
  if (!extensionOk || !mimeOk) {
    const error = new Error(`${MEDIA_LABELS[type]} com formato nao suportado.`);
    error.status = 400;
    throw error;
  }

  if (size > OUTBOUND_MEDIA_LIMITS[type]) {
    const error = new Error(`${MEDIA_LABELS[type]} excede o limite de ${formatBytes(OUTBOUND_MEDIA_LIMITS[type])}.`);
    error.status = 413;
    throw error;
  }
}

export function buildMediaRawMetadata(media) {
  if (!media) return null;
  return {
    type: media.type,
    url: media.publicPath || (String(media.reference || '').startsWith('http') ? media.reference : ''),
    mimetype: media.mimeType,
    fileName: media.fileName,
    size: media.size,
    duration: 0
  };
}

export function mediaFallbackText(type) {
  if (type === 'image') return 'Imagem enviada';
  if (type === 'audio') return 'Audio enviado';
  if (type === 'video') return 'Video enviado';
  if (type === 'document') return 'Documento enviado';
  return 'Mensagem enviada';
}

function inferMediaType({ mimeType, extension }) {
  const mime = cleanMime(mimeType);
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('application/') || mime.startsWith('text/')) return 'document';
  return Object.entries(ACCEPTED_EXTENSIONS).find(([, extensions]) => extensions.includes(extension))?.[0] || '';
}

function normalizeMediaType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ['image', 'audio', 'video', 'document'].includes(type) ? type : '';
}

function normalizeMimeType(value) {
  return cleanMime(value);
}

function cleanMime(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function normalizeExtension(value) {
  return String(value || '').replace(/^\./, '').trim().toLowerCase();
}

function cleanFileName(value) {
  const name = String(value || '').replace(/[\\/]/g, '').trim();
  return name || 'arquivo';
}

function defaultFileName(type) {
  if (type === 'image') return 'imagem.jpg';
  if (type === 'audio') return 'audio.ogg';
  if (type === 'video') return 'video.mp4';
  return 'documento';
}

function mimeFromDataUrl(value) {
  const match = String(value || '').match(/^data:([^;,]+)[;,]/);
  return match?.[1] || '';
}

function estimateReferenceBytes(value) {
  const text = String(value || '');
  if (!text.startsWith('data:')) return 0;
  const base64 = text.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

function formatBytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
