import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../server/db.js';
import {
  canAccessSupportSession,
  createMessage,
  cleanupWebhookStatusArtifacts,
  createSupportSessionEventForTest,
  createAiAgent,
  createSector,
  createSupportTag,
  createUser,
  deleteContact,
  deleteSupportSession,
  deleteUser,
  getContactByPhone,
  getAiAgentById,
  authenticateUser,
  listContacts,
  listConversations,
  listUsers,
  listAiAgents,
  listPushSubscriptionsByUserIds,
  listSectors,
  listSupportTags,
  listUsersTable,
  markSupportSessionRead,
  normalizeLegacyGroupChatIds,
  saveContact,
  savePushSubscription,
  setSupportSessionTags,
  transferSupportSession,
  updateUser,
  updateUserThemeColor
} from '../server/db.js';
import { normalizeIncomingMessage } from '../server/normalize.js';

test('test database is isolated from the app sqlite file', () => {
  assert.notEqual(db.name.endsWith('data\\app.sqlite') || db.name.endsWith('data/app.sqlite'), true);
  const defaultAdmin = authenticateUser('admim@wapi.local', '123');
  assert.equal(defaultAdmin?.role, 'admin');
  assert.equal(defaultAdmin?.active, true);
  assert.equal(listUsers().filter((user) => user.email === 'admim@wapi.local').length, 1);
});

test('contacts can be saved and listed with CRM fields and pagination metadata', () => {
  const phone = `5511${Date.now()}`;
  const saved = saveContact({
    phone,
    name: 'Cliente CRM',
    email: 'cliente@example.test',
    address: 'Rua Central, 123',
    latitude: '-23.5505',
    longitude: '-46.6333',
    notes: 'Prefere atendimento por mensagem.',
    tags: ['vip', 'financeiro'],
    status: 'lead',
    source: 'chat'
  });

  assert.equal(saved.phone, phone);
  assert.equal(saved.email, 'cliente@example.test');
  assert.deepEqual(saved.tags, ['vip', 'financeiro']);

  const result = listContacts({ search: 'cliente crm', status: 'lead', tag: 'vip', page: 1, limit: 5 });
  assert.equal(result.meta.page, 1);
  assert.equal(result.meta.limit, 5);
  assert.ok(result.meta.total >= 1);
  assert.equal(result.data.some((item) => item.id === saved.id), true);
});

test('deleting a support session removes messages and session events but preserves the contact', () => {
  const message = createMessage({
    phone: `5599${Date.now()}`,
    name: 'Contato Preservado',
    direction: 'inbound',
    type: 'text',
    body: 'Preciso de ajuda',
    status: 'received'
  });
  createSupportSessionEventForTest({
    sessionId: message.sessionId,
    type: 'note',
    body: 'Evento interno'
  });

  assert.equal(deleteSupportSession(message.sessionId), true);

  const remaining = db.prepare('SELECT COUNT(*) AS total FROM support_session_events WHERE session_id = ?').get(message.sessionId);
  assert.equal(remaining.total, 0);
  assert.equal(getContactByPhone(message.phone)?.name, 'Contato Preservado');
});

test('duplicate inbound webhook messages with the same external id are not stored twice', () => {
  const externalId = `image-${Date.now()}`;
  const payload = {
    phone: `5588${Date.now()}`,
    name: 'Cliente Imagem',
    direction: 'inbound',
    type: 'image',
    body: 'Comprovante',
    status: 'received',
    externalId,
    raw: {
      msgContent: {
        imageMessage: {
          url: 'https://mmg.whatsapp.net/v/t/image.enc',
          mediaKey: 'abc',
          mimetype: 'image/jpeg'
        }
      }
    }
  };

  const first = createMessage(payload);
  const second = createMessage(payload);
  const stored = db.prepare('SELECT COUNT(*) AS total FROM messages WHERE external_id = ?').get(externalId);

  assert.equal(first.id, second.id);
  assert.equal(stored.total, 1);
});

test('outbound media webhook updates the sent message with official media metadata', () => {
  const phone = `5591${Date.now()}`;
  const externalId = `sent-media-${Date.now()}`;
  const sent = createMessage({
    phone,
    name: 'Cliente Midia',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    status: 'sent',
    externalId,
    mediaPath: '/uploads/outbound/local-image.jpg',
    media: {
      type: 'image',
      url: '/uploads/outbound/local-image.jpg',
      mimetype: 'image/jpeg',
      fileName: 'local-image.jpg',
      size: 1234
    },
    raw: {
      messageId: externalId,
      normalizedMedia: {
        type: 'image',
        url: '/uploads/outbound/local-image.jpg',
        mimetype: 'image/jpeg'
      }
    }
  });

  const updated = createMessage({
    phone,
    name: 'Cliente Midia',
    direction: 'outbound',
    type: 'image',
    body: 'Foto oficial',
    status: 'delivered',
    externalId,
    mediaPath: 'https://mmg.whatsapp.net/v/t62.7118-24/image.enc',
    media: {
      type: 'image',
      url: 'https://mmg.whatsapp.net/v/t62.7118-24/image.enc',
      directPath: '/v/t62.7118-24/image.enc?ccb=11-4&oh=token',
      mimetype: 'image/jpeg',
      mediaKey: 'abc123',
      fileName: 'foto.jpg',
      size: 4321
    },
    raw: {
      event: 'webhookDelivery',
      messageId: externalId,
      fromMe: true,
      msgContent: {
        imageMessage: {
          url: 'https://mmg.whatsapp.net/v/t62.7118-24/image.enc',
          directPath: '/v/t62.7118-24/image.enc?ccb=11-4&oh=token',
          mimetype: 'image/jpeg',
          mediaKey: 'abc123',
          fileName: 'foto.jpg',
          fileLength: '4321'
        }
      }
    }
  });
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(sent.id);
  const raw = JSON.parse(row.raw_json);

  assert.equal(updated.id, sent.id);
  assert.equal(row.media_path, '/uploads/outbound/local-image.jpg');
  assert.equal(row.status, 'delivered');
  assert.equal(raw.event, 'webhookDelivery');
  assert.equal(raw.normalizedMedia.url, 'https://mmg.whatsapp.net/v/t62.7118-24/image.enc');
  assert.equal(raw.normalizedMedia.mediaKey, 'abc123');
  assert.equal(raw.normalizedMedia.directPath, '/v/t62.7118-24/image.enc?ccb=11-4&oh=token');
});

test('delivery webhook without renderable media keeps outbound image bubble intact', () => {
  const phone = `5599${Date.now()}`;
  const externalId = `delivery-empty-media-${Date.now()}`;
  const sent = createMessage({
    phone,
    name: 'Cliente Delivery',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    status: 'sent',
    externalId,
    mediaPath: '/uploads/outbound/delivery-image.png',
    media: {
      type: 'image',
      url: '/uploads/outbound/delivery-image.png',
      mimetype: 'image/png',
      fileName: 'delivery-image.png',
      size: 3210
    },
    raw: {
      messageId: externalId,
      normalizedMedia: {
        type: 'image',
        url: '/uploads/outbound/delivery-image.png',
        mimetype: 'image/png'
      }
    }
  });
  const deliveryPayload = {
    event: 'webhookDelivery',
    instanceId: 'LITE-JKQPC1-D8V3MW',
    connectedPhone: '559985560520',
    isGroup: false,
    messageId: externalId,
    fromMe: true,
    chat: { id: phone },
    sender: { id: '559985560520', pushName: 'Noc', verifiedBizName: '' },
    moment: 1778687974,
    fromApi: true,
    msgContent: {
      message: {
        documentMessage: {
          fileSha256: null,
          mediaKey: null,
          fileEncSha256: null,
          contextInfo: null
        }
      }
    }
  };
  const normalized = normalizeIncomingMessage(deliveryPayload, 'delivery');

  const updated = createMessage({
    ...normalized,
    direction: 'outbound',
    status: 'SERVER'
  });
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(sent.id);
  const raw = JSON.parse(row.raw_json);

  assert.equal(updated.id, sent.id);
  assert.equal(row.type, 'image');
  assert.equal(row.body, 'Imagem enviada');
  assert.equal(row.media_path, '/uploads/outbound/delivery-image.png');
  assert.equal(row.status, 'SERVER');
  assert.equal(raw.normalizedMedia.url, '/uploads/outbound/delivery-image.png');
});

test('message status webhooks do not create visible chat messages without an existing message', () => {
  const phone = `5512${Date.now()}`;
  const externalId = `status-only-${Date.now()}`;
  const stored = createMessage({
    phone,
    name: 'Status Fantasma',
    direction: 'outbound',
    type: 'message-status',
    body: '[message-status]',
    status: 'SERVER',
    externalId,
    raw: {
      event: 'webhookStatus',
      messageId: externalId,
      status: 'SERVER',
      fromMe: true,
      chat: { id: `${phone}@lid` }
    }
  });
  const messages = db.prepare('SELECT COUNT(*) AS total FROM messages WHERE external_id = ?').get(externalId);
  const sessions = db.prepare('SELECT COUNT(*) AS total FROM support_sessions WHERE phone = ?').get(phone);

  assert.equal(stored, null);
  assert.equal(messages.total, 0);
  assert.equal(sessions.total, 0);
});

test('message status webhooks update status without replacing outbound image content', () => {
  const phone = `5513${Date.now()}`;
  const externalId = `image-status-${Date.now()}`;
  const sent = createMessage({
    phone,
    name: 'Cliente Status',
    direction: 'outbound',
    type: 'image',
    body: 'Imagem enviada',
    status: 'sent',
    externalId,
    mediaPath: '/uploads/outbound/status-image.jpg',
    media: {
      type: 'image',
      url: '/uploads/outbound/status-image.jpg',
      mimetype: 'image/jpeg',
      fileName: 'status-image.jpg',
      size: 123
    },
    raw: {
      messageId: externalId,
      normalizedMedia: {
        type: 'image',
        url: '/uploads/outbound/status-image.jpg',
        mimetype: 'image/jpeg'
      }
    }
  });

  const updated = createMessage({
    phone: `${phone}@lid`,
    name: 'Cliente Status',
    direction: 'outbound',
    type: 'message-status',
    body: '[message-status]',
    status: 'DELIVERY',
    externalId,
    raw: {
      event: 'webhookStatus',
      messageId: externalId,
      status: 'DELIVERY',
      fromMe: true,
      chat: { id: `${phone}@lid` }
    }
  });
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(sent.id);

  assert.equal(updated.id, sent.id);
  assert.equal(row.type, 'image');
  assert.equal(row.body, 'Imagem enviada');
  assert.equal(row.media_path, '/uploads/outbound/status-image.jpg');
  assert.equal(row.status, 'DELIVERY');
});

test('cleanup removes orphan status-only webhook artifacts from existing databases', () => {
  const phone = `5514${Date.now()}`;
  const contactId = randomUUID();
  const sessionId = randomUUID();
  const messageId = randomUUID();
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO contacts (id, phone, name, is_group, chat_status, unread_count, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'active', 0, ?, ?)
  `).run(contactId, phone, 'Contato Status', timestamp, timestamp);
  db.prepare(`
    INSERT INTO support_sessions (id, contact_id, phone, is_group, status, unread_count, started_at, last_message_at, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'active', 0, ?, ?, ?, ?)
  `).run(sessionId, contactId, phone, timestamp, timestamp, timestamp, timestamp);
  db.prepare(`
    INSERT INTO messages (id, external_id, contact_id, session_id, phone, direction, type, body, status, raw_json, created_at)
    VALUES (?, ?, ?, ?, ?, 'outbound', 'message-status', '[message-status]', 'SERVER', ?, ?)
  `).run(messageId, `cleanup-${Date.now()}`, contactId, sessionId, phone, JSON.stringify({ event: 'webhookStatus' }), timestamp);

  const removed = cleanupWebhookStatusArtifacts();
  const messages = db.prepare('SELECT COUNT(*) AS total FROM messages WHERE id = ?').get(messageId);
  const sessions = db.prepare('SELECT COUNT(*) AS total FROM support_sessions WHERE id = ?').get(sessionId);
  const contact = getContactByPhone(phone);

  assert.equal(removed.messages, 1);
  assert.equal(messages.total, 0);
  assert.equal(sessions.total, 0);
  assert.equal(contact.chatStatus, 'waiting');
});

test('cleanup removes empty support sessions left by status-only artifacts', () => {
  const phone = `5515${Date.now()}`;
  const contactId = randomUUID();
  const sessionId = randomUUID();
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO contacts (id, phone, name, is_group, chat_status, unread_count, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'active', 0, ?, ?)
  `).run(contactId, phone, 'Contato Vazio', timestamp, timestamp);
  db.prepare(`
    INSERT INTO support_sessions (id, contact_id, phone, is_group, status, unread_count, started_at, last_message_at, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'waiting', 0, ?, ?, ?, ?)
  `).run(sessionId, contactId, phone, timestamp, timestamp, timestamp, timestamp);

  const removed = cleanupWebhookStatusArtifacts();
  const sessions = db.prepare('SELECT COUNT(*) AS total FROM support_sessions WHERE id = ?').get(sessionId);

  assert.equal(removed.emptySessions, 1);
  assert.equal(sessions.total, 0);
});

test('near-duplicate inbound video webhook echoes are stored once', () => {
  const phone = `5577${Date.now()}`;
  const first = createMessage({
    phone,
    name: 'Cliente Video',
    direction: 'inbound',
    type: 'video',
    body: '[received]',
    status: 'received',
    externalId: `video-a-${Date.now()}`,
    media: {
      type: 'video',
      url: 'https://mmg.whatsapp.net/v/t62/video-a.enc',
      mimetype: 'video/mp4',
      mediaKey: 'media-a',
      fileName: '',
      size: 1581298,
      duration: 7
    },
    mediaPath: 'https://mmg.whatsapp.net/v/t62/video-a.enc',
    createdAt: '2026-04-29T18:36:25.000Z',
    raw: {
      event: 'webhookReceived',
      messageId: 'video-a',
      fromMe: false
    }
  });

  const second = createMessage({
    phone,
    name: 'Cliente Video',
    direction: 'inbound',
    type: 'video',
    body: '[received]',
    status: 'received',
    externalId: `video-b-${Date.now()}`,
    media: {
      type: 'video',
      url: 'https://mmg.whatsapp.net/v/t62/video-b.enc',
      mimetype: 'video/mp4',
      mediaKey: 'media-b',
      fileName: '',
      size: 2867916,
      duration: 7
    },
    mediaPath: 'https://mmg.whatsapp.net/v/t62/video-b.enc',
    createdAt: '2026-04-29T18:36:27.000Z',
    raw: {
      event: 'webhookReceived',
      messageId: 'video-b',
      fromMe: false
    }
  });

  const stored = db.prepare('SELECT COUNT(*) AS total FROM messages WHERE phone = ? AND type = ?').get(phone, 'video');

  assert.equal(first.id, second.id);
  assert.equal(stored.total, 1);
});

test('users table endpoint data supports search, filters and pagination metadata', () => {
  const suffix = Date.now();
  const admin = createUser({
    name: `Gestor ${suffix}`,
    email: `gestor-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'admin',
    active: true
  });
  createUser({
    name: `Atendente ${suffix}`,
    email: `atendente-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: false
  });

  const result = listUsersTable({ search: `gestor-${suffix}`, role: 'admin', active: 'true', page: 1, limit: 10 });
  assert.equal(result.meta.page, 1);
  assert.equal(result.meta.limit, 10);
  assert.equal(result.data.some((item) => item.id === admin.id), true);
  assert.equal(result.data.every((item) => item.passwordHash === undefined), true);
});

test('users and contacts can be deleted by management flows', () => {
  const suffix = Date.now();
  const user = createUser({
    name: `Excluir ${suffix}`,
    email: `excluir-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });
  const contact = saveContact({
    phone: `5577${suffix}`,
    name: 'Contato Excluir'
  });

  assert.equal(deleteUser(user.id), true);
  assert.equal(deleteContact(contact.id), true);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM users WHERE id = ?').get(user.id).total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM contacts WHERE id = ?').get(contact.id).total, 0);
});

test('group contacts preserve W-API chat jid and saved names appear in conversations', () => {
  const groupJid = `120363${Date.now()}@g.us`;
  const message = createMessage({
    phone: groupJid,
    name: groupJid,
    isGroup: true,
    direction: 'inbound',
    type: 'text',
    body: 'Mensagem do grupo',
    status: 'received'
  });

  const saved = saveContact({
    phone: groupJid,
    name: 'Grupo Comercial Salvo',
    isGroup: true,
    source: 'chat'
  });
  const conversation = listConversations().find((item) => item.id === message.sessionId);

  assert.equal(saved.phone, groupJid);
  assert.equal(saved.isGroup, true);
  assert.equal(conversation.phone, groupJid);
  assert.equal(conversation.name, 'Grupo Comercial Salvo');
});

test('legacy group conversations without jid suffix are migrated to W-API group chat ids', () => {
  const suffix = Date.now();
  const legacyPhone = `120363${suffix}`;
  const groupJid = `${legacyPhone}@g.us`;
  const timestamp = new Date().toISOString();
  const contactId = randomUUID();
  const sessionId = randomUUID();
  const messageId = randomUUID();

  db.prepare(`
    INSERT INTO contacts (id, phone, name, is_group, chat_status, unread_count, created_at, updated_at)
    VALUES (?, ?, ?, 1, 'active', 0, ?, ?)
  `).run(contactId, legacyPhone, 'Grupo Legado', timestamp, timestamp);
  db.prepare(`
    INSERT INTO support_sessions (id, contact_id, phone, is_group, status, unread_count, started_at, created_at, updated_at)
    VALUES (?, ?, ?, 1, 'active', 0, ?, ?, ?)
  `).run(sessionId, contactId, legacyPhone, timestamp, timestamp, timestamp);
  db.prepare(`
    INSERT INTO messages (id, contact_id, session_id, phone, direction, type, body, status, created_at)
    VALUES (?, ?, ?, ?, 'inbound', 'text', 'Oi', 'received', ?)
  `).run(messageId, contactId, sessionId, legacyPhone, timestamp);

  normalizeLegacyGroupChatIds();

  assert.equal(db.prepare('SELECT phone FROM contacts WHERE id = ?').get(contactId).phone, groupJid);
  assert.equal(db.prepare('SELECT phone FROM support_sessions WHERE id = ?').get(sessionId).phone, groupJid);
  assert.equal(db.prepare('SELECT phone FROM messages WHERE id = ?').get(messageId).phone, groupJid);
});

test('users can persist a supported accent color preference', () => {
  const suffix = Date.now();
  const user = createUser({
    name: `Tema ${suffix}`,
    email: `tema-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true
  });

  const updated = updateUserThemeColor(user.id, 'purple');

  assert.equal(updated.themeColor, 'purple');
  assert.equal(updateUserThemeColor(user.id, 'cyan').themeColor, 'green');
});

test('users can toggle message name header preference', () => {
  const suffix = Date.now();
  const user = createUser({
    name: `Assinatura ${suffix}`,
    email: `assinatura-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    sendNameHeader: true
  });

  assert.equal(user.sendNameHeader, true);

  const updated = updateUser(user.id, { sendNameHeader: false });

  assert.equal(updated.sendNameHeader, false);
});

test('users can toggle push notification preference', () => {
  const suffix = Date.now();
  const user = createUser({
    name: `Push ${suffix}`,
    email: `push-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    pushEnabled: false
  });

  assert.equal(user.pushEnabled, false);

  const updated = updateUser(user.id, { pushEnabled: true });

  assert.equal(updated.pushEnabled, true);
});

test('push subscriptions are delivered per saved browser subscription for active users', () => {
  const suffix = Date.now();
  const enabledUser = createUser({
    name: `Push Ativo ${suffix}`,
    email: `push-ativo-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    pushEnabled: true
  });
  const disabledUser = createUser({
    name: `Push Inativo ${suffix}`,
    email: `push-inativo-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    pushEnabled: false
  });

  const first = savePushSubscription({
    userId: enabledUser.id,
    userAgent: 'Chrome Test',
    deviceLabel: 'Desktop',
    subscription: {
      endpoint: `https://push.example.test/sub-${suffix}`,
      keys: { p256dh: `key-${suffix}`, auth: `auth-${suffix}` }
    }
  });
  savePushSubscription({
    userId: disabledUser.id,
    userAgent: 'Chrome Test',
    deviceLabel: 'Desktop',
    subscription: {
      endpoint: `https://push.example.test/sub-disabled-${suffix}`,
      keys: { p256dh: `key-disabled-${suffix}`, auth: `auth-disabled-${suffix}` }
    }
  });

  const listed = listPushSubscriptionsByUserIds([enabledUser.id, disabledUser.id]);

  assert.equal(first.endpoint, `https://push.example.test/sub-${suffix}`);
  assert.equal(first.deviceLabel, 'Desktop');
  assert.equal(listed.some((item) => item.userId === enabledUser.id), true);
  assert.equal(listed.some((item) => item.userId === disabledUser.id), true);
});

test('saving the same push endpoint updates the device record instead of duplicating it', () => {
  const suffix = Date.now();
  const user = createUser({
    name: `Push Dedupe ${suffix}`,
    email: `push-dedupe-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    pushEnabled: true
  });
  const endpoint = `https://push.example.test/dedupe-${suffix}`;

  const first = savePushSubscription({
    userId: user.id,
    userAgent: 'Chrome 1',
    deviceLabel: 'Desktop 1',
    subscription: {
      endpoint,
      keys: { p256dh: `key-a-${suffix}`, auth: `auth-a-${suffix}` }
    }
  });
  const second = savePushSubscription({
    userId: user.id,
    userAgent: 'Chrome 2',
    deviceLabel: 'Desktop 2',
    subscription: {
      endpoint,
      keys: { p256dh: `key-b-${suffix}`, auth: `auth-b-${suffix}` }
    }
  });
  const count = db.prepare('SELECT COUNT(*) AS total FROM push_subscriptions WHERE endpoint = ?').get(endpoint);

  assert.equal(first.id, second.id);
  assert.equal(second.deviceLabel, 'Desktop 2');
  assert.equal(second.keys.p256dh, `key-b-${suffix}`);
  assert.equal(count.total, 1);
});

test('deleting a user removes their push subscriptions', () => {
  const suffix = Date.now();
  const user = createUser({
    name: `Push Delete ${suffix}`,
    email: `push-delete-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    pushEnabled: true
  });
  const endpoint = `https://push.example.test/delete-${suffix}`;

  savePushSubscription({
    userId: user.id,
    userAgent: 'Chrome',
    deviceLabel: 'Desktop',
    subscription: {
      endpoint,
      keys: { p256dh: `key-delete-${suffix}`, auth: `auth-delete-${suffix}` }
    }
  });

  assert.equal(deleteUser(user.id), true);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM push_subscriptions WHERE endpoint = ?').get(endpoint).total, 0);
});

test('sectors can be linked to users and transferred sessions expose sector badges', () => {
  const suffix = Date.now();
  const sector = createSector({ name: `Comercial ${suffix}`, color: 'blue', active: true });
  const user = createUser({
    name: `Setor User ${suffix}`,
    email: `setor-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    sectorIds: [sector.id]
  });
  const message = createMessage({
    phone: `551998${suffix}`,
    name: 'Cliente Setor',
    direction: 'inbound',
    type: 'text',
    body: 'Quero falar com vendas',
    status: 'received'
  });

  const transferred = transferSupportSession(message.sessionId, { targetSectorId: sector.id }, user);
  const listed = listConversations({ viewer: user }).find((item) => item.id === message.sessionId);

  assert.deepEqual(user.sectors.map((item) => item.id), [sector.id]);
  assert.equal(transferred.sectorId, sector.id);
  assert.equal(transferred.sectorName, sector.name);
  assert.equal(listed.sectorName, sector.name);
  assert.equal(listSectors().some((item) => item.id === sector.id), true);
});

test('sector scoped conversations are visible only to sector members and admins', () => {
  const suffix = Date.now();
  const sector = createSector({ name: `Triagem ${suffix}`, color: 'green', active: true });
  const otherSector = createSector({ name: `Outro Setor ${suffix}`, color: 'orange', active: true });
  const member = createUser({
    name: `Membro Setor ${suffix}`,
    email: `membro-setor-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    sectorIds: [sector.id]
  });
  const outsider = createUser({
    name: `Fora Setor ${suffix}`,
    email: `fora-setor-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'attendant',
    active: true,
    sectorIds: [otherSector.id]
  });
  const admin = createUser({
    name: `Admin Setor ${suffix}`,
    email: `admin-setor-${suffix}@example.test`,
    password: 'senha-forte',
    role: 'admin',
    active: true
  });
  const openWaiting = createMessage({
    phone: `551981${suffix}`,
    name: 'Cliente Espera Aberta',
    direction: 'inbound',
    type: 'text',
    body: 'Ainda sem setor',
    status: 'received'
  });
  const scoped = createMessage({
    phone: `551982${suffix}`,
    name: 'Cliente Setorizado',
    direction: 'inbound',
    type: 'text',
    body: 'Preciso de triagem',
    status: 'received'
  });

  transferSupportSession(scoped.sessionId, { targetSectorId: sector.id }, admin);

  const memberVisible = listConversations({ viewer: member }).map((item) => item.id);
  const outsiderVisible = listConversations({ viewer: outsider }).map((item) => item.id);
  const adminVisible = listConversations({ viewer: admin }).map((item) => item.id);

  assert.equal(memberVisible.includes(openWaiting.sessionId), true);
  assert.equal(memberVisible.includes(scoped.sessionId), true);
  assert.equal(outsiderVisible.includes(openWaiting.sessionId), true);
  assert.equal(outsiderVisible.includes(scoped.sessionId), false);
  assert.equal(adminVisible.includes(scoped.sessionId), true);
  assert.equal(canAccessSupportSession(scoped.sessionId, member), true);
  assert.equal(canAccessSupportSession(scoped.sessionId, outsider), false);
  assert.equal(canAccessSupportSession(openWaiting.sessionId, outsider), true);
  assert.equal(canAccessSupportSession(scoped.sessionId, admin), true);
});

test('support tags can be attached to attendances and are mapped in conversations', () => {
  const suffix = Date.now();
  const tag = createSupportTag({ name: `Urgente ${suffix}`, color: 'red', active: true });
  const message = createMessage({
    phone: `551197${suffix}`,
    name: 'Cliente Tag',
    direction: 'inbound',
    type: 'text',
    body: 'Preciso resolver agora',
    status: 'received'
  });

  const tagged = setSupportSessionTags(message.sessionId, [tag.id]);
  const listed = listConversations().find((item) => item.id === message.sessionId);

  assert.equal(listSupportTags().some((item) => item.id === tag.id), true);
  assert.equal(tagged.tags.length, 1);
  assert.equal(listed.tags[0].id, tag.id);
  assert.equal(listed.tags[0].name, tag.name);
});

test('opening a support session can clear unread message count', () => {
  const suffix = Date.now();
  const message = createMessage({
    phone: `551196${suffix}`,
    name: 'Cliente Leitura',
    direction: 'inbound',
    type: 'text',
    body: 'Tem mensagem pendente',
    status: 'received'
  });

  const unread = listConversations().find((item) => item.id === message.sessionId);
  assert.equal(unread.unreadCount, 1);

  const read = markSupportSessionRead(message.sessionId);
  const listed = listConversations().find((item) => item.id === message.sessionId);
  const contact = getContactByPhone(message.phone);

  assert.equal(read.unreadCount, 0);
  assert.equal(listed.unreadCount, 0);
  assert.equal(contact.unreadCount, 0);
});

test('ai agents are persisted with transfer targets and admin configuration fields', () => {
  const suffix = Date.now();
  const sector = createSector({ name: `Suporte ${suffix}`, color: 'green', active: true });
  const agent = createAiAgent({
    name: `Agente ${suffix}`,
    active: true,
    model: 'gemini-2.0-flash',
    temperature: 0.4,
    context: 'Atende clientes novos',
    rules: 'Nao inventar valores',
    behavior: 'Tom direto e cordial',
    transferMode: 'sector',
    transferSectorId: sector.id
  });

  const found = getAiAgentById(agent.id);

  assert.equal(found.name, agent.name);
  assert.equal(found.transferMode, 'sector');
  assert.equal(found.transferSectorId, sector.id);
  assert.equal(listAiAgents().some((item) => item.id === agent.id), true);
});
