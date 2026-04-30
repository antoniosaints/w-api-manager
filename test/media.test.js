import test from 'node:test';
import assert from 'node:assert/strict';
import { findMessageImageSource, getMessageMedia } from '../src/media.js';

test('finds message image source from normalized mediaPath', () => {
  assert.equal(
    findMessageImageSource({ type: 'image', mediaPath: 'https://cdn.example.com/image.jpg' }),
    'https://cdn.example.com/image.jpg'
  );
});

test('finds message image source from local outbound uploads path', () => {
  assert.equal(
    findMessageImageSource({ type: 'image', mediaPath: '/uploads/outbound/local-image.jpg' }),
    '/uploads/outbound/local-image.jpg'
  );
});

test('keeps outbound local image preview even after encrypted W-API webhook metadata arrives', () => {
  assert.equal(
    findMessageImageSource({
      id: 'outbound-image-1',
      direction: 'outbound',
      type: 'image',
      mediaPath: '/uploads/outbound/local-image.jpg',
      raw: {
        msgContent: {
          imageMessage: {
            url: 'https://mmg.whatsapp.net/v/t62/image.enc',
            mimetype: 'image/jpeg',
            mediaKey: 'abc123'
          }
        }
      }
    }),
    '/uploads/outbound/local-image.jpg'
  );
});

test('uses local media endpoint for nested W-API delivery image payloads', () => {
  assert.equal(
    findMessageImageSource({
      id: 'delivery-image-1',
      direction: 'outbound',
      type: 'image',
      mediaPath: 'https://mmg.whatsapp.net/o1/v/t24/image.enc',
      raw: {
        msgContent: {
          message: {
            imageMessage: {
              url: 'https://mmg.whatsapp.net/o1/v/t24/image.enc',
              mimetype: 'image/jpeg',
              mediaKey: 'delivery-key'
            }
          }
        }
      }
    }),
    '/api/messages/delivery-image-1/media'
  );
});

test('uses local media endpoint for normalized encrypted image metadata', () => {
  assert.equal(
    findMessageImageSource({
      id: 'normalized-image-1',
      direction: 'outbound',
      type: 'image',
      mediaPath: 'https://mmg.whatsapp.net/o1/v/t24/image.enc',
      raw: {
        normalizedMedia: {
          type: 'image',
          url: 'https://mmg.whatsapp.net/o1/v/t24/image.enc',
          mimetype: 'image/jpeg',
          mediaKey: 'normalized-key'
        }
      }
    }),
    '/api/messages/normalized-image-1/media'
  );
});

test('finds message image source from raw W-API image payload', () => {
  assert.equal(
    findMessageImageSource({
      type: 'image',
      raw: {
        msgContent: {
          imageMessage: {
            url: 'https://cdn.example.com/raw-image.jpg'
          }
        }
      }
    }),
    'https://cdn.example.com/raw-image.jpg'
  );
});

test('wraps raw base64 image payload as a data URL', () => {
  assert.equal(
    findMessageImageSource({
      raw: {
        msgContent: {
          imageMessage: {
            mimetype: 'image/png',
            jpegThumbnail: 'abc123'
          }
        }
      }
    }),
    'data:image/png;base64,abc123'
  );
});

test('finds renderable thumbnail from W-API associated child image payload', () => {
  assert.equal(
    findMessageImageSource({
      raw: {
        msgContent: {
          associatedChildMessage: {
            message: {
              imageMessage: {
                url: 'https://mmg.whatsapp.net/o1/v/t24/f2/image',
                mimetype: 'image/jpeg',
                jpegThumbnail: '/9j/abc123'
              }
            }
          }
        }
      }
    }),
    'data:image/jpeg;base64,/9j/abc123'
  );
});

test('prefers thumbnail over encrypted WhatsApp media URL', () => {
  assert.equal(
    findMessageImageSource({
      mediaPath: 'https://mmg.whatsapp.net/o1/v/t24/f2/image',
      raw: {
        msgContent: {
          associatedChildMessage: {
            message: {
              imageMessage: {
                mimetype: 'image/jpeg',
                jpegThumbnail: '/9j/thumb'
              }
            }
          }
        }
      }
    }),
    'data:image/jpeg;base64,/9j/thumb'
  );
});

test('uses local media endpoint when full WhatsApp media can be served by the backend', () => {
  assert.equal(
    findMessageImageSource({
      id: 'message-1',
      mediaPath: 'https://mmg.whatsapp.net/o1/v/t24/f2/image',
      raw: {
        msgContent: {
          associatedChildMessage: {
            message: {
              imageMessage: {
                url: 'https://mmg.whatsapp.net/o1/v/t24/f2/image',
                mimetype: 'image/jpeg',
                mediaKey: 'abc',
                jpegThumbnail: '/9j/thumb'
              }
            }
          }
        }
      }
    }),
    '/api/messages/message-1/media'
  );
});

test('uses local media endpoint for encrypted W-API sticker payloads', () => {
  assert.equal(
    findMessageImageSource({
      id: 'sticker-1',
      type: 'sticker',
      mediaPath: 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc',
      raw: {
        msgContent: {
          stickerMessage: {
            url: 'https://mmg.whatsapp.net/v/t62.15575-24/sticker.enc',
            mimetype: 'image/webp',
            mediaKey: 'abc'
          }
        }
      }
    }),
    '/api/messages/sticker-1/media'
  );
});

test('finds playable audio media from normalized metadata', () => {
  assert.deepEqual(
    getMessageMedia({
      id: 'audio-1',
      type: 'audio',
      raw: {
        normalizedMedia: {
          type: 'audio',
          url: 'https://mmg.whatsapp.net/v/t62/audio.enc',
          mimetype: 'audio/ogg',
          mediaKey: 'abc',
          fileName: 'audio.ogg',
          duration: 42,
          size: 12000
        }
      }
    }),
    {
      type: 'audio',
      src: '/api/messages/audio-1/media',
      mimeType: 'audio/ogg',
      fileName: 'audio.ogg',
      size: 12000,
      duration: 42,
      caption: '',
      encrypted: true
    }
  );
});

test('finds playable video media from raw W-API payload', () => {
  assert.deepEqual(
    getMessageMedia({
      id: 'video-1',
      type: 'video',
      raw: {
        msgContent: {
          videoMessage: {
            url: 'https://cdn.example.com/video.mp4',
            mimetype: 'video/mp4',
            caption: 'Video do atendimento',
            fileLength: '45000',
            seconds: 7
          }
        }
      }
    }),
    {
      type: 'video',
      src: 'https://cdn.example.com/video.mp4',
      mimeType: 'video/mp4',
      fileName: '',
      size: 45000,
      duration: 7,
      caption: 'Video do atendimento',
      encrypted: false
    }
  );
});

test('finds downloadable document media with file metadata', () => {
  assert.deepEqual(
    getMessageMedia({
      type: 'document',
      mediaPath: 'https://cdn.example.com/contrato.pdf',
      raw: {
        normalizedMedia: {
          type: 'document',
          mimetype: 'application/pdf',
          fileName: 'contrato.pdf',
          size: 240000
        }
      }
    }),
    {
      type: 'document',
      src: 'https://cdn.example.com/contrato.pdf',
      mimeType: 'application/pdf',
      fileName: 'contrato.pdf',
      size: 240000,
      duration: 0,
      caption: '',
      encrypted: false
    }
  );
});
