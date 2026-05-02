import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOAD_DIR = path.resolve(process.env.WAPI_UPLOAD_DIR || 'uploads');
const OUTBOUND_DIR = path.join(UPLOAD_DIR, 'outbound');

export function persistOutboundMediaReference(media = {}) {
  const reference = String(media.reference || '').trim();
  if (!reference) return { ...media, reference: '', publicPath: '' };
  if (!reference.startsWith('data:')) {
    return { ...media, publicPath: reference, relativePath: reference };
  }
  if (media.publicPath && media.relativePath) {
    return {
      ...media,
      publicPath: media.publicPath,
      relativePath: media.relativePath,
      mimeType: cleanMimeType(media.mimeType)
    };
  }

  const parsed = parseDataUrl(reference);
  const extension = cleanExtension(media.extension) || extensionFromMime(parsed.mimeType) || 'bin';
  const fileName = `${randomUUID()}.${extension}`;
  fs.mkdirSync(OUTBOUND_DIR, { recursive: true });
  const absolutePath = path.join(OUTBOUND_DIR, fileName);
  fs.writeFileSync(absolutePath, parsed.buffer);

  const publicPath = `/uploads/outbound/${fileName}`;
  return {
    ...media,
    reference,
    publicPath,
    relativePath: publicPath,
    mimeType: cleanMimeType(media.mimeType || parsed.mimeType)
  };
}

export function persistOutboundMediaBuffer(media = {}, buffer = Buffer.alloc(0)) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error('Arquivo de midia vazio.');
    error.status = 400;
    throw error;
  }

  const extension = cleanExtension(media.extension) || extensionFromMime(media.mimeType) || 'bin';
  const mimeType = cleanMimeType(media.mimeType || extensionToMime(extension));
  const uploadId = `${randomUUID()}.${extension}`;
  fs.mkdirSync(OUTBOUND_DIR, { recursive: true });
  const absolutePath = path.join(OUTBOUND_DIR, uploadId);
  fs.writeFileSync(absolutePath, buffer);

  const publicPath = `/uploads/outbound/${uploadId}`;
  return {
    ...media,
    uploadId,
    reference: publicPath,
    publicPath,
    relativePath: publicPath,
    fileName: cleanFileName(media.fileName || media.name || uploadId),
    mimeType,
    extension,
    size: buffer.length
  };
}

export function loadOutboundUploadAsDataUrl(media = {}) {
  const uploadId = cleanUploadId(media.uploadId || media.reference || media.publicPath);
  if (!uploadId) {
    const error = new Error('Upload de midia nao informado.');
    error.status = 400;
    throw error;
  }

  const absolutePath = resolveOutboundUploadPath(uploadId);
  if (!fs.existsSync(absolutePath)) {
    const error = new Error('Upload de midia nao encontrado ou expirado.');
    error.status = 404;
    throw error;
  }

  const buffer = fs.readFileSync(absolutePath);
  const extension = cleanExtension(media.extension || uploadId.split('.').pop());
  const mimeType = cleanMimeType(media.mimeType || extensionToMime(extension));
  const publicPath = `/uploads/outbound/${uploadId}`;
  return {
    ...media,
    uploadId,
    reference: `data:${mimeType};base64,${buffer.toString('base64')}`,
    publicPath,
    relativePath: publicPath,
    fileName: cleanFileName(media.fileName || media.name || uploadId),
    mimeType,
    extension,
    size: buffer.length
  };
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:([^,]*?),(.*)$/s);
  if (!match) {
    const error = new Error('Midia em base64 invalida.');
    error.status = 400;
    throw error;
  }
  const meta = String(match[1] || '').split(';').map((item) => item.trim()).filter(Boolean);
  const mimeType = cleanMimeType(meta.find((item) => item.includes('/')) || 'application/octet-stream');
  const isBase64 = meta.some((item) => item.toLowerCase() === 'base64');
  const payload = match[2] || '';
  return {
    mimeType,
    buffer: isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload))
  };
}

function cleanMimeType(value) {
  return String(value || 'application/octet-stream').split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}

function extensionFromMime(mimeType) {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'audio/ogg') return 'ogg';
  if (mime === 'audio/webm') return 'webm';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3';
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return 'wav';
  if (mime === 'audio/mp4' || mime === 'audio/m4a') return 'm4a';
  if (mime === 'video/mp4') return 'mp4';
  if (mime === 'video/webm') return 'webm';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'application/msword') return 'doc';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mime === 'application/vnd.ms-excel') return 'xls';
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (mime === 'text/plain') return 'txt';
  if (mime === 'text/csv') return 'csv';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'zip';
  return '';
}

function cleanExtension(value) {
  return String(value || '').replace(/^\./, '').trim().toLowerCase();
}

function cleanUploadId(value) {
  const text = String(value || '').replace(/^\/uploads\/outbound\//, '').trim();
  const name = path.basename(text);
  return /^[a-f0-9-]+\.[a-z0-9]+$/i.test(name) ? name : '';
}

function resolveOutboundUploadPath(uploadId) {
  const absolutePath = path.resolve(OUTBOUND_DIR, uploadId);
  const root = path.resolve(OUTBOUND_DIR);
  if (absolutePath !== root && absolutePath.startsWith(`${root}${path.sep}`)) {
    return absolutePath;
  }
  const error = new Error('Upload de midia invalido.');
  error.status = 400;
  throw error;
}

function cleanFileName(value) {
  return String(value || '').replace(/[\\/]/g, '').trim() || 'arquivo';
}

function extensionToMime(extension) {
  const ext = cleanExtension(extension);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'xls') return 'application/vnd.ms-excel';
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'zip') return 'application/zip';
  return 'application/octet-stream';
}
