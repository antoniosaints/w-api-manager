import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  loadOutboundUploadAsDataUrl,
  persistOutboundMediaBuffer,
  persistOutboundMediaReference
} from '../server/outbound-storage.js';

test('persists outbound data url media to a renderable uploads path', () => {
  const stored = persistOutboundMediaReference({
    type: 'image',
    reference: 'data:image/png;base64,aGVsbG8=',
    fileName: 'comprovante.png',
    extension: 'png',
    mimeType: 'image/png'
  });
  const absolutePath = path.join(process.env.WAPI_UPLOAD_DIR, stored.relativePath.replace(/^\/uploads\//, ''));

  assert.equal(stored.reference, 'data:image/png;base64,aGVsbG8=');
  assert.match(stored.publicPath, /^\/uploads\/outbound\/.+\.png$/);
  assert.equal(stored.mimeType, 'image/png');
  assert.equal(existsSync(absolutePath), true);
  assert.equal(readFileSync(absolutePath, 'utf8'), 'hello');
});

test('persists recorder audio data urls with codec parameters', () => {
  const stored = persistOutboundMediaReference({
    type: 'audio',
    reference: 'data:audio/webm;codecs=opus;base64,aGVsbG8=',
    fileName: 'gravacao.webm',
    mimeType: 'audio/webm;codecs=opus'
  });
  const absolutePath = path.join(process.env.WAPI_UPLOAD_DIR, stored.relativePath.replace(/^\/uploads\//, ''));

  assert.match(stored.publicPath, /^\/uploads\/outbound\/.+\.webm$/);
  assert.equal(stored.mimeType, 'audio/webm');
  assert.equal(existsSync(absolutePath), true);
  assert.equal(readFileSync(absolutePath, 'utf8'), 'hello');
});

test('leaves remote outbound media references untouched', () => {
  const stored = persistOutboundMediaReference({
    type: 'audio',
    reference: 'https://cdn.example.test/audio.ogg',
    fileName: 'audio.ogg',
    extension: 'ogg',
    mimeType: 'audio/ogg'
  });

  assert.equal(stored.reference, 'https://cdn.example.test/audio.ogg');
  assert.equal(stored.publicPath, 'https://cdn.example.test/audio.ogg');
});

test('persists binary outbound uploads and reloads them as data urls for W-API', () => {
  const stored = persistOutboundMediaBuffer({
    type: 'document',
    fileName: 'contrato.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf'
  }, Buffer.from('%PDF-fake'));
  const absolutePath = path.join(process.env.WAPI_UPLOAD_DIR, stored.relativePath.replace(/^\/uploads\//, ''));
  const loaded = loadOutboundUploadAsDataUrl(stored);

  assert.match(stored.uploadId, /^[a-f0-9-]+\.pdf$/);
  assert.match(stored.publicPath, /^\/uploads\/outbound\/.+\.pdf$/);
  assert.equal(existsSync(absolutePath), true);
  assert.equal(readFileSync(absolutePath, 'utf8'), '%PDF-fake');
  assert.equal(loaded.reference, `data:application/pdf;base64,${Buffer.from('%PDF-fake').toString('base64')}`);
  assert.equal(loaded.publicPath, stored.publicPath);
  assert.equal(loaded.size, 9);
});
