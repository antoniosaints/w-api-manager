const CROP_RATIO_MAP = {
  original: null,
  square: 1,
  portrait: 4 / 5,
  landscape: 16 / 9
};

export const IMAGE_CROP_PRESETS = [
  { value: 'original', label: 'Original' },
  { value: 'square', label: 'Quadrado 1:1' },
  { value: 'portrait', label: 'Retrato 4:5' },
  { value: 'landscape', label: 'Paisagem 16:9' }
];

export const IMAGE_MAX_SIDE_PRESETS = [
  { value: 'original', label: 'Tamanho original' },
  { value: '1600', label: '1600 px' },
  { value: '1200', label: '1200 px' },
  { value: '1080', label: '1080 px' },
  { value: '720', label: '720 px' }
];

export async function loadImageDescriptor(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    return {
      width: image.naturalWidth || image.width || 0,
      height: image.naturalHeight || image.height || 0,
      previewUrl: objectUrl
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function buildEditedImageFile(file, { cropPreset = 'original', maxSide = 'original' } = {}) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    const sourceWidth = image.naturalWidth || image.width || 1;
    const sourceHeight = image.naturalHeight || image.height || 1;
    const crop = resolveCenteredCrop(sourceWidth, sourceHeight, cropPreset);
    const sideLimit = parseSideLimit(maxSide);
    const scale = sideLimit ? Math.min(1, sideLimit / Math.max(crop.width, crop.height)) : 1;
    const outputWidth = Math.max(1, Math.round(crop.width * scale));
    const outputHeight = Math.max(1, Math.round(crop.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Nao foi possivel editar a imagem selecionada.');
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputWidth, outputHeight);

    const type = resolveOutputMimeType(file.type);
    const blob = await canvasToBlob(canvas, type, type === 'image/png' ? undefined : 0.92);
    const extension = file.name.split('.').pop()?.toLowerCase() || mimeToExtension(type);
    return new File([blob], file.name || `imagem-editada.${extension}`, { type });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function resolveCenteredCrop(width, height, cropPreset = 'original') {
  const ratio = CROP_RATIO_MAP[cropPreset] ?? null;
  if (!ratio) {
    return { x: 0, y: 0, width, height };
  }

  const sourceRatio = width / height;
  if (sourceRatio > ratio) {
    const cropWidth = Math.round(height * ratio);
    return {
      x: Math.max(0, Math.round((width - cropWidth) / 2)),
      y: 0,
      width: cropWidth,
      height
    };
  }

  const cropHeight = Math.round(width / ratio);
  return {
    x: 0,
    y: Math.max(0, Math.round((height - cropHeight) / 2)),
    width,
    height: cropHeight
  };
}

export function describeOutputDimensions(width, height, cropPreset = 'original', maxSide = 'original') {
  const crop = resolveCenteredCrop(width, height, cropPreset);
  const sideLimit = parseSideLimit(maxSide);
  const scale = sideLimit ? Math.min(1, sideLimit / Math.max(crop.width, crop.height)) : 1;
  return {
    width: Math.max(1, Math.round(crop.width * scale)),
    height: Math.max(1, Math.round(crop.height * scale)),
    cropWidth: crop.width,
    cropHeight: crop.height
  };
}

function parseSideLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function resolveOutputMimeType(type) {
  const clean = String(type || '').split(';')[0].trim().toLowerCase();
  if (clean === 'image/png' || clean === 'image/webp') return clean;
  return 'image/jpeg';
}

function mimeToExtension(type) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }[String(type || '').toLowerCase()] || 'jpg';
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem selecionada.'));
    image.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Nao foi possivel gerar a imagem editada.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}
