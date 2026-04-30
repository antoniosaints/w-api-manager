import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { decryptWhatsAppMedia, extractWhatsAppImageInfo, extractWhatsAppMediaInfo } from '../server/media.js';

test('extracts associated child WhatsApp image metadata', () => {
  const info = extractWhatsAppImageInfo({
    msgContent: {
      associatedChildMessage: {
        message: {
          imageMessage: {
            url: 'https://mmg.whatsapp.net/o1/v/t24/f2/image',
            mimetype: 'image/jpeg',
            mediaKey: 'abc',
            fileLength: '123'
          }
        }
      }
    }
  });

  assert.deepEqual(info, {
    url: 'https://mmg.whatsapp.net/o1/v/t24/f2/image',
    mimetype: 'image/jpeg',
    mediaKey: 'abc'
  });
});

test('extracts W-API sticker metadata as decryptable media', () => {
  const info = extractWhatsAppImageInfo({
    msgContent: {
      stickerMessage: {
        url: 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc',
        mimetype: 'image/webp',
        mediaKey: 'abc',
        fileLength: '23648'
      }
    }
  });

  assert.deepEqual(info, {
    url: 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc',
    mimetype: 'image/webp',
    mediaKey: 'abc'
  });
});

test('extracts W-API sticker directPath when url is generic web WhatsApp', () => {
  const info = extractWhatsAppImageInfo({
    msgContent: {
      stickerMessage: {
        url: 'https://web.whatsapp.net',
        directPath: '/v/t62.15575-24/sticker.enc?ccb=11-4&oh=token',
        mimetype: 'image/webp',
        mediaKey: 'abc',
        fileLength: '387246'
      }
    }
  });

  assert.deepEqual(info, {
    url: 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc?ccb=11-4&oh=token',
    mimetype: 'image/webp',
    mediaKey: 'abc'
  });
});

test('extracts W-API audio metadata as decryptable media', () => {
  const info = extractWhatsAppMediaInfo({
    msgContent: {
      audioMessage: {
        url: 'https://mmg.whatsapp.net/v/t62/audio.enc',
        mimetype: 'audio/ogg',
        mediaKey: 'abc',
        fileLength: '23648',
        seconds: 11
      }
    }
  });

  assert.deepEqual(info, {
    type: 'audio',
    url: 'https://mmg.whatsapp.net/v/t62/audio.enc',
    mimetype: 'audio/ogg',
    mediaKey: 'abc',
    fileName: '',
    size: 23648,
    duration: 11
  });
});

test('extracts W-API document metadata with file name', () => {
  const info = extractWhatsAppMediaInfo({
    msgContent: {
      documentMessage: {
        url: 'https://mmg.whatsapp.net/v/t62/document.enc',
        mimetype: 'application/pdf',
        mediaKey: 'abc',
        fileName: 'contrato.pdf',
        fileLength: '98765'
      }
    }
  });

  assert.equal(info.type, 'document');
  assert.equal(info.fileName, 'contrato.pdf');
  assert.equal(info.size, 98765);
});

test('decrypts WhatsApp image media payloads', () => {
  const mediaKey = crypto.randomBytes(32);
  const plaintext = Buffer.from('fake image bytes');
  const encrypted = encryptFixture(plaintext, mediaKey);

  assert.deepEqual(decryptWhatsAppMedia(encrypted, mediaKey.toString('base64'), 'image/jpeg'), plaintext);
});

test('decrypts WhatsApp sticker media payloads with image keys', () => {
  const mediaKey = crypto.randomBytes(32);
  const plaintext = Buffer.from('fake sticker webp bytes');
  const encrypted = encryptFixture(plaintext, mediaKey);

  assert.deepEqual(decryptWhatsAppMedia(encrypted, mediaKey.toString('base64'), 'image/webp'), plaintext);
});

test('decrypts WhatsApp audio media payloads with audio keys', () => {
  const mediaKey = crypto.randomBytes(32);
  const plaintext = Buffer.from('fake audio bytes');
  const encrypted = encryptFixture(plaintext, mediaKey, 'WhatsApp Audio Keys');

  assert.deepEqual(decryptWhatsAppMedia(encrypted, mediaKey.toString('base64'), 'audio/ogg'), plaintext);
});

function encryptFixture(plaintext, mediaKey, info = 'WhatsApp Image Keys') {
  const expanded = crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(info), 112);
  const keys = Buffer.from(expanded);
  const iv = keys.subarray(0, 16);
  const cipherKey = keys.subarray(16, 48);
  const macKey = keys.subarray(48, 80);
  const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const mac = crypto.createHmac('sha256', macKey).update(Buffer.concat([iv, ciphertext])).digest().subarray(0, 10);
  return Buffer.concat([ciphertext, mac]);
}
