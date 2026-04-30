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
  return '';
}

function cleanExtension(value) {
  return String(value || '').replace(/^\./, '').trim().toLowerCase();
}
