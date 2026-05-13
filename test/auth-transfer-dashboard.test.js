import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateUser,
  buildDashboardMetrics,
  createAuthSession,
  createMessage,
  createSector,
  createSupportTag,
  createUser,
  deleteAuthSession,
  getAuthSessionUser,
  listHistorySessions,
  listConversations,
  listMessages,
  listUsers,
  setSupportSessionSector,
  setSupportSessionTags,
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

test('supervisors use the restricted operational queue scope', () => {
  const suffix = Date.now();
  const supervisor = createUser({
    name: `Supervisor ${suffix}`,
    email: `supervisor-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'supervisor',
    active: true
  });
  const other = createUser({
    name: `Outro Supervisor ${suffix}`,
    email: `outro-supervisor-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const waiting = createMessage({
    phone: `552191${suffix}`,
    name: 'Cliente Espera Supervisor',
    direction: 'inbound',
    type: 'text',
    body: 'Fila supervisor',
    status: 'received'
  });
  const owned = createMessage({
    phone: `552192${suffix}`,
    name: 'Cliente Supervisor',
    direction: 'inbound',
    type: 'text',
    body: 'Meu atendimento supervisor',
    status: 'received'
  });
  const hidden = createMessage({
    phone: `552193${suffix}`,
    name: 'Cliente Outro Supervisor',
    direction: 'inbound',
    type: 'text',
    body: 'Atendimento de outro usuario',
    status: 'received'
  });
  updateSupportSessionStatus(owned.sessionId, 'active', supervisor);
  updateSupportSessionStatus(hidden.sessionId, 'active', other);

  const visible = listConversations({ viewer: supervisor }).map((item) => item.id);

  assert.equal(supervisor.role, 'supervisor');
  assert.equal(visible.includes(waiting.sessionId), true);
  assert.equal(visible.includes(owned.sessionId), true);
  assert.equal(visible.includes(hidden.sessionId), false);
});

test('history sessions are paginated and filter by attendant, sector, date and search', () => {
  const suffix = Date.now();
  const admin = createUser({
    name: `Admin Historico ${suffix}`,
    email: `admin-historico-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'admin',
    active: true
  });
  const attendant = createUser({
    name: `Atendente Historico ${suffix}`,
    email: `atendente-historico-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const sector = createSector({ name: `Financeiro ${suffix}`, color: 'blue', active: true });
  const match = createMessage({
    phone: `553191${suffix}`,
    name: 'Cliente Filtro Historico',
    direction: 'inbound',
    type: 'text',
    body: 'Preciso consultar boleto',
    status: 'received',
    createdAt: '2026-05-10T10:00:00.000Z'
  });
  const outside = createMessage({
    phone: `553192${suffix}`,
    name: 'Cliente Fora Historico',
    direction: 'inbound',
    type: 'text',
    body: 'Outro assunto',
    status: 'received',
    createdAt: '2026-05-01T10:00:00.000Z'
  });
  updateSupportSessionStatus(match.sessionId, 'active', attendant);
  setSupportSessionSector(match.sessionId, sector.id, admin);
  updateSupportSessionStatus(outside.sessionId, 'active', admin);

  const result = listHistorySessions({
    viewer: admin,
    search: 'boleto',
    assignedUserId: attendant.id,
    sectorId: sector.id,
    from: '2026-05-09T00:00:00.000Z',
    to: '2026-05-11T23:59:59.999Z',
    page: 1,
    limit: 5
  });

  assert.equal(result.meta.page, 1);
  assert.equal(result.meta.limit, 5);
  assert.equal(result.data.some((item) => item.id === match.sessionId), true);
  assert.equal(result.data.some((item) => item.id === outside.sessionId), false);
});

test('dashboard metrics include professional kpis and chart series', () => {
  const suffix = Date.now();
  const owner = createUser({
    name: `Dashboard Pro ${suffix}`,
    email: `dashboard-pro-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const target = createUser({
    name: `Dashboard Transfer ${suffix}`,
    email: `dashboard-transfer-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const sector = createSector({ name: `Suporte Pro ${suffix}`, color: 'green', active: true });
  const tag = createSupportTag({ name: `Urgente ${suffix}`, color: 'red', active: true });
  const message = createMessage({
    phone: `554191${suffix}`,
    name: 'Cliente KPI',
    direction: 'inbound',
    type: 'text',
    body: 'Preciso de ajuda',
    status: 'received',
    createdAt: '2026-05-12T09:00:00.000Z'
  });
  updateSupportSessionStatus(message.sessionId, 'active', owner);
  setSupportSessionSector(message.sessionId, sector.id, owner);
  setSupportSessionTags(message.sessionId, [tag.id]);
  transferSupportSession(message.sessionId, target.id, owner);
  updateSupportSessionStatus(message.sessionId, 'finished', target);

  const dashboard = buildDashboardMetrics({
    from: '2026-05-11T00:00:00.000Z',
    to: '2026-05-13T23:59:59.999Z'
  });

  assert.ok(Number.isFinite(dashboard.summary.averageWaitMinutes));
  assert.ok(Number.isFinite(dashboard.summary.completionRate));
  assert.ok(Number.isFinite(dashboard.summary.messagesPerSession));
  assert.ok(dashboard.summary.transfers >= 1);
  assert.ok(Array.isArray(dashboard.timeline));
  assert.ok(dashboard.timeline.some((item) => item.date === '2026-05-12'));
  assert.ok(dashboard.bySector.some((item) => item.sectorId === sector.id));
  assert.ok(dashboard.byTag.some((item) => item.tagId === tag.id));
});
