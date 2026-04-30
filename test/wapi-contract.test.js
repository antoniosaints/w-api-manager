import test from 'node:test';
import assert from 'node:assert/strict';
import { sendContactMessage, sendLocationMessage } from '../server/wapi.js';

test('W-API location payload follows the Postman contract', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true, id: 'loc-1' }), { status: 200 });
  };

  await sendLocationMessage({
    phone: '5511999999999',
    latitude: '-23.5505',
    longitude: '-46.6333',
    name: 'Cliente',
    address: 'Rua Central'
  });

  assert.match(calls[0].url, /\/v1\/message\/send-location\?instanceId=/);
  assert.deepEqual(calls[0].body, {
    phone: '5511999999999',
    latitude: '-23.5505',
    longitude: '-46.6333',
    name: 'Cliente',
    address: 'Rua Central',
    delayMessage: 0
  });
});

test('W-API contact payload follows the Postman contract', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true, id: 'contact-1' }), { status: 200 });
  };

  await sendContactMessage({
    phone: '5511999999999',
    contactName: 'Maria',
    contactPhone: '5588999999999',
    contactBusinessDescription: 'Cliente VIP',
    messageId: 'quoted-1'
  });

  assert.match(calls[0].url, /\/v1\/message\/send-contact\?instanceId=/);
  assert.deepEqual(calls[0].body, {
    phone: '5511999999999',
    contactName: 'Maria',
    contactPhone: '5588999999999',
    contactBusinessDescription: 'Cliente VIP',
    messageId: 'quoted-1',
    delayMessage: 0
  });
});
