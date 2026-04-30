import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  buildDashboardMetrics,
  createAuthSession,
  createMessage,
  createUser,
  deleteAuthSession,
  getAuthSessionUser,
  listConversations,
  listMessages,
  listUsers,
  transferSupportSession,
  updateSupportSessionStatus
} from '../server/db.js';
import { normalizeIncomingMessage } from '../server/normalize.js';

test('auth creates users, validates credentials and expires sessions', () => {
  const email = `agent-${Date.now()}@example.test`;
  const user = createUser({
    name: 'Agente Teste',
    email,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });

  assert.equal(user.email, email);
  assert.equal(user.role, 'attendant');
  assert.equal(user.passwordHash, undefined);
  assert.equal(authenticateUser(email, 'senha-errada'), null);
  assert.equal(authenticateUser(email, 'senha-forte').id, user.id);

  const session = createAuthSession(user.id);
  assert.equal(getAuthSessionUser(session.id).email, email);
  deleteAuthSession(session.id);
  assert.equal(getAuthSessionUser(session.id), null);
});

test('support sessions can be assigned and transferred with internal history events', () => {
  const owner = createUser({
    name: `Dono ${Date.now()}`,
    email: `owner-${Date.now()}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const target = createUser({
    name: `Destino ${Date.now()}`,
    email: `target-${Date.now()}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const message = createMessage({
    phone: `5599${Date.now()}`,
    name: 'Cliente Transferencia',
    direction: 'inbound',
    type: 'text',
    body: 'Preciso de ajuda',
    status: 'received'
  });

  const active = updateSupportSessionStatus(message.sessionId, 'active', owner);
  assert.equal(active.assignedUserId, owner.id);
  assert.equal(active.assignedUserName, owner.name);

  const transferred = transferSupportSession(message.sessionId, target.id, owner);
  assert.equal(transferred.assignedUserId, target.id);
  assert.equal(transferred.assignedUserName, target.name);

  const timeline = listMessages(message.sessionId);
  assert.equal(timeline.some((item) => item.direction === 'system' && item.type === 'transferred'), true);
});

test('dashboard metrics include period totals, status buckets, contacts and users', () => {
  const user = createUser({
    name: `Metricas ${Date.now()}`,
    email: `metrics-${Date.now()}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const message = createMessage({
    phone: `5588${Date.now()}`,
    name: 'Cliente Metricas',
    direction: 'inbound',
    type: 'text',
    body: 'Ola',
    status: 'received'
  });
  updateSupportSessionStatus(message.sessionId, 'active', user);
  updateSupportSessionStatus(message.sessionId, 'finished', user);

  const dashboard = buildDashboardMetrics({
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date(Date.now() + 86400000).toISOString()
  });

  assert.ok(dashboard.summary.total >= 1);
  assert.ok(dashboard.status.finished >= 1);
  assert.ok(dashboard.byContact.some((item) => item.phone === message.phone));
  assert.ok(dashboard.byUser.some((item) => item.userId === user.id && item.finished >= 1));
  assert.ok(Array.isArray(dashboard.recentEvents));
  assert.ok(Array.isArray(dashboard.recentTransfers));
});

test('inbound replies preserve quoted message context from W-API payloads', () => {
  const phone = `5577${Date.now()}`;
  const sent = createMessage({
    phone,
    name: 'Cliente Reply',
    direction: 'outbound',
    type: 'text',
    body: 'Mensagem original',
    status: 'sent',
    externalId: `sent-${Date.now()}`
  });
  const normalized = normalizeIncomingMessage({
    event: 'webhookReceived',
    messageId: `reply-${Date.now()}`,
    chat: { id: phone },
    sender: { pushName: 'Cliente Reply' },
    msgContent: {
      extendedTextMessage: {
        text: 'Resposta do cliente',
        contextInfo: {
          stanzaId: sent.externalId,
          quotedMessage: {
            conversation: 'Mensagem original'
          }
        }
      }
    }
  });

  const received = createMessage({
    ...normalized,
    direction: 'inbound',
    status: 'received'
  });

  assert.equal(received.replyToMessageId, sent.id);
  assert.equal(received.replyToExternalId, sent.externalId);
  assert.equal(received.replyPreview, 'Mensagem original');
});

test('inactive users are hidden from active user lists', () => {
  const email = `inactive-${Date.now()}@example.test`;
  createUser({
    name: 'Usuario Inativo',
    email,
    password: 'senha-forte',
    role: 'attendant',
    active: false
  });

  assert.equal(listUsers({ activeOnly: true }).some((user) => user.email === email), false);
});

test('attendants only see waiting conversations or sessions assigned to them', () => {
  const suffix = Date.now();
  const owner = createUser({
    name: `Responsavel ${suffix}`,
    email: `resp-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const other = createUser({
    name: `Outro ${suffix}`,
    email: `outro-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const waiting = createMessage({
    phone: `551191${suffix}`,
    name: 'Cliente Espera',
    direction: 'inbound',
    type: 'text',
    body: 'Fila',
    status: 'received'
  });
  const owned = createMessage({
    phone: `551192${suffix}`,
    name: 'Cliente Dono',
    direction: 'inbound',
    type: 'text',
    body: 'Meu atendimento',
    status: 'received'
  });
  const hidden = createMessage({
    phone: `551193${suffix}`,
    name: 'Cliente Outro',
    direction: 'inbound',
    type: 'text',
    body: 'Atendimento de outra pessoa',
    status: 'received'
  });
  updateSupportSessionStatus(owned.sessionId, 'active', owner);
  updateSupportSessionStatus(hidden.sessionId, 'active', other);

  const visible = listConversations({ viewer: owner }).map((item) => item.id);

  assert.equal(visible.includes(waiting.sessionId), true);
  assert.equal(visible.includes(owned.sessionId), true);
  assert.equal(visible.includes(hidden.sessionId), false);
});
