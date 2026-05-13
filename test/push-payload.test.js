import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPushPayload } from '../server/push.js';

test('push payload title prefers a saved contact name over the phone', () => {
  const payload = buildPushPayload({
    direction: 'inbound',
    sessionId: 'session-1',
    phone: '5511999999999',
    name: 'Maria Silva',
    body: 'Oi',
    type: 'text'
  });

  assert.equal(payload.title, 'Maria Silva');
});

test('push payload title falls back to phone when contact name is missing or just the phone', () => {
  assert.equal(buildPushPayload({
    direction: 'inbound',
    sessionId: 'session-1',
    phone: '5511888888888',
    name: '',
    body: 'Oi',
    type: 'text'
  }).title, '5511888888888');

  assert.equal(buildPushPayload({
    direction: 'inbound',
    sessionId: 'session-1',
    phone: '5511777777777',
    name: '5511777777777',
    body: 'Oi',
    type: 'text'
  }).title, '5511777777777');
});

test('push payload carries the pending unread count for the app badge', () => {
  const payload = buildPushPayload({
    direction: 'inbound',
    sessionId: 'session-2',
    phone: '5511666666666',
    name: 'Cliente',
    body: 'Oi',
    type: 'text'
  }, { unreadCount: 7 });

  assert.equal(payload.unreadCount, 7);
});
