import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAudioForWapi } from '../server/outbound-audio.js';

test('W-API audio preparation keeps MP3 and OGG payloads untouched', async () => {
  const media = {
    type: 'audio',
    reference: 'data:audio/ogg;base64,aGVsbG8=',
    mimeType: 'audio/ogg',
    extension: 'ogg',
    fileName: 'audio.ogg',
    size: 5
  };

  assert.equal(await prepareAudioForWapi(media), media);
});

test('W-API audio preparation converts recorder WebM payloads to OGG before sending', async () => {
  const media = {
    type: 'audio',
    reference: 'data:audio/webm;codecs=opus;base64,d2VibQ==',
    mimeType: 'audio/webm',
    extension: 'webm',
    fileName: 'audio-gravado.webm',
    size: 4
  };

  const prepared = await prepareAudioForWapi(media, {
    transcode: async (input) => ({
      ...input,
      reference: 'data:audio/ogg;base64,b2dn',
      mimeType: 'audio/ogg',
      extension: 'ogg',
      fileName: 'audio-gravado.ogg',
      size: 3
    })
  });

  assert.deepEqual(prepared, {
    type: 'audio',
    reference: 'data:audio/ogg;base64,b2dn',
    mimeType: 'audio/ogg',
    extension: 'ogg',
    fileName: 'audio-gravado.ogg',
    size: 3
  });
});

test('W-API audio preparation rejects unsupported remote audio formats before calling W-API', async () => {
  await assert.rejects(
    prepareAudioForWapi({
      type: 'audio',
      reference: 'https://cdn.example.test/audio.webm',
      mimeType: 'audio/webm',
      extension: 'webm',
      fileName: 'audio.webm',
      size: 1000
    }),
    /Formato de audio invalido/
  );
});
