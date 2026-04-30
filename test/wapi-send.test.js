import test from 'node:test';
import assert from 'node:assert/strict';
import { getSettings, saveSettings } from '../server/db.js';
import {
  getPaymentStatus,
  downloadMedia,
  sendAudioMessage,
  sendDocumentMessage,
  sendImageMessage,
  sendTextMessage,
  sendVideoMessage
} from '../server/wapi.js';

test('send text forwards reply message id to W-API messageId field', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let captured;

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ messageId: 'sent-1' }), { status: 200 });
  };

  try {
    await sendTextMessage({ phone: '559999999999', message: 'Oi', messageId: 'quoted-1' });
    assert.equal(captured.url, 'https://api.example.test/v1/message/send-text?instanceId=instance-1');
    assert.deepEqual(captured.body, {
      phone: '559999999999',
      message: 'Oi',
      messageId: 'quoted-1',
      delayMessage: 0
    });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});

test('send image uses W-API base64 image payload without upload persistence', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let captured;

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ messageId: 'image-1' }), { status: 200 });
  };

  try {
    await sendImageMessage({
      phone: '559999999999',
      image: 'data:image/png;base64,abc123',
      caption: 'Comprovante',
      messageId: 'quoted-2'
    });

    assert.equal(captured.url, 'https://api.example.test/v1/message/send-image?instanceId=instance-1');
    assert.deepEqual(captured.body, {
      phone: '559999999999',
      image: 'data:image/png;base64,abc123',
      caption: 'Comprovante',
      messageId: 'quoted-2',
      delayMessage: 0
    });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});

test('send audio uses W-API audio endpoint and payload', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let captured;

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ messageId: 'audio-1' }), { status: 200 });
  };

  try {
    await sendAudioMessage({
      phone: '559999999999',
      audio: 'data:audio/ogg;base64,abc123',
      messageId: 'quoted-audio'
    });

    assert.equal(captured.url, 'https://api.example.test/v1/message/send-audio?instanceId=instance-1');
    assert.deepEqual(captured.body, {
      phone: '559999999999',
      audio: 'data:audio/ogg;base64,abc123',
      messageId: 'quoted-audio',
      delayMessage: 1
    });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});

test('send video uses W-API video endpoint and caption payload', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let captured;

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ messageId: 'video-1' }), { status: 200 });
  };

  try {
    await sendVideoMessage({
      phone: '559999999999',
      video: 'data:video/mp4;base64,abc123',
      caption: 'Video do atendimento',
      messageId: 'quoted-video'
    });

    assert.equal(captured.url, 'https://api.example.test/v1/message/send-video?instanceId=instance-1');
    assert.deepEqual(captured.body, {
      phone: '559999999999',
      video: 'data:video/mp4;base64,abc123',
      caption: 'Video do atendimento',
      messageId: 'quoted-video',
      delayMessage: 0
    });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});

test('send document uses W-API document endpoint with extension and file name', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let captured;

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ messageId: 'doc-1' }), { status: 200 });
  };

  try {
    await sendDocumentMessage({
      phone: '559999999999',
      document: 'data:application/pdf;base64,abc123',
      extension: 'pdf',
      fileName: 'contrato.pdf',
      caption: 'Contrato',
      messageId: 'quoted-doc'
    });

    assert.equal(captured.url, 'https://api.example.test/v1/message/send-document?instanceId=instance-1');
    assert.deepEqual(captured.body, {
      phone: '559999999999',
      document: 'data:application/pdf;base64,abc123',
      extension: 'pdf',
      fileName: 'contrato.pdf',
      caption: 'Contrato',
      messageId: 'quoted-doc',
      delayMessage: 0
    });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});

test('payment status uses W-API payment status endpoint', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let capturedUrl = '';

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url) => {
    capturedUrl = String(url);
    return new Response(JSON.stringify({ status: 'pending', value: 49.9 }), { status: 200 });
  };

  try {
    const status = await getPaymentStatus();
    assert.equal(capturedUrl, 'https://api.example.test/v1/payment/status?instanceId=instance-1');
    assert.deepEqual(status, { status: 'pending', value: 49.9 });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});

test('download media forwards WhatsApp media metadata to W-API', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let captured;

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ url: 'https://cdn.example.test/temp-audio.ogg' }), { status: 200 });
  };

  try {
    const result = await downloadMedia({
      mediaKey: 'media-key-1',
      directPath: '/v/t62/audio.enc?oh=token',
      type: 'audio',
      mimetype: 'audio/ogg; codecs=opus'
    });

    assert.equal(captured.url, 'https://api.example.test/v1/message/download-media?instanceId=instance-1');
    assert.deepEqual(captured.body, {
      mediaKey: 'media-key-1',
      directPath: '/v/t62/audio.enc?oh=token',
      type: 'audio',
      mimetype: 'audio/ogg; codecs=opus'
    });
    assert.deepEqual(result, { url: 'https://cdn.example.test/temp-audio.ogg' });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});

test('send text preserves group chat jid for W-API delivery', async () => {
  const originalSettings = getSettings();
  const originalFetch = global.fetch;
  let captured;

  saveSettings({ baseUrl: 'https://api.example.test', instanceId: 'instance-1', token: 'token-1' });
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ messageId: 'group-sent-1' }), { status: 200 });
  };

  try {
    await sendTextMessage({ phone: '120363287682702007@g.us', message: 'Oi grupo' });
    assert.deepEqual(captured.body, {
      phone: '120363287682702007@g.us',
      message: 'Oi grupo',
      messageId: '',
      delayMessage: 0
    });
  } finally {
    global.fetch = originalFetch;
    saveSettings(originalSettings);
  }
});
