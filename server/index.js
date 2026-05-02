import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import {
  authenticateUser,
  createMessage,
  createAiAgent,
  createAuthSession,
  createSector,
  createSupportTag,
  buildDashboardMetrics,
  buildSupportMetrics,
  deleteContact,
  deleteAiAgent,
  deleteSupportSession,
  deleteAuthSession,
  deleteSector,
  deleteSupportTag,
  deleteUser,
  getMessageById,
  getAuthSessionUser,
  getContactById,
  canAccessSupportSession,
  getAiAgentById,
  listConversations,
  listContacts,
  listMessages,
  listAiAgents,
  listSectors,
  listSupportSessions,
  listSupportTags,
  listUsersTable,
  listUsers,
  listWebhookEvents,
  markSupportSessionRead,
  publicSettings,
  reopenSupportSession,
  saveSettings,
  saveContact,
  saveWebhookEvent,
  saveAiAgent,
  saveSector,
  saveSupportTag,
  setSupportSessionSector,
  setSupportSessionTags,
  createUser,
  updateUser,
  updateUserPassword,
  updateUserThemeColor,
  transferSupportSession,
  updateSupportSessionStatus
} from './db.js';
import {
  getInstanceStatus,
  getPaymentStatus,
  getQrCode,
  sendAudioMessage,
  sendDocumentMessage,
  sendImageMessage,
  sendTextMessage,
  sendVideoMessage,
  updateWebhook
} from './wapi.js';
import { downloadAndDecryptWhatsAppMedia } from './media.js';
import { prepareAudioForWapi } from './outbound-audio.js';
import { buildMediaRawMetadata, mediaFallbackText, normalizeOutboundMedia } from './outbound-media.js';
import { applyMessageNameHeader } from './outbound-message.js';
import { loadOutboundUploadAsDataUrl, persistOutboundMediaBuffer, persistOutboundMediaReference } from './outbound-storage.js';
import { normalizePaymentStatus } from './payment.js';
import { isGroupPayload, isReactionPayload, normalizeIncomingMessage, normalizeWebhookBatch } from './normalize.js';
import { runAutomaticAgentForMessage } from './ai-agents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3333);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '120mb';
const OUTBOUND_UPLOAD_BODY_LIMIT = process.env.OUTBOUND_UPLOAD_BODY_LIMIT || '80mb';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use('/uploads', express.static(path.resolve('uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const user = authenticateUser(req.body?.email, req.body?.password);
  if (!user) {
    return res.status(401).json({ message: 'Email ou senha invalidos.' });
  }
  const session = createAuthSession(user.id);
  setSessionCookie(res, session.id);
  res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  deleteAuthSession(getSessionId(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.use('/api', requireAuth);

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user });
});

app.patch('/api/auth/me/preferences', (req, res) => {
  const changes = {};
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'themeColor')) {
    changes.themeColor = req.body.themeColor;
  }
  const user = Object.keys(changes).length === 1 && Object.prototype.hasOwnProperty.call(changes, 'themeColor')
    ? updateUserThemeColor(req.user.id, changes.themeColor)
    : updateUser(req.user.id, changes);
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });
  req.user = user;
  res.json({ user });
});

app.get('/api/settings', (_req, res) => {
  res.json(publicSettings());
});

app.put('/api/settings', requireAdmin, (req, res) => {
  res.json(saveSettings(req.body || {}));
});

app.get('/api/users', (req, res) => {
  res.json(listUsers({ activeOnly: req.user.role !== 'admin' }));
});

app.get('/api/users/table', requireAdmin, (req, res) => {
  res.json(listUsersTable(req.query || {}));
});

app.post('/api/users', requireAdmin, (req, res) => {
  res.status(201).json({ user: createUser(req.body || {}) });
});

app.patch('/api/users/:id', requireAdmin, (req, res) => {
  const user = updateUser(req.params.id, req.body || {});
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });
  res.json({ user });
});

app.patch('/api/users/:id/password', requireAdmin, (req, res) => {
  const user = updateUserPassword(req.params.id, req.body?.password);
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });
  res.json({ user });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'Nao e possivel apagar o proprio usuario conectado.' });
  }
  if (!deleteUser(req.params.id)) return res.status(404).json({ message: 'Usuario nao encontrado.' });
  emitConversations();
  res.json({ ok: true });
});

app.get('/api/sectors', (req, res) => {
  res.json(listSectors({ activeOnly: req.user.role !== 'admin' }));
});

app.post('/api/sectors', requireAdmin, (req, res) => {
  res.status(201).json({ sector: createSector(req.body || {}) });
});

app.patch('/api/sectors/:id', requireAdmin, (req, res) => {
  const sector = saveSector({ ...req.body, id: req.params.id });
  if (!sector) return res.status(404).json({ message: 'Setor nao encontrado.' });
  res.json({ sector });
});

app.delete('/api/sectors/:id', requireAdmin, (req, res) => {
  if (!deleteSector(req.params.id)) return res.status(404).json({ message: 'Setor nao encontrado.' });
  emitConversations();
  res.json({ ok: true });
});

app.get('/api/support-tags', (req, res) => {
  res.json(listSupportTags({ activeOnly: req.user.role !== 'admin' }));
});

app.post('/api/support-tags', requireAdmin, (req, res) => {
  res.status(201).json({ tag: createSupportTag(req.body || {}) });
});

app.patch('/api/support-tags/:id', requireAdmin, (req, res) => {
  const tag = saveSupportTag({ ...req.body, id: req.params.id });
  if (!tag) return res.status(404).json({ message: 'Tag nao encontrada.' });
  res.json({ tag });
});

app.delete('/api/support-tags/:id', requireAdmin, (req, res) => {
  if (!deleteSupportTag(req.params.id)) return res.status(404).json({ message: 'Tag nao encontrada.' });
  emitConversations();
  res.json({ ok: true });
});

app.get('/api/ai-agents', requireAdmin, (_req, res) => {
  res.json(listAiAgents());
});

app.post('/api/ai-agents', requireAdmin, (req, res) => {
  res.status(201).json({ agent: createAiAgent(req.body || {}) });
});

app.patch('/api/ai-agents/:id', requireAdmin, (req, res) => {
  if (!getAiAgentById(req.params.id)) return res.status(404).json({ message: 'Agente nao encontrado.' });
  res.json({ agent: saveAiAgent({ ...req.body, id: req.params.id }) });
});

app.delete('/api/ai-agents/:id', requireAdmin, (req, res) => {
  if (!deleteAiAgent(req.params.id)) return res.status(404).json({ message: 'Agente nao encontrado.' });
  res.json({ ok: true });
});

app.get('/api/contacts', (req, res) => {
  res.json(listContacts(req.query || {}));
});

app.post('/api/contacts', (req, res) => {
  res.status(201).json({ contact: saveContact(req.body || {}) });
});

app.get('/api/contacts/:id', (req, res) => {
  const contact = getContactById(req.params.id);
  if (!contact) return res.status(404).json({ message: 'Contato nao encontrado.' });
  res.json({ contact });
});

app.patch('/api/contacts/:id', (req, res) => {
  const existing = getContactById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Contato nao encontrado.' });
  res.json({ contact: saveContact({ ...existing, ...req.body, phone: req.body?.phone || existing.phone }) });
});

app.delete('/api/contacts/:id', (req, res) => {
  if (!deleteContact(req.params.id)) return res.status(404).json({ message: 'Contato nao encontrado.' });
  emitConversations();
  res.json({ ok: true });
});

app.get('/api/conversations', (req, res) => {
  res.json(listConversations({ viewer: req.user }));
});

app.get('/api/support-sessions', (req, res) => {
  res.json(listSupportSessions({ ...parsePeriodQuery(req.query), viewer: req.user }));
});

app.get('/api/support-metrics', (req, res) => {
  res.json(buildSupportMetrics({ ...parsePeriodQuery(req.query), viewer: req.user }));
});

app.get('/api/dashboard', (req, res) => {
  res.json(buildDashboardMetrics({ ...parsePeriodQuery(req.query), viewer: req.user }));
});

app.get('/api/support-sessions/:id/messages', (req, res) => {
  if (!canAccessSupportSession(req.params.id, req.user)) {
    return res.status(403).json({ message: 'Atendimento fora da sua responsabilidade.' });
  }
  res.json(listMessages(req.params.id));
});

app.get('/api/conversations/:id/messages', (req, res) => {
  if (!canAccessSupportSession(req.params.id, req.user)) {
    return res.status(403).json({ message: 'Atendimento fora da sua responsabilidade.' });
  }
  res.json(listMessages(req.params.id));
});

app.patch('/api/support-sessions/:id/read', (req, res) => {
  if (!canAccessSupportSession(req.params.id, req.user)) {
    return res.status(403).json({ message: 'Atendimento fora da sua responsabilidade.' });
  }
  const conversation = markSupportSessionRead(req.params.id);
  if (!conversation) return res.status(404).json({ message: 'Atendimento nao encontrado.' });
  emitConversations();
  res.json({ conversation });
});

app.patch('/api/support-sessions/:id/status', (req, res) => {
  const conversation = updateSupportSessionStatus(req.params.id, req.body?.status, req.user);
  if (!conversation) {
    return res.status(404).json({ message: 'Atendimento nao encontrado.' });
  }

  emitConversations();
  res.json({ conversation });
});

app.post('/api/support-sessions/:id/reopen', (req, res) => {
  const conversation = reopenSupportSession(req.params.id, req.user);
  if (!conversation) {
    return res.status(404).json({ message: 'Atendimento nao encontrado.' });
  }

  emitConversations();
  res.json({ conversation });
});

app.post('/api/support-sessions/:id/transfer', (req, res) => {
  const conversation = transferSupportSession(req.params.id, {
    targetUserId: req.body?.targetUserId,
    targetSectorId: req.body?.targetSectorId
  }, req.user);
  if (!conversation) {
    return res.status(404).json({ message: 'Atendimento nao encontrado.' });
  }

  emitConversations();
  res.json({ conversation });
});

app.patch('/api/support-sessions/:id/tags', (req, res) => {
  if (!canAccessSupportSession(req.params.id, req.user)) {
    return res.status(403).json({ message: 'Atendimento fora da sua responsabilidade.' });
  }
  const conversation = setSupportSessionTags(req.params.id, req.body?.tagIds || []);
  if (!conversation) return res.status(404).json({ message: 'Atendimento nao encontrado.' });
  emitConversations();
  res.json({ conversation });
});

app.patch('/api/support-sessions/:id/sector', (req, res) => {
  if (!canAccessSupportSession(req.params.id, req.user)) {
    return res.status(403).json({ message: 'Atendimento fora da sua responsabilidade.' });
  }
  const conversation = setSupportSessionSector(req.params.id, req.body?.sectorId || '', req.user);
  if (!conversation) return res.status(404).json({ message: 'Atendimento nao encontrado.' });
  emitConversations();
  res.json({ conversation });
});

app.delete('/api/support-sessions/:id', (req, res) => {
  if (!deleteSupportSession(req.params.id)) {
    return res.status(404).json({ message: 'Atendimento nao encontrado.' });
  }

  emitConversations();
  res.json({ ok: true });
});

app.get('/api/messages/:id/media', asyncHandler(async (req, res) => {
  const message = getMessageById(req.params.id);
  if (!message) {
    return res.status(404).json({ message: 'Mensagem nao encontrada.' });
  }

  const media = await downloadAndDecryptWhatsAppMedia(message.raw);
  res.setHeader('Content-Type', media.mimetype);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  if (media.fileName) res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(media.fileName)}"`);
  res.send(media.buffer);
}));

app.get('/api/webhook-events', (_req, res) => {
  res.json(listWebhookEvents());
});

app.get('/api/wapi/status', requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await getInstanceStatus());
}));

app.get('/api/wapi/payment/status', requireAdmin, asyncHandler(async (_req, res) => {
  const raw = await getPaymentStatus();
  res.json({
    invoice: normalizePaymentStatus(raw),
    raw
  });
}));

app.get('/api/wapi/qr-code', requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await getQrCode());
}));

app.post('/api/messages/upload', express.raw({ type: '*/*', limit: OUTBOUND_UPLOAD_BODY_LIMIT }), asyncHandler(async (req, res) => {
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!buffer.length) {
    return res.status(400).json({ message: 'Arquivo de midia vazio.' });
  }

  const fileName = decodeHeaderValue(req.get('x-wapi-file-name')) || 'arquivo';
  const extension = cleanExtension(req.get('x-wapi-file-extension') || path.extname(fileName));
  const mimeType = cleanUploadMimeType(req.get('x-wapi-mime-type') || req.get('content-type'), extension);
  const media = normalizeOutboundMedia({
    type: req.get('x-wapi-media-type') || '',
    url: 'uploaded-media',
    name: fileName,
    mimeType,
    extension,
    size: buffer.length
  });
  const stored = persistOutboundMediaBuffer(media, buffer);

  res.status(201).json({
    media: {
      type: stored.type,
      uploadId: stored.uploadId,
      publicPath: stored.publicPath,
      fileName: stored.fileName,
      name: stored.fileName,
      mimeType: stored.mimeType,
      extension: stored.extension,
      size: stored.size
    }
  });
}));

app.post('/api/messages/send', asyncHandler(async (req, res) => {
  const phone = cleanPhone(req.body?.phone);
  const body = String(req.body?.message || '').trim();
  const outboundBody = applyMessageNameHeader(body, req.user);
  const media = resolveOutboundMedia(req.body || {});
  const hasMedia = Boolean(media);
  const wapiMedia = hasMedia ? await prepareAudioForWapi(media) : null;
  const storedMedia = hasMedia ? persistOutboundMediaReference(wapiMedia) : null;
  const replyToMessageId = String(req.body?.replyToMessageId || '').trim() || null;
  const replyToExternalId = String(req.body?.replyToExternalId || '').trim();
  const replyPreview = String(req.body?.replyPreview || '').trim().slice(0, 220) || null;

  if (!phone || (!body && !hasMedia)) {
    return res.status(400).json({ message: 'Informe telefone e mensagem ou midia.' });
  }

  const result = hasMedia
    ? await sendWapiMediaMessage({ phone, body: outboundBody, media: wapiMedia, messageId: replyToExternalId })
    : await sendTextMessage({ phone, message: outboundBody, messageId: replyToExternalId });
  const mediaRaw = buildMediaRawMetadata(storedMedia || wapiMedia);
  const message = createMessage({
    phone,
    sessionId: req.body?.sessionId || null,
    direction: 'outbound',
    type: hasMedia ? wapiMedia.type : 'text',
    body: outboundBody || (hasMedia ? mediaFallbackText(wapiMedia.type) : ''),
    status: 'sent',
    externalId: result?.messageId || result?.id || null,
    mediaPath: storedMedia?.publicPath || null,
    media: mediaRaw,
    replyToMessageId,
    replyPreview,
    raw: {
      ...result,
      normalizedMedia: mediaRaw,
      replyToMessageId,
      replyToExternalId: replyToExternalId || null
    }
  });
  if (hasMedia && !message.mediaPath) {
    message.previewMedia = storedMedia?.publicPath || media.reference;
    if (wapiMedia.type === 'image') message.previewImage = storedMedia?.publicPath || wapiMedia.reference;
  }

  emitState(message);
  res.json({ message, wapi: result });
}));

app.put('/api/wapi/webhooks/register', requireAdmin, asyncHandler(async (req, res) => {
  const baseUrl = String(req.body?.webhookPublicUrl || publicSettings().webhookPublicUrl || '').replace(/\/$/, '');
  if (!baseUrl) {
    return res.status(400).json({ message: 'Informe uma URL publica para registrar os webhooks.' });
  }

  const targets = {
    connected: `${baseUrl}/webhooks/wapi/connected`,
    disconnected: `${baseUrl}/webhooks/wapi/disconnected`,
    delivery: `${baseUrl}/webhooks/wapi/delivery`,
    received: `${baseUrl}/webhooks/wapi/received`,
    messageStatus: `${baseUrl}/webhooks/wapi/message-status`,
    presence: `${baseUrl}/webhooks/wapi/presence`
  };

  const results = {};
  for (const [kind, url] of Object.entries(targets)) {
    results[kind] = await updateWebhook(kind, url);
  }

  saveSettings({ webhookPublicUrl: baseUrl });
  res.json({ targets, results });
}));

app.post('/webhooks/wapi/:event', (req, res) => {
  const eventType = req.params.event || 'received';
  saveWebhookEvent(eventType, req.body);

  const stored = [];
  if (['received', 'delivery', 'message-status'].includes(eventType)) {
    const settings = publicSettings();
    for (const item of normalizeWebhookBatch(req.body)) {
      if (isReactionPayload(item)) continue;
      if (settings.ignoreGroups && isGroupPayload(item)) continue;
      const normalized = normalizeIncomingMessage(item, eventType);
      if (normalized.phone) {
        const direction = normalized.fromMe || eventType !== 'received' ? 'outbound' : 'inbound';
        const message = createMessage({
          ...normalized,
          direction,
          status: resolveWebhookMessageStatus(item, eventType, direction)
        });
        if (message) stored.push(message);
      }
    }
  }

  io.emit('webhook:event', { eventType, payload: req.body, stored });
  for (const message of stored) {
    emitState(message);
    scheduleAutomaticAgent(message);
  }

  res.json({ ok: true, stored: stored.length });
});

const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use((_req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

io.on('connection', (socket) => {
  socket.data.user = getAuthSessionUser(parseCookies(socket.handshake.headers.cookie || '').wapi_session);
  socket.emit('app:ready', { at: new Date().toISOString() });
  if (socket.data.user) {
    socket.emit('conversations:update', listConversations({ viewer: socket.data.user }));
  }
});

server.listen(PORT, () => {
  console.log(`W-API Atendimento server on http://localhost:${PORT}`);
});

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function requireAuth(req, res, next) {
  const user = getAuthSessionUser(getSessionId(req));
  if (!user) {
    return res.status(401).json({ message: 'Sessao expirada. Faca login novamente.' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
  }
  next();
}

app.use((error, _req, res, _next) => {
  const status = error.status || (error.type === 'entity.too.large' ? 413 : 500);
  res.status(status).json({
    message: error.type === 'entity.too.large'
      ? 'Arquivo muito grande para envio. Reduza ou comprima a midia antes de tentar novamente.'
      : error.message || 'Erro interno',
    details: error.payload || undefined
  });
});

function emitState(message) {
  io.emit('message:new', message);
  emitConversations();
}

function emitConversations() {
  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user;
    if (user) socket.emit('conversations:update', listConversations({ viewer: user }));
  }
}

function scheduleAutomaticAgent(message) {
  if (message.direction !== 'inbound') return;
  setTimeout(async () => {
    try {
      const result = await runAutomaticAgentForMessage(message);
      if (result?.reply) emitState(result.reply);
      if (result?.transferred) emitConversations();
    } catch (error) {
      console.error('Automatic attendance failed:', error.message || error);
    }
  }, 0);
}

function cleanPhone(value) {
  const cleaned = String(value || '').replace(/\s/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.toLowerCase().endsWith('@g.us')) return cleaned;
  return cleaned.split('@')[0];
}

function resolveOutboundMedia(body) {
  if (body?.media && typeof body.media === 'object') {
    if (body.media.uploadId) {
      const uploaded = loadOutboundUploadAsDataUrl(body.media);
      const normalized = normalizeOutboundMedia({ ...uploaded, dataUrl: uploaded.reference });
      return {
        ...normalized,
        uploadId: uploaded.uploadId,
        publicPath: uploaded.publicPath,
        relativePath: uploaded.relativePath
      };
    }
    return normalizeOutboundMedia(body.media);
  }

  const legacyImage = String(body?.image || '').trim();
  if (!legacyImage) return null;
  return normalizeOutboundMedia({
    type: 'image',
    dataUrl: legacyImage,
    name: body.imageName || 'imagem.jpg',
    mimeType: legacyImage.startsWith('data:image/') ? legacyImage.slice(5, legacyImage.indexOf(';')) : ''
  });
}

function sendWapiMediaMessage({ phone, body, media, messageId }) {
  if (media.type === 'image') {
    return sendImageMessage({ phone, image: media.reference, caption: body, messageId });
  }
  if (media.type === 'audio') {
    return sendAudioMessage({ phone, audio: media.reference, messageId });
  }
  if (media.type === 'video') {
    return sendVideoMessage({ phone, video: media.reference, caption: body, messageId });
  }
  if (media.type === 'document') {
    return sendDocumentMessage({
      phone,
      document: media.reference,
      extension: media.extension,
      fileName: media.fileName,
      caption: body,
      messageId
    });
  }

  const error = new Error('Tipo de midia nao suportado.');
  error.status = 400;
  throw error;
}

function resolveWebhookMessageStatus(payload, eventType, direction) {
  if (direction === 'inbound') return 'received';
  const raw = payload?.data || payload?.message || payload || {};
  const value = firstString([
    raw.status,
    raw.messageStatus,
    raw.deliveryStatus,
    raw.ack,
    payload?.status,
    payload?.messageStatus
  ]);
  if (value) return value;
  if (eventType === 'message-status') return 'updated';
  if (eventType === 'delivery') return 'delivered';
  return 'sent';
}

function firstString(values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function decodeHeaderValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function cleanUploadMimeType(value, extension = '') {
  const mimeType = String(value || '').split(';')[0].trim().toLowerCase();
  if (mimeType === 'application/octet-stream' && extension) return '';
  return mimeType;
}

function cleanExtension(value) {
  return String(value || '').replace(/^\./, '').trim().toLowerCase();
}

function parsePeriodQuery(query) {
  return {
    from: query?.from ? String(query.from) : '',
    to: query?.to ? String(query.to) : ''
  };
}

function getSessionId(req) {
  return parseCookies(req.headers.cookie || '').wapi_session || '';
}

function parseCookies(header) {
  return String(header || '').split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', [
    `wapi_session=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  ]);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'wapi_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
}
