import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMessage,
  createUser,
  getSupportSessionByIdForTest,
  listMessages,
  publicSettings,
  saveSettings,
  updateSupportSessionStatus
} from '../server/db.js';

async function loadAutoCloseService() {
  try {
    return await import('../server/auto-close.js');
  } catch (error) {
    assert.fail(`Servico de encerramento automatico indisponivel: ${error.message}`);
  }
}

test('settings persist automatic closure fields with safe public values', () => {
  saveSettings({
    autoCloseActiveConversations: true,
    autoCloseIdleMinutes: 17,
    autoCloseMessage: 'Encerramos por inatividade.'
  });

  const enabled = publicSettings();

  assert.equal(enabled.autoCloseActiveConversations, true);
  assert.equal(enabled.autoCloseIdleMinutes, 17);
  assert.equal(enabled.autoCloseMessage, 'Encerramos por inatividade.');

  saveSettings({
    autoCloseActiveConversations: false,
    autoCloseIdleMinutes: 'tempo invalido',
    autoCloseMessage: '   '
  });

  const normalized = publicSettings();

  assert.equal(normalized.autoCloseActiveConversations, false);
  assert.equal(normalized.autoCloseIdleMinutes, 60);
  assert.match(normalized.autoCloseMessage, /inatividade/i);
});

test('automatic closure sends the configured message and finishes only idle active sessions as the assigned attendant', async () => {
  const { runAutoCloseActiveSessions } = await loadAutoCloseService();
  const suffix = Date.now();
  const attendant = createUser({
    name: `Atendente Auto ${suffix}`,
    email: `auto-close-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const idle = createMessage({
    phone: `551170${suffix}`,
    name: 'Cliente Ocioso',
    direction: 'inbound',
    type: 'text',
    body: 'Ainda preciso de ajuda',
    status: 'received',
    createdAt: '2026-05-14T10:00:00.000Z'
  });
  const recent = createMessage({
    phone: `551171${suffix}`,
    name: 'Cliente Recente',
    direction: 'inbound',
    type: 'text',
    body: 'Acabei de responder',
    status: 'received',
    createdAt: '2026-05-14T10:50:00.000Z'
  });
  const waiting = createMessage({
    phone: `551172${suffix}`,
    name: 'Cliente Espera',
    direction: 'inbound',
    type: 'text',
    body: 'Estou aguardando',
    status: 'received',
    createdAt: '2026-05-14T09:00:00.000Z'
  });
  updateSupportSessionStatus(idle.sessionId, 'active', attendant);
  updateSupportSessionStatus(recent.sessionId, 'active', attendant);
  const sent = [];

  const result = await runAutoCloseActiveSessions({
    settings: {
      autoCloseActiveConversations: true,
      autoCloseIdleMinutes: 30,
      autoCloseMessage: 'Encerramos este atendimento por inatividade.'
    },
    now: () => new Date('2026-05-14T11:00:00.000Z'),
    sendText: async (payload) => {
      sent.push(payload);
      return { messageId: `auto-close-${sent.length}` };
    }
  });

  const closed = getSupportSessionByIdForTest(idle.sessionId);
  const untouchedRecent = getSupportSessionByIdForTest(recent.sessionId);
  const untouchedWaiting = getSupportSessionByIdForTest(waiting.sessionId);
  const closedMessages = listMessages(idle.sessionId);

  assert.equal(result.closed.length, 1);
  assert.deepEqual(sent, [
    {
      phone: idle.phone,
      message: 'Encerramos este atendimento por inatividade.'
    }
  ]);
  assert.equal(closed.chatStatus, 'finished');
  assert.equal(untouchedRecent.chatStatus, 'active');
  assert.equal(untouchedWaiting.chatStatus, 'waiting');
  assert.equal(closedMessages.some((item) => item.direction === 'outbound' && item.body === 'Encerramos este atendimento por inatividade.'), true);
  assert.equal(closedMessages.some((item) => item.direction === 'system' && item.body === `${attendant.name} finalizou o atendimento`), true);
});
