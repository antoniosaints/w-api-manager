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

test('message updates keep fallback preview image when mediaPath is absent', () => {
  const current = {
    id: 'preview-image',
    externalId: 'wapi-image-2',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    mediaPath: null,
    previewImage: '/uploads/outbound/preview-image.jpg',
    previewMedia: '/uploads/outbound/preview-image.jpg'
  };
  const update = {
    id: 'preview-image',
    externalId: 'wapi-image-2',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    mediaPath: null,
    previewImage: '',
    previewMedia: '',
    raw: {
      normalizedMedia: {
        type: 'image',
        url: '',
        mimetype: 'image/jpeg'
      }
    }
  };

  const [merged] = mergeMessageUpdate([current], update);

  assert.equal(merged.previewImage, '/uploads/outbound/preview-image.jpg');
  assert.equal(merged.previewMedia, '/uploads/outbound/preview-image.jpg');
  assert.equal(getMessageMedia(merged).src, '/uploads/outbound/preview-image.jpg');
});

test('message updates keep raw local image preview when status update has no local source', () => {
  const current = {
    id: 'raw-image',
    externalId: 'wapi-image-3',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    mediaPath: null,
    raw: {
      normalizedMedia: {
        type: 'image',
        url: '/uploads/outbound/raw-image.jpg',
        mimetype: 'image/jpeg'
      }
    }
  };
  const update = {
    id: 'raw-image',
    externalId: 'wapi-image-3',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    raw: {
      normalizedMedia: {
        type: 'image',
        url: '',
        mimetype: 'image/jpeg',
        mediaKey: 'status-key'
      }
    }
  };

  const [merged] = mergeMessageUpdate([current], update);

  assert.equal(merged.raw.normalizedMedia.url, '/uploads/outbound/raw-image.jpg');
  assert.equal(merged.raw.normalizedMedia.mediaKey, 'status-key');
  assert.equal(getMessageMedia(merged).src, '/uploads/outbound/raw-image.jpg');
});
