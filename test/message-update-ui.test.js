import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeMessageUpdate } from '../src/app/messages.js';
import { getMessageMedia } from '../src/media.js';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

test('message updates replace existing local bubbles by id or external id', () => {
  assert.match(mainSource, /mergeMessageUpdate/);
  assert.match(mainSource, /externalId/);
  assert.doesNotMatch(mainSource, /setMessages\(\(current\) => appendUnique\(current, message\)\)/);
});

test('dev server proxies uploaded media paths used by chat previews', () => {
  assert.match(viteConfig, /['"]\/uploads['"]/);
});

test('message updates keep local outbound image preview when later status payload has no renderable path', () => {
  const current = {
    id: 'local-image',
    externalId: 'wapi-image-1',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    mediaPath: '/uploads/outbound/local-image.jpg',
    raw: {
      normalizedMedia: {
        type: 'image',
        url: '/uploads/outbound/local-image.jpg',
        mimetype: 'image/jpeg'
      }
    }
  };
  const update = {
    id: 'local-image',
    externalId: 'wapi-image-1',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    mediaPath: null,
    raw: {
      normalizedMedia: {
        type: 'image',
        url: 'https://mmg.whatsapp.net/v/t62/image.enc',
        mimetype: 'image/jpeg',
        mediaKey: 'remote-key'
      }
    }
  };

  const [merged] = mergeMessageUpdate([current], update);

  assert.equal(merged.mediaPath, '/uploads/outbound/local-image.jpg');
  assert.equal(merged.raw.normalizedMedia.url, '/uploads/outbound/local-image.jpg');
  assert.equal(merged.raw.normalizedMedia.mediaKey, 'remote-key');
  assert.equal(getMessageMedia(merged).src, '/uploads/outbound/local-image.jpg');
});
