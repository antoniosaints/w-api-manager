import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
const WAPI_AUDIO_EXTENSIONS = ['mp3', 'ogg'];
const WAPI_AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/ogg'];

export async function prepareAudioForWapi(media = {}, options = {}) {
  if (media.type !== 'audio') return media;
  if (isWapiAudioCompatible(media)) return media;

  if (String(media.reference || '').startsWith('data:')) {
    const transcode = options.transcode || transcodeAudioDataUrlToOgg;
    return transcode(media);
  }

  const error = new Error('Formato de audio invalido. A W-API aceita apenas audio MP3 ou OGG por base64 ou URL.');
  error.status = 400;
  throw error;
}

async function transcodeAudioDataUrlToOgg(media = {}) {
  const parsed = parseDataUrl(media.reference);
  const inputExtension = extensionFromMime(parsed.mimeType) || cleanExtension(media.extension) || 'audio';
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wapi-audio-'));
  const inputPath = path.join(workDir, `input.${inputExtension}`);
  const outputPath = path.join(workDir, 'output.ogg');

  try {
    await fs.writeFile(inputPath, parsed.buffer);
    await execFileAsync(resolveFfmpegPath(), [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-acodec',
      'libopus',
      '-b:a',
      '32k',
      '-ar',
      '48000',
      outputPath
    ], { windowsHide: true });
    const output = await fs.readFile(outputPath);
    return {
      ...media,
      reference: `data:audio/ogg;base64,${output.toString('base64')}`,
      mimeType: 'audio/ogg',
      extension: 'ogg',
      fileName: replaceExtension(media.fileName || media.name || 'audio-gravado.webm', 'ogg'),
      size: output.length
    };
  } catch (cause) {
    const error = new Error('Nao foi possivel converter o audio gravado para OGG antes do envio. Verifique se o ffmpeg esta instalado no servidor.');
    error.status = 500;
    error.cause = cause;
    throw error;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

function isWapiAudioCompatible(media = {}) {
  const extension = cleanExtension(media.extension || String(media.fileName || '').split('.').pop());
  const mimeType = cleanMime(media.mimeType || mimeFromDataUrl(media.reference));
  return WAPI_AUDIO_EXTENSIONS.includes(extension) || WAPI_AUDIO_MIMES.includes(mimeType);
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:([^,]*?),(.*)$/s);
  if (!match) {
    const error = new Error('Midia em base64 invalida.');
    error.status = 400;
    throw error;
  }
  const meta = String(match[1] || '').split(';').map((item) => item.trim()).filter(Boolean);
  return {
    mimeType: cleanMime(meta.find((item) => item.includes('/')) || 'application/octet-stream'),
    buffer: meta.some((item) => item.toLowerCase() === 'base64')
      ? Buffer.from(match[2] || '', 'base64')
      : Buffer.from(decodeURIComponent(match[2] || ''))
  };
}

function resolveFfmpegPath() {
  return process.env.FFMPEG_PATH || process.env.WAPI_FFMPEG_PATH || ffmpegPath || 'ffmpeg';
}

function mimeFromDataUrl(value) {
  const match = String(value || '').match(/^data:([^;,]+)[;,]/);
  return match?.[1] || '';
}

function extensionFromMime(value) {
  const mime = cleanMime(value);
  if (mime === 'audio/webm') return 'webm';
  if (mime === 'audio/ogg') return 'ogg';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3';
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return 'wav';
  if (mime === 'audio/mp4' || mime === 'audio/m4a') return 'm4a';
  return '';
}

function replaceExtension(fileName, extension) {
  const clean = String(fileName || 'audio-gravado').replace(/[\\/]/g, '').trim() || 'audio-gravado';
  return `${clean.replace(/\.[^.]+$/, '')}.${extension}`;
}

function cleanExtension(value) {
  return String(value || '').replace(/^\./, '').trim().toLowerCase();
}

function cleanMime(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}
