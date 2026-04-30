import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { persistOutboundMediaReference } from '../server/outbound-storage.js';

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
