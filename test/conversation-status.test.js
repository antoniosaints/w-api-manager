import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_STATUSES,
  getNextSessionStatusForMessage,
  normalizeConversationStatus,
  shouldCreateNewSessionForMessage
} from '../server/conversation-status.js';

test('normalizes supported conversation statuses', () => {
  assert.deepEqual(CHAT_STATUSES, ['waiting', 'active', 'finished']);
  assert.equal(normalizeConversationStatus('waiting'), 'waiting');
  assert.equal(normalizeConversationStatus('active'), 'active');
  assert.equal(normalizeConversationStatus('finished'), 'finished');
});

test('rejects unsupported conversation statuses', () => {
  assert.throws(() => normalizeConversationStatus('deleted'), /Status de conversa invalido/);
});

test('incoming messages create a new support session after a finished one', () => {
  assert.equal(shouldCreateNewSessionForMessage({ direction: 'inbound', currentStatus: undefined }), true);
  assert.equal(shouldCreateNewSessionForMessage({ direction: 'inbound', currentStatus: 'waiting' }), false);
  assert.equal(shouldCreateNewSessionForMessage({ direction: 'inbound', currentStatus: 'active' }), false);
  assert.equal(shouldCreateNewSessionForMessage({ direction: 'inbound', currentStatus: 'finished' }), true);
});

test('message direction chooses the next open support status', () => {
  assert.equal(getNextSessionStatusForMessage({ direction: 'inbound' }), 'waiting');
  assert.equal(getNextSessionStatusForMessage({ direction: 'outbound' }), 'active');
  assert.equal(getNextSessionStatusForMessage({ direction: 'inbound', currentStatus: 'active' }), 'active');
});
