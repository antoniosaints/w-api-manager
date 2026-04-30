export const MEDIA_FILE_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/mp4',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.mp3',
  '.ogg',
  '.wav',
  '.m4a',
  '.mp4',
  '.webm',
  '.mov',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
  '.zip'
].join(',');

export const MEDIA_RULES = {
  image: {
    label: 'Imagem',
    maxBytes: 35 * 1024 * 1024,
    sendMaxBytes: 20 * 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp']
  },
  audio: {
    label: 'Audio',
    maxBytes: 16 * 1024 * 1024,
    sendMaxBytes: 16 * 1024 * 1024,
    extensions: ['mp3', 'ogg', 'wav', 'm4a', 'webm'],
    mimes: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/webm']
  },
  video: {
    label: 'Video',
    maxBytes: 50 * 1024 * 1024,
    sendMaxBytes: 50 * 1024 * 1024,
    extensions: ['mp4', 'webm', 'mov'],
    mimes: ['video/mp4', 'video/webm', 'video/quicktime']
  },
  document: {
    label: 'Documento',
    maxBytes: 25 * 1024 * 1024,
    sendMaxBytes: 25 * 1024 * 1024,
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'],
    mimes: [
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
  }
};

const IMAGE_COMPRESSION_THRESHOLD = 4 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1800;
const IMAGE_QUALITY = 0.82;

export function validateMediaFile(file) {
  const type = detectMediaType(file);
  if (!type) {
    return { valid: false, message: 'Formato de arquivo nao suportado.' };
  }

  const rule = MEDIA_RULES[type];
  if (file.size > rule.maxBytes) {
    return {
      valid: false,
      message: `${rule.label} excede o limite de ${formatBytes(rule.maxBytes)}.`
    };
  }

  const extension = getFileExtension(file.name);
  const mime = cleanMime(file.type);
  const extensionOk = !extension || rule.extensions.includes(extension);
  const mimeOk = !mime || rule.mimes.includes(mime);
  if (!extensionOk || !mimeOk) {
    return { valid: false, message: `${rule.label} com formato nao suportado.` };
  }

  return { valid: true, type, rule };
}

export async function prepareMediaFile(file, { onProgress } = {}) {
  const result = validateMediaFile(file);
  if (!result.valid) throw new Error(result.message);

  let output = file;
  let compressed = false;
  if (result.type === 'image' && file.size > IMAGE_COMPRESSION_THRESHOLD) {
    onProgress?.(12);
    const next = await compressImage(file);
    if (next && next.size < file.size) {
      output = next;
      compressed = true;
    }
  }

  const dataUrl = await readBlobAsDataUrl(output, onProgress);
  const bytes = estimateDataUrlBytes(dataUrl) || output.size;
  if (bytes > result.rule.sendMaxBytes) {
    throw new Error(`${result.rule.label} ainda esta acima de ${formatBytes(result.rule.sendMaxBytes)} apos o preparo.`);
  }

  return {
    type: result.type,
    name: file.name,
    mimeType: output.type || file.type,
    size: bytes,
    dataUrl,
    extension: getFileExtension(file.name),
    compressed
  };
}

export function detectMediaType(fileOrMime, fallbackName = '') {
  const mime = cleanMime(typeof fileOrMime === 'string' ? fileOrMime : fileOrMime?.type);
  const extension = getFileExtension(typeof fileOrMime === 'string' ? fallbackName : fileOrMime?.name);

  for (const [type, rule] of Object.entries(MEDIA_RULES)) {
    if (mime && rule.mimes.includes(mime)) return type;
    if (extension && rule.extensions.includes(extension)) return type;
  }
  return '';
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', IMAGE_QUALITY);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function readBlobAsDataUrl(blob, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.min(96, 20 + Math.round((event.loaded / event.total) * 76)));
      }
    };
    reader.onload = () => {
      onProgress?.(100);
      resolve(String(reader.result || ''));
    };
    reader.onerror = () => reject(reader.error || new Error('Nao foi possivel ler o arquivo.'));
    reader.readAsDataURL(blob);
  });
}

function estimateDataUrlBytes(value) {
  const base64 = String(value || '').split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

function getFileExtension(name) {
  return String(name || '').split('.').pop()?.toLowerCase() || '';
}

function cleanMime(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}
