import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  getNextSessionStatusForMessage,
  normalizeConversationStatus,
  shouldCreateNewSessionForMessage
} from './conversation-status.js';

const DB_PATH = process.env.WAPI_DB_PATH ? path.resolve(process.env.WAPI_DB_PATH) : path.join(path.resolve('data'), 'app.sqlite');
const DATA_DIR = path.dirname(DB_PATH);
const UPLOAD_DIR = path.resolve(process.env.WAPI_UPLOAD_DIR || 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'attendant',
    theme_color TEXT NOT NULL DEFAULT 'green',
    send_name_header INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'green',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_sectors (
    user_id TEXT NOT NULL,
    sector_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, sector_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar_url TEXT,
    is_group INTEGER NOT NULL DEFAULT 0,
    chat_status TEXT NOT NULL DEFAULT 'waiting',
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_sessions (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_group INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'waiting',
    unread_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    closed_at TEXT,
    last_message_at TEXT,
    assigned_user_id TEXT,
    sector_id TEXT,
    agent_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id),
    FOREIGN KEY (sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    external_id TEXT,
    contact_id TEXT NOT NULL,
    session_id TEXT,
    phone TEXT NOT NULL,
    sender_name TEXT,
    sender_phone TEXT,
    direction TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    body TEXT,
    status TEXT NOT NULL DEFAULT 'stored',
    media_path TEXT,
    reply_to_message_id TEXT,
    reply_to_external_id TEXT,
    reply_preview TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id),
    FOREIGN KEY (session_id) REFERENCES support_sessions(id)
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor_user_id TEXT,
    target_user_id TEXT,
    target_sector_id TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES support_sessions(id),
    FOREIGN KEY (actor_user_id) REFERENCES users(id),
    FOREIGN KEY (target_user_id) REFERENCES users(id),
    FOREIGN KEY (target_sector_id) REFERENCES sectors(id)
  );

  CREATE TABLE IF NOT EXISTS support_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'green',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_session_tags (
    session_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (session_id, tag_id),
    FOREIGN KEY (session_id) REFERENCES support_sessions(id),
    FOREIGN KEY (tag_id) REFERENCES support_tags(id)
  );

  CREATE TABLE IF NOT EXISTS ai_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    temperature REAL NOT NULL DEFAULT 0.4,
    context TEXT NOT NULL DEFAULT '',
    rules TEXT NOT NULL DEFAULT '',
    behavior TEXT NOT NULL DEFAULT '',
    transfer_mode TEXT NOT NULL DEFAULT 'none',
    transfer_user_id TEXT,
    transfer_sector_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (transfer_user_id) REFERENCES users(id),
    FOREIGN KEY (transfer_sector_id) REFERENCES sectors(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_phone_created ON messages(phone, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_external ON messages(external_id);
  CREATE INDEX IF NOT EXISTS idx_contacts_last_message ON contacts(last_message_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_status_last_message ON support_sessions(status, last_message_at);
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_session_events_session ON support_session_events(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_user_sectors_sector ON user_sectors(sector_id);
  CREATE INDEX IF NOT EXISTS idx_session_tags_tag ON support_session_tags(tag_id);
`);

ensureColumn('users', 'theme_color', "TEXT NOT NULL DEFAULT 'green'");
ensureColumn('users', 'send_name_header', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('contacts', 'chat_status', "TEXT NOT NULL DEFAULT 'waiting'");
ensureColumn('contacts', 'is_group', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('contacts', 'email', 'TEXT');
ensureColumn('contacts', 'address', 'TEXT');
ensureColumn('contacts', 'latitude', 'TEXT');
ensureColumn('contacts', 'longitude', 'TEXT');
ensureColumn('contacts', 'notes', 'TEXT');
ensureColumn('contacts', 'tags', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('contacts', 'status', "TEXT NOT NULL DEFAULT 'active'");
ensureColumn('contacts', 'source', "TEXT NOT NULL DEFAULT 'manual'");
ensureColumn('messages', 'session_id', 'TEXT');
ensureColumn('messages', 'sender_name', 'TEXT');
ensureColumn('messages', 'sender_phone', 'TEXT');
ensureColumn('messages', 'reply_to_message_id', 'TEXT');
ensureColumn('messages', 'reply_to_external_id', 'TEXT');
ensureColumn('messages', 'reply_preview', 'TEXT');
ensureColumn('support_sessions', 'is_group', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('support_sessions', 'assigned_user_id', 'TEXT');
ensureColumn('support_sessions', 'sector_id', 'TEXT');
ensureColumn('support_sessions', 'agent_id', 'TEXT');
ensureColumn('support_session_events', 'target_sector_id', 'TEXT');
db.exec('CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_assigned_user ON support_sessions(assigned_user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_sector ON support_sessions(sector_id)');

const now = () => new Date().toISOString();

const envDefaults = {
  baseUrl: process.env.WAPI_BASE_URL || 'https://api.w-api.app',
  instanceId: process.env.WAPI_INSTANCE_ID || '',
  instanceJid: process.env.WAPI_INSTANCE_JID || '',
  token: process.env.WAPI_TOKEN || '',
  webhookPublicUrl: process.env.WEBHOOK_PUBLIC_URL || '',
  ignoreGroups: process.env.WAPI_IGNORE_GROUPS || 'false',
  automaticAttendance: process.env.WAPI_AUTOMATIC_ATTENDANCE || 'false',
  geminiApiKey: process.env.GEMINI_API_KEY || ''
};

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE name = ?');
const setSettingStmt = db.prepare(`
  INSERT INTO settings (name, value) VALUES (?, ?)
  ON CONFLICT(name) DO UPDATE SET value = excluded.value
`);

const findContactStmt = db.prepare('SELECT * FROM contacts WHERE phone = ?');
const findSessionStmt = db.prepare('SELECT * FROM support_sessions WHERE id = ?');
const findUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const findUserByEmailStmt = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)');
const findSectorStmt = db.prepare('SELECT * FROM sectors WHERE id = ?');
const findSupportTagStmt = db.prepare('SELECT * FROM support_tags WHERE id = ?');
const findAiAgentStmt = db.prepare('SELECT * FROM ai_agents WHERE id = ?');

const insertContactStmt = db.prepare(`
  INSERT INTO contacts (id, phone, name, avatar_url, is_group, chat_status, unread_count, last_message_at, created_at, updated_at)
  VALUES (@id, @phone, @name, @avatarUrl, @isGroup, @chatStatus, @unreadCount, @lastMessageAt, @createdAt, @updatedAt)
`);

const updateContactStmt = db.prepare(`
  UPDATE contacts
  SET name = COALESCE(@name, name),
      avatar_url = COALESCE(@avatarUrl, avatar_url),
      is_group = @isGroup,
      chat_status = @chatStatus,
      unread_count = @unreadCount,
      last_message_at = @lastMessageAt,
      updated_at = @updatedAt
  WHERE id = @id
`);

const insertSessionStmt = db.prepare(`
  INSERT INTO support_sessions (
    id, contact_id, phone, is_group, status, unread_count, started_at, closed_at,
    last_message_at, assigned_user_id, sector_id, agent_id, created_at, updated_at
  )
  VALUES (
    @id, @contactId, @phone, @isGroup, @status, @unreadCount, @startedAt, @closedAt,
    @lastMessageAt, @assignedUserId, @sectorId, @agentId, @createdAt, @updatedAt
  )
`);

migrateLegacySessions();
normalizeLegacyGroupChatIds();
cleanupWebhookStatusArtifacts();
ensureDefaultAdminUser();

export function getSettings() {
  return Object.fromEntries(
    Object.entries(envDefaults).map(([key, fallback]) => {
      const found = getSettingStmt.get(key);
      return [key, found?.value ?? fallback];
    })
  );
}

export function publicSettings() {
  const settings = getSettings();
  return {
    baseUrl: settings.baseUrl,
    instanceId: settings.instanceId,
    instanceJid: settings.instanceJid,
    webhookPublicUrl: settings.webhookPublicUrl,
    hasToken: Boolean(settings.token),
    ignoreGroups: settings.ignoreGroups === 'true',
    automaticAttendance: settings.automaticAttendance === 'true',
    hasGeminiApiKey: Boolean(settings.geminiApiKey)
  };
}

export function saveSettings(nextSettings) {
  const writable = ['baseUrl', 'instanceId', 'instanceJid', 'token', 'webhookPublicUrl', 'ignoreGroups', 'automaticAttendance', 'geminiApiKey'];
  const tx = db.transaction(() => {
    for (const key of writable) {
      if (Object.prototype.hasOwnProperty.call(nextSettings, key)) {
        if (['ignoreGroups', 'automaticAttendance'].includes(key)) {
          setSettingStmt.run(key, nextSettings[key] ? 'true' : 'false');
        } else {
          setSettingStmt.run(key, String(nextSettings[key] ?? ''));
        }
      }
    }
  });
  tx();
  return publicSettings();
}

function ensureDefaultAdminUser() {
  const total = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (total > 0) return;
  createUser({
    name: 'Administrador',
    email: 'admim@wapi.local',
    password: '123',
    role: 'admin',
    active: true
  });
}

export function cleanupWebhookStatusArtifacts() {
  const artifacts = db.prepare(`
    SELECT id, session_id, phone
    FROM messages
    WHERE type = 'message-status'
      AND body = '[message-status]'
      AND raw_json LIKE '%"event":"webhookStatus"%'
  `).all();
  const sessions = [...new Set(artifacts.map((item) => item.session_id).filter(Boolean))];
  const phones = [...new Set(artifacts.map((item) => item.phone).filter(Boolean))];
  let removedSessions = 0;
  let removedEmptySessions = 0;

  const tx = db.transaction(() => {
    if (artifacts.length) {
      db.prepare(`
        DELETE FROM messages
        WHERE type = 'message-status'
          AND body = '[message-status]'
          AND raw_json LIKE '%"event":"webhookStatus"%'
      `).run();

      for (const sessionId of sessions) {
        const remainingMessages = db.prepare('SELECT COUNT(*) AS total FROM messages WHERE session_id = ?').get(sessionId).total;
        const remainingEvents = db.prepare('SELECT COUNT(*) AS total FROM support_session_events WHERE session_id = ?').get(sessionId).total;
        const remainingTags = db.prepare('SELECT COUNT(*) AS total FROM support_session_tags WHERE session_id = ?').get(sessionId).total;
        if (remainingMessages === 0 && remainingEvents === 0 && remainingTags === 0) {
          db.prepare('DELETE FROM support_sessions WHERE id = ?').run(sessionId);
          removedSessions += 1;
        }
      }
    }

    const emptySessions = db.prepare(`
      SELECT s.id, s.phone
      FROM support_sessions s
      WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM support_session_events e WHERE e.session_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM support_session_tags t WHERE t.session_id = s.id)
    `).all();
    for (const session of emptySessions) {
      if (!sessions.includes(session.id)) {
        db.prepare('DELETE FROM support_sessions WHERE id = ?').run(session.id);
        removedEmptySessions += 1;
        if (session.phone) phones.push(session.phone);
      }
    }
  });
  tx();

  for (const phone of phones) {
    syncContactFromLatestSession(phone);
  }

  return { messages: artifacts.length, sessions: removedSessions, emptySessions: removedEmptySessions };
}

export function createUser({ name, email, password, role = 'attendant', active = true, themeColor = 'green', sendNameHeader = false, sectorIds = [] }) {
  const cleanEmail = normalizeEmail(email);
  if (!name || !cleanEmail || !password) {
    const error = new Error('Informe nome, email e senha.');
    error.status = 400;
    throw error;
  }
  if (findUserByEmailStmt.get(cleanEmail)) {
    const error = new Error('Email ja cadastrado.');
    error.status = 409;
    throw error;
  }

  const timestamp = now();
  const row = {
    id: randomUUID(),
    name: String(name).trim(),
    email: cleanEmail,
    passwordHash: hashPassword(password),
    role: normalizeUserRole(role),
    themeColor: normalizeAccentColor(themeColor),
    sendNameHeader: sendNameHeader ? 1 : 0,
    active: active ? 1 : 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, theme_color, send_name_header, active, created_at, updated_at)
    VALUES (@id, @name, @email, @passwordHash, @role, @themeColor, @sendNameHeader, @active, @createdAt, @updatedAt)
  `).run(row);
  setUserSectorIds(row.id, sectorIds);

  return mapUser(findUserStmt.get(row.id));
}

export function updateUser(id, changes = {}) {
  const existing = findUserStmt.get(id);
  if (!existing) return null;
  const email = Object.prototype.hasOwnProperty.call(changes, 'email') ? normalizeEmail(changes.email) : existing.email;
  const duplicate = email !== existing.email ? findUserByEmailStmt.get(email) : null;
  if (duplicate) {
    const error = new Error('Email ja cadastrado.');
    error.status = 409;
    throw error;
  }

  db.prepare(`
    UPDATE users
    SET name = @name,
        email = @email,
        role = @role,
        theme_color = @themeColor,
        send_name_header = @sendNameHeader,
        active = @active,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    name: String(changes.name ?? existing.name).trim(),
    email,
    role: normalizeUserRole(changes.role ?? existing.role),
    themeColor: normalizeAccentColor(changes.themeColor ?? changes.theme_color ?? existing.theme_color),
    sendNameHeader: Object.prototype.hasOwnProperty.call(changes, 'sendNameHeader')
      ? (changes.sendNameHeader ? 1 : 0)
      : Object.prototype.hasOwnProperty.call(changes, 'send_name_header')
        ? (changes.send_name_header ? 1 : 0)
        : existing.send_name_header,
    active: Object.prototype.hasOwnProperty.call(changes, 'active') ? (changes.active ? 1 : 0) : existing.active,
    updatedAt: now()
  });
  if (Object.prototype.hasOwnProperty.call(changes, 'sectorIds')) {
    setUserSectorIds(id, changes.sectorIds);
  }

  return mapUser(findUserStmt.get(id));
}

export function updateUserThemeColor(id, themeColor) {
  const existing = findUserStmt.get(id);
  if (!existing) return null;
  db.prepare('UPDATE users SET theme_color = ?, updated_at = ? WHERE id = ?').run(normalizeAccentColor(themeColor), now(), id);
  return mapUser(findUserStmt.get(id));
}

export function updateUserPassword(id, password) {
  if (!password) {
    const error = new Error('Informe uma senha.');
    error.status = 400;
    throw error;
  }
  const existing = findUserStmt.get(id);
  if (!existing) return null;
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(password), now(), id);
  return mapUser(findUserStmt.get(id));
}

export function deleteUser(id) {
  const existing = findUserStmt.get(id);
  if (!existing) return false;

  const timestamp = now();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_sectors WHERE user_id = ?').run(id);
    db.prepare('UPDATE support_sessions SET assigned_user_id = NULL, updated_at = ? WHERE assigned_user_id = ?').run(timestamp, id);
    db.prepare('UPDATE support_session_events SET actor_user_id = NULL WHERE actor_user_id = ?').run(id);
    db.prepare('UPDATE support_session_events SET target_user_id = NULL WHERE target_user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  tx();
  return true;
}

export function listUsers({ activeOnly = false } = {}) {
  const rows = activeOnly
    ? db.prepare('SELECT * FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE ASC').all()
    : db.prepare('SELECT * FROM users ORDER BY active DESC, name COLLATE NOCASE ASC').all();
  return rows.map(mapUser);
}

export function listUsersTable({ search = '', role = '', active = '', page = 1, limit = 10 } = {}) {
  const filters = [];
  const params = {};
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const term = String(search || '').trim().toLowerCase();

  if (term) {
    filters.push('(lower(name) LIKE @search OR lower(email) LIKE @search)');
    params.search = `%${term}%`;
  }
  if (role) {
    filters.push('role = @role');
    params.role = normalizeUserRole(role);
  }
  if (active === true || active === 'true' || active === 'false' || active === false) {
    filters.push('active = @active');
    params.active = active === true || active === 'true' ? 1 : 0;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS total FROM users ${where}`).get(params).total;
  const rows = db.prepare(`
    SELECT * FROM users
    ${where}
    ORDER BY active DESC, name COLLATE NOCASE ASC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: safeLimit, offset: (safePage - 1) * safeLimit });

  return {
    data: rows.map(mapUser),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

export function getUserById(id) {
  return mapUser(findUserStmt.get(id));
}

export function createSector(sector = {}) {
  return saveSector(sector);
}

export function saveSector({ id = '', name, color = 'green', active = true } = {}) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    const error = new Error('Informe o nome do setor.');
    error.status = 400;
    throw error;
  }

  const timestamp = now();
  const existing = id ? findSectorStmt.get(id) : null;
  const duplicate = db.prepare('SELECT * FROM sectors WHERE lower(name) = lower(?) AND id != ?').get(cleanName, id || '');
  if (duplicate) {
    const error = new Error('Setor ja cadastrado.');
    error.status = 409;
    throw error;
  }

  if (existing) {
    db.prepare(`
      UPDATE sectors
      SET name = @name, color = @color, active = @active, updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      name: cleanName,
      color: normalizeAccentColor(color),
      active: active ? 1 : 0,
      updatedAt: timestamp
    });
    return mapSector(findSectorStmt.get(id));
  }

  const row = {
    id: randomUUID(),
    name: cleanName,
    color: normalizeAccentColor(color),
    active: active ? 1 : 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  db.prepare(`
    INSERT INTO sectors (id, name, color, active, created_at, updated_at)
    VALUES (@id, @name, @color, @active, @createdAt, @updatedAt)
  `).run(row);
  return mapSector(findSectorStmt.get(row.id));
}

export function listSectors({ activeOnly = false } = {}) {
  const rows = activeOnly
    ? db.prepare('SELECT * FROM sectors WHERE active = 1 ORDER BY name COLLATE NOCASE ASC').all()
    : db.prepare('SELECT * FROM sectors ORDER BY active DESC, name COLLATE NOCASE ASC').all();
  return rows.map(mapSector);
}

export function deleteSector(id) {
  const existing = findSectorStmt.get(id);
  if (!existing) return false;
  db.prepare('UPDATE sectors SET active = 0, updated_at = ? WHERE id = ?').run(now(), id);
  return true;
}

export function createSupportTag(tag = {}) {
  return saveSupportTag(tag);
}

export function saveSupportTag({ id = '', name, color = 'green', active = true } = {}) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    const error = new Error('Informe o nome da tag.');
    error.status = 400;
    throw error;
  }

  const timestamp = now();
  const existing = id ? findSupportTagStmt.get(id) : null;
  const duplicate = db.prepare('SELECT * FROM support_tags WHERE lower(name) = lower(?) AND id != ?').get(cleanName, id || '');
  if (duplicate) {
    const error = new Error('Tag ja cadastrada.');
    error.status = 409;
    throw error;
  }

  if (existing) {
    db.prepare(`
      UPDATE support_tags
      SET name = @name, color = @color, active = @active, updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      name: cleanName,
      color: normalizeAccentColor(color),
      active: active ? 1 : 0,
      updatedAt: timestamp
    });
    return mapSupportTag(findSupportTagStmt.get(id));
  }

  const row = {
    id: randomUUID(),
    name: cleanName,
    color: normalizeAccentColor(color),
    active: active ? 1 : 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  db.prepare(`
    INSERT INTO support_tags (id, name, color, active, created_at, updated_at)
    VALUES (@id, @name, @color, @active, @createdAt, @updatedAt)
  `).run(row);
  return mapSupportTag(findSupportTagStmt.get(row.id));
}

export function listSupportTags({ activeOnly = false } = {}) {
  const rows = activeOnly
    ? db.prepare('SELECT * FROM support_tags WHERE active = 1 ORDER BY name COLLATE NOCASE ASC').all()
    : db.prepare('SELECT * FROM support_tags ORDER BY active DESC, name COLLATE NOCASE ASC').all();
  return rows.map(mapSupportTag);
}

export function deleteSupportTag(id) {
  const existing = findSupportTagStmt.get(id);
  if (!existing) return false;
  db.prepare('UPDATE support_tags SET active = 0, updated_at = ? WHERE id = ?').run(now(), id);
  return true;
}

export function createAiAgent(agent = {}) {
  return saveAiAgent(agent);
}

export function saveAiAgent(agent = {}) {
  const cleanName = String(agent.name || '').trim();
  if (!cleanName) {
    const error = new Error('Informe o nome do agente.');
    error.status = 400;
    throw error;
  }

  const timestamp = now();
  const existing = agent.id ? findAiAgentStmt.get(agent.id) : null;
  const transferMode = normalizeTransferMode(agent.transferMode ?? agent.transfer_mode ?? existing?.transfer_mode);
  const row = {
    id: existing?.id || randomUUID(),
    name: cleanName,
    active: Object.prototype.hasOwnProperty.call(agent, 'active') ? (agent.active ? 1 : 0) : (existing?.active ?? 1),
    model: String(agent.model || existing?.model || 'gemini-2.0-flash').trim() || 'gemini-2.0-flash',
    temperature: clampTemperature(agent.temperature ?? existing?.temperature ?? 0.4),
    context: String(agent.context ?? existing?.context ?? '').trim(),
    rules: String(agent.rules ?? existing?.rules ?? '').trim(),
    behavior: String(agent.behavior ?? existing?.behavior ?? '').trim(),
    transferMode,
    transferUserId: transferMode === 'user' ? cleanOptional(agent.transferUserId ?? agent.transfer_user_id ?? existing?.transfer_user_id) : null,
    transferSectorId: transferMode === 'sector' ? cleanOptional(agent.transferSectorId ?? agent.transfer_sector_id ?? existing?.transfer_sector_id) : null,
    createdAt: existing?.created_at || timestamp,
    updatedAt: timestamp
  };
  if (row.transferUserId && !findUserStmt.get(row.transferUserId)) {
    const error = new Error('Usuario de transferencia nao encontrado.');
    error.status = 400;
    throw error;
  }
  if (row.transferSectorId && !findSectorStmt.get(row.transferSectorId)) {
    const error = new Error('Setor de transferencia nao encontrado.');
    error.status = 400;
    throw error;
  }

  if (existing) {
    db.prepare(`
      UPDATE ai_agents
      SET name = @name, active = @active, model = @model, temperature = @temperature,
          context = @context, rules = @rules, behavior = @behavior,
          transfer_mode = @transferMode, transfer_user_id = @transferUserId,
          transfer_sector_id = @transferSectorId, updated_at = @updatedAt
      WHERE id = @id
    `).run(row);
  } else {
    db.prepare(`
      INSERT INTO ai_agents (
        id, name, active, model, temperature, context, rules, behavior,
        transfer_mode, transfer_user_id, transfer_sector_id, created_at, updated_at
      )
      VALUES (
        @id, @name, @active, @model, @temperature, @context, @rules, @behavior,
        @transferMode, @transferUserId, @transferSectorId, @createdAt, @updatedAt
      )
    `).run(row);
  }
  return mapAiAgent(findAiAgentStmt.get(row.id));
}

export function listAiAgents({ activeOnly = false } = {}) {
  const rows = activeOnly
    ? db.prepare('SELECT * FROM ai_agents WHERE active = 1 ORDER BY updated_at DESC, name COLLATE NOCASE ASC').all()
    : db.prepare('SELECT * FROM ai_agents ORDER BY active DESC, updated_at DESC, name COLLATE NOCASE ASC').all();
  return rows.map(mapAiAgent);
}

export function getAiAgentById(id) {
  return mapAiAgent(findAiAgentStmt.get(id));
}

export function deleteAiAgent(id) {
  const existing = findAiAgentStmt.get(id);
  if (!existing) return false;
  db.prepare('UPDATE ai_agents SET active = 0, updated_at = ? WHERE id = ?').run(now(), id);
  return true;
}

export function authenticateUser(email, password) {
  const user = findUserByEmailStmt.get(normalizeEmail(email));
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) return null;
  return mapUser(user);
}

export function createAuthSession(userId) {
  const user = findUserStmt.get(userId);
  if (!user || !user.active) return null;
  const timestamp = now();
  const session = {
    id: randomUUID(),
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: timestamp
  };
  db.prepare(`
    INSERT INTO auth_sessions (id, user_id, expires_at, created_at)
    VALUES (@id, @userId, @expiresAt, @createdAt)
  `).run(session);
  return session;
}

export function getAuthSessionUser(sessionId) {
  if (!sessionId) return null;
  cleanupExpiredAuthSessions();
  const row = db.prepare(`
    SELECT u.* FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND datetime(s.expires_at) > datetime('now') AND u.active = 1
  `).get(sessionId);
  return mapUser(row);
}

export function deleteAuthSession(sessionId) {
  if (!sessionId) return false;
  db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(sessionId);
  return true;
}

export function cleanupExpiredAuthSessions() {
  db.prepare("DELETE FROM auth_sessions WHERE datetime(expires_at) <= datetime('now')").run();
}

export function upsertContact({ phone, name, avatarUrl, isGroup = false, lastMessageAt, chatStatus }) {
  if (!phone) throw new Error('Telefone ausente no payload.');

  const timestamp = now();
  const existing = findContactStmt.get(phone);
  const nextStatus = chatStatus ? normalizeConversationStatus(chatStatus) : existing?.chat_status || 'waiting';

  if (!existing) {
    const contact = {
      id: randomUUID(),
      phone,
      name: name || phone,
      avatarUrl: avatarUrl || null,
      isGroup: isGroup ? 1 : 0,
      chatStatus: nextStatus,
      unreadCount: 0,
      lastMessageAt: lastMessageAt || timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    insertContactStmt.run(contact);
    return getContactByPhone(phone);
  }

  updateContactStmt.run({
    id: existing.id,
    name: existing.name && existing.name !== existing.phone ? existing.name : name || existing.name,
    avatarUrl: avatarUrl || existing.avatar_url,
    isGroup: isGroup || existing.is_group ? 1 : 0,
    chatStatus: nextStatus,
    unreadCount: existing.unread_count,
    lastMessageAt: lastMessageAt || existing.last_message_at || timestamp,
    updatedAt: timestamp
  });

  return getContactByPhone(phone);
}

export function saveContact(input = {}) {
  const phone = cleanPhone(input.phone);
  if (!phone) {
    const error = new Error('Informe o telefone do contato.');
    error.status = 400;
    throw error;
  }

  const timestamp = now();
  const existing = findContactStmt.get(phone);
  const tags = normalizeTags(input.tags);
  const row = {
    id: existing?.id || randomUUID(),
    phone,
    name: String(input.name || existing?.name || phone).trim(),
    avatarUrl: input.avatarUrl ?? existing?.avatar_url ?? null,
    isGroup: input.isGroup ?? Boolean(existing?.is_group) ? 1 : 0,
    chatStatus: existing?.chat_status || 'waiting',
    unreadCount: existing?.unread_count || 0,
    lastMessageAt: existing?.last_message_at || input.lastMessageAt || timestamp,
    email: cleanOptional(input.email ?? existing?.email),
    address: cleanOptional(input.address ?? existing?.address),
    latitude: cleanOptional(input.latitude ?? existing?.latitude),
    longitude: cleanOptional(input.longitude ?? existing?.longitude),
    notes: cleanOptional(input.notes ?? existing?.notes),
    tags: JSON.stringify(tags.length ? tags : safeJson(existing?.tags || '[]')),
    status: normalizeContactStatus(input.status ?? existing?.status ?? 'active'),
    source: cleanOptional(input.source ?? existing?.source) || 'manual',
    createdAt: existing?.created_at || timestamp,
    updatedAt: timestamp
  };

  if (!existing) {
    db.prepare(`
      INSERT INTO contacts (
        id, phone, name, avatar_url, is_group, chat_status, unread_count, last_message_at,
        email, address, latitude, longitude, notes, tags, status, source, created_at, updated_at
      )
      VALUES (
        @id, @phone, @name, @avatarUrl, @isGroup, @chatStatus, @unreadCount, @lastMessageAt,
        @email, @address, @latitude, @longitude, @notes, @tags, @status, @source, @createdAt, @updatedAt
      )
    `).run(row);
  } else {
    db.prepare(`
      UPDATE contacts
      SET name = @name,
          avatar_url = @avatarUrl,
          is_group = @isGroup,
          email = @email,
          address = @address,
          latitude = @latitude,
          longitude = @longitude,
          notes = @notes,
          tags = @tags,
          status = @status,
          source = @source,
          updated_at = @updatedAt
      WHERE id = @id
    `).run(row);
  }

  return getContactByPhone(phone);
}

export function getContactByPhone(phone) {
  return mapContact(findContactStmt.get(cleanPhone(phone)));
}

export function getContactById(id) {
  return mapContact(db.prepare('SELECT * FROM contacts WHERE id = ?').get(id));
}

export function listContacts({ search = '', status = '', tag = '', page = 1, limit = 10 } = {}) {
  const filters = [];
  const params = {};
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const term = String(search || '').trim().toLowerCase();

  if (term) {
    filters.push("(lower(name) LIKE @search OR lower(phone) LIKE @search OR lower(COALESCE(email, '')) LIKE @search OR lower(COALESCE(address, '')) LIKE @search)");
    params.search = `%${term}%`;
  }
  if (status) {
    filters.push('status = @status');
    params.status = normalizeContactStatus(status);
  }
  if (tag) {
    filters.push('lower(tags) LIKE @tag');
    params.tag = `%${String(tag).trim().toLowerCase()}%`;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS total FROM contacts ${where}`).get(params).total;
  const rows = db.prepare(`
    SELECT * FROM contacts
    ${where}
    ORDER BY datetime(COALESCE(last_message_at, updated_at, created_at)) DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: safeLimit, offset: (safePage - 1) * safeLimit });

  return {
    data: rows.map(mapContact),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

export function deleteContact(id) {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  if (!contact) return false;

  const sessions = db.prepare('SELECT id FROM support_sessions WHERE contact_id = ?').all(id);
  const tx = db.transaction(() => {
    for (const session of sessions) {
      db.prepare('DELETE FROM support_session_events WHERE session_id = ?').run(session.id);
      db.prepare('DELETE FROM support_session_tags WHERE session_id = ?').run(session.id);
    }
    db.prepare('DELETE FROM messages WHERE contact_id = ?').run(id);
    db.prepare('DELETE FROM support_sessions WHERE contact_id = ?').run(id);
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
  });
  tx();
  return true;
}

export function createMessage(message) {
  if (message.externalId) {
    const existing = db.prepare('SELECT * FROM messages WHERE external_id = ?').get(message.externalId);
    if (existing) return mergeExistingMessage(existing, message);
  }
  if (isWebhookStatusOnlyMessage(message)) return null;

  const contact = upsertContact({
    phone: message.phone,
    name: message.name,
    avatarUrl: message.avatarUrl,
    isGroup: message.isGroup,
    lastMessageAt: message.createdAt || now()
  });
  const session = resolveSessionForMessage({ contact, message });
  const reply = resolveReplyContext(message);
  const raw = normalizeMessageRaw(message);
  const createdAt = message.createdAt || now();
  const duplicateMedia = findRecentDuplicateInboundMediaMessage({ ...message, raw, createdAt });
  if (duplicateMedia) return duplicateMedia;

  const row = {
    id: message.id || randomUUID(),
    externalId: message.externalId || null,
    contactId: contact.id,
    sessionId: session.id,
    phone: message.phone,
    senderName: message.senderName || null,
    senderPhone: message.senderPhone || null,
    direction: message.direction,
    type: message.type || 'text',
    body: message.body || '',
    status: message.status || 'stored',
    mediaPath: message.mediaPath || null,
    replyToMessageId: message.replyToMessageId || reply?.messageId || null,
    replyToExternalId: message.replyToExternalId || reply?.externalId || null,
    replyPreview: message.replyPreview || reply?.preview || null,
    rawJson: JSON.stringify(raw),
    createdAt
  };

  db.prepare(`
    INSERT INTO messages
      (id, external_id, contact_id, session_id, phone, sender_name, sender_phone, direction, type, body, status, media_path, reply_to_message_id, reply_to_external_id, reply_preview, raw_json, created_at)
    VALUES
      (@id, @externalId, @contactId, @sessionId, @phone, @senderName, @senderPhone, @direction, @type, @body, @status, @mediaPath, @replyToMessageId, @replyToExternalId, @replyPreview, @rawJson, @createdAt)
  `).run(row);

  touchSessionAfterMessage(session.id, row);
  syncContactFromLatestSession(contact.phone);

  return mapMessage({
    id: row.id,
    external_id: row.externalId,
    contact_id: row.contactId,
    session_id: row.sessionId,
    phone: row.phone,
    sender_name: row.senderName,
    sender_phone: row.senderPhone,
    direction: row.direction,
    type: row.type,
    body: row.body,
    status: row.status,
    media_path: row.mediaPath,
    reply_to_message_id: row.replyToMessageId,
    reply_to_external_id: row.replyToExternalId,
    reply_preview: row.replyPreview,
    raw_json: row.rawJson,
    created_at: row.createdAt
  });
}

function mergeExistingMessage(existing, message = {}) {
  const existingRaw = safeJson(existing.raw_json);
  const nextRaw = normalizeMessageRaw(message);
  const mergedRaw = mergeMessageRaw(existingRaw, nextRaw);
  const statusOnly = isWebhookStatusOnlyMessage(message);
  const nextMediaPath = statusOnly ? null : message.mediaPath || extractMediaPathFromRaw(nextRaw) || null;
  const mediaPath = statusOnly ? existing.media_path : shouldKeepExistingRenderableMediaPath(existing, nextMediaPath)
    ? existing.media_path
    : nextMediaPath || existing.media_path || null;
  const body = !statusOnly && shouldReplaceMessageBody(existing.body, message.body) ? message.body : existing.body;
  const type = statusOnly ? existing.type : message.type || existing.type;
  const status = message.status || existing.status;

  db.prepare(`
    UPDATE messages
    SET type = @type,
        body = @body,
        status = @status,
        media_path = @mediaPath,
        sender_name = COALESCE(@senderName, sender_name),
        sender_phone = COALESCE(@senderPhone, sender_phone),
        reply_to_message_id = COALESCE(@replyToMessageId, reply_to_message_id),
        reply_to_external_id = COALESCE(@replyToExternalId, reply_to_external_id),
        reply_preview = COALESCE(@replyPreview, reply_preview),
        raw_json = @rawJson
    WHERE id = @id
  `).run({
    id: existing.id,
    type,
    body,
    status,
    mediaPath,
    senderName: message.senderName || null,
    senderPhone: message.senderPhone || null,
    replyToMessageId: message.replyToMessageId || null,
    replyToExternalId: message.replyToExternalId || null,
    replyPreview: message.replyPreview || null,
    rawJson: JSON.stringify(mergedRaw)
  });

  return getMessageById(existing.id);
}

function normalizeMessageRaw(message) {
  const raw = message.raw && typeof message.raw === 'object' ? { ...message.raw } : {};
  if (Array.isArray(message.mentions)) {
    raw.normalizedMentions = message.mentions;
  }
  if (message.replyParticipant) {
    raw.normalizedReplyParticipant = message.replyParticipant;
  }
  if (message.media && typeof message.media === 'object') {
    raw.normalizedMedia = {
      ...(raw.normalizedMedia || {}),
      ...message.media
    };
  }
  return raw;
}

function mergeMessageRaw(existingRaw, nextRaw) {
  return {
    ...(existingRaw && typeof existingRaw === 'object' ? existingRaw : {}),
    ...(nextRaw && typeof nextRaw === 'object' ? nextRaw : {}),
    normalizedMedia: {
      ...((existingRaw?.normalizedMedia && typeof existingRaw.normalizedMedia === 'object') ? existingRaw.normalizedMedia : {}),
      ...((nextRaw?.normalizedMedia && typeof nextRaw.normalizedMedia === 'object') ? nextRaw.normalizedMedia : {})
    }
  };
}

function extractMediaPathFromRaw(raw) {
  const media = raw?.normalizedMedia;
  if (media && typeof media === 'object') {
    return media.url || media.mediaUrl || media.link || '';
  }
  const content = raw?.msgContent || raw?.message || raw?.data?.msgContent || raw?.data?.message || raw;
  const candidates = [
    content?.imageMessage,
    content?.audioMessage,
    content?.videoMessage,
    content?.documentMessage,
    content?.stickerMessage,
    content?.associatedChildMessage?.message?.imageMessage,
    content?.associatedChildMessage?.message?.audioMessage,
    content?.associatedChildMessage?.message?.videoMessage,
    content?.associatedChildMessage?.message?.documentMessage
  ].filter(Boolean);
  const found = candidates.find((item) => item && typeof item === 'object' && (item.url || item.mediaUrl || item.link));
  return found?.url || found?.mediaUrl || found?.link || '';
}

function shouldKeepExistingRenderableMediaPath(existing = {}, nextMediaPath = '') {
  if (existing.direction !== 'outbound') return false;
  if (!['image', 'sticker'].includes(existing.type)) return false;
  if (!isLocalUploadPath(existing.media_path)) return false;
  if (!nextMediaPath || isLocalUploadPath(nextMediaPath)) return false;
  return isWhatsAppMediaUrl(nextMediaPath);
}

function isWebhookStatusOnlyMessage(message = {}) {
  const type = String(message.type || '').trim().toLowerCase();
  const event = String(message.raw?.event || '').trim().toLowerCase();
  return type === 'message-status' || event === 'webhookstatus';
}

function isLocalUploadPath(value) {
  return typeof value === 'string' && value.startsWith('/uploads/');
}

function isWhatsAppMediaUrl(value) {
  return typeof value === 'string' && value.includes('mmg.whatsapp.net');
}

function shouldReplaceMessageBody(current, incoming) {
  const next = String(incoming || '').trim();
  if (!next || /^\[[^\]]+\]$/.test(next)) return false;
  const previous = String(current || '').trim();
  return !previous || ['Imagem enviada', 'Audio enviado', 'Video enviado', 'Documento enviado', 'Mensagem enviada'].includes(previous);
}

function findRecentDuplicateInboundMediaMessage(message) {
  if (!shouldDedupeInboundMedia(message)) return null;
  const createdAt = new Date(message.createdAt);
  if (Number.isNaN(createdAt.valueOf())) return null;

  const from = new Date(createdAt.getTime() - 8000).toISOString();
  const to = new Date(createdAt.getTime() + 8000).toISOString();
  const candidates = db.prepare(`
    SELECT * FROM messages
    WHERE phone = @phone
      AND direction = 'inbound'
      AND type = @type
      AND datetime(created_at) BETWEEN datetime(@from) AND datetime(@to)
    ORDER BY datetime(created_at) DESC
    LIMIT 8
  `).all({
    phone: message.phone,
    type: message.type,
    from,
    to
  });

  const incoming = buildInboundMediaDedupSignature(message);
  if (!incoming) return null;

  const found = candidates.find((row) => {
    const existing = buildInboundMediaDedupSignature({
      type: row.type,
      body: row.body,
      raw: safeJson(row.raw_json),
      mediaPath: row.media_path,
      createdAt: row.created_at
    });
    if (!existing) return false;
    if (incoming.type !== existing.type) return false;
    if (incoming.mimeType && existing.mimeType && incoming.mimeType !== existing.mimeType) return false;
    if (incoming.caption && existing.caption && incoming.caption !== existing.caption) return false;
    return incoming.duration > 0 && incoming.duration === existing.duration;
  });

  return found ? mapMessage(found) : null;
}

function shouldDedupeInboundMedia(message) {
  return message.direction === 'inbound'
    && ['audio', 'video'].includes(message.type)
    && !message.replyToExternalId
    && !message.replyToMessageId;
}

function buildInboundMediaDedupSignature(message) {
  const media = message.media || message.raw?.normalizedMedia || {};
  const type = message.type || media.type;
  if (!['audio', 'video'].includes(type)) return null;
  return {
    type,
    mimeType: String(media.mimetype || media.mimeType || '').split(';')[0].trim().toLowerCase(),
    duration: Number(media.duration || media.seconds || 0) || 0,
    caption: normalizeDedupCaption(message.body)
  };
}

function normalizeDedupCaption(value) {
  const text = String(value || '').trim();
  if (!text || /^\[[^\]]+\]$/.test(text)) return '';
  return text.replace(/\s+/g, ' ').slice(0, 220);
}

export function saveWebhookEvent(eventType, payload) {
  const row = {
    id: randomUUID(),
    eventType,
    rawJson: JSON.stringify(payload ?? {}),
    createdAt: now()
  };

  db.prepare(`
    INSERT INTO webhook_events (id, event_type, raw_json, created_at)
    VALUES (@id, @eventType, @rawJson, @createdAt)
  `).run(row);

  return row;
}

export function listConversations(filters = {}) {
  return listSupportSessions(filters);
}

export function listSupportSessions(filters = {}) {
  const { from, to, viewer } = filters;
  const where = [];
  const params = {};

  if (from) {
    where.push('datetime(COALESCE(s.closed_at, s.last_message_at, s.started_at)) >= datetime(@from)');
    params.from = from;
  }
  if (to) {
    where.push('datetime(COALESCE(s.closed_at, s.last_message_at, s.started_at)) <= datetime(@to)');
    params.to = to;
  }
  if (viewer?.role !== 'admin' && viewer?.id) {
    where.push("((s.status = 'waiting' AND s.assigned_user_id IS NULL) OR s.assigned_user_id = @viewerUserId)");
    params.viewerUserId = viewer.id;
  }

  const rows = db.prepare(`
    SELECT
      s.*,
      c.name,
      c.avatar_url,
      c.is_group,
      u.name AS assigned_user_name,
      u.email AS assigned_user_email,
      u.role AS assigned_user_role,
      sec.name AS sector_name,
      sec.color AS sector_color,
      agent.name AS agent_name,
      m.body AS last_body,
      m.direction AS last_direction,
      m.status AS last_status,
      m.created_at AS last_created_at,
      (
        SELECT COUNT(*) FROM support_sessions count_s
        WHERE count_s.contact_id = s.contact_id
      ) AS support_count,
      (
        SELECT COUNT(*) FROM messages count_m
        WHERE count_m.session_id = s.id
      ) AS message_count
    FROM support_sessions s
    JOIN contacts c ON c.id = s.contact_id
    LEFT JOIN users u ON u.id = s.assigned_user_id
    LEFT JOIN sectors sec ON sec.id = s.sector_id
    LEFT JOIN ai_agents agent ON agent.id = s.agent_id
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages
      WHERE session_id = s.id
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    )
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY datetime(COALESCE(s.last_message_at, s.started_at)) DESC
  `).all(params);

  return rows.map(mapSessionRow);
}

export function listMessages(sessionId) {
  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE session_id = ?
    ORDER BY datetime(created_at) ASC
  `).all(sessionId).map(mapMessage);
  const events = listSupportSessionEvents(sessionId);
  return [...messages, ...events].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function markSupportSessionRead(id) {
  const session = findSessionStmt.get(id);
  if (!session) return null;

  if (Number(session.unread_count || 0) > 0) {
    db.prepare('UPDATE support_sessions SET unread_count = 0, updated_at = ? WHERE id = ?').run(now(), id);
    syncContactFromLatestSession(session.phone);
  }

  return getSupportSessionById(id);
}

export function getMessageById(id) {
  return mapMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));
}

export function canAccessSupportSession(id, viewer = null) {
  const session = findSessionStmt.get(id);
  if (!session) return false;
  if (!viewer || viewer.role === 'admin') return true;
  return (session.status === 'waiting' && !session.assigned_user_id) || session.assigned_user_id === viewer.id;
}

export function updateSupportSessionStatus(id, status, actorUser = null) {
  const chatStatus = normalizeConversationStatus(status);
  const session = findSessionStmt.get(id);
  if (!session) return null;
  if (session.status === 'finished' && chatStatus === 'active') {
    const error = new Error('Atendimento finalizado deve ser reaberto em uma nova sessao.');
    error.status = 409;
    throw error;
  }

  db.prepare(`
    UPDATE support_sessions
    SET status = ?,
        unread_count = CASE WHEN ? = 'active' THEN 0 ELSE unread_count END,
        closed_at = CASE WHEN ? = 'finished' THEN ? ELSE NULL END,
        assigned_user_id = CASE WHEN ? = 'active' THEN COALESCE(?, assigned_user_id) ELSE assigned_user_id END,
        updated_at = ?
    WHERE id = ?
  `).run(chatStatus, chatStatus, chatStatus, now(), chatStatus, actorUser?.id || null, now(), id);

  if (chatStatus === 'active' && session.status !== 'active') {
    createSupportSessionEvent({
      sessionId: id,
      type: 'attended',
      actorUserId: actorUser?.id || null,
      body: `${actorUser?.name || 'Atendente'} iniciou o atendimento`
    });
  }
  if (chatStatus === 'finished' && session.status !== 'finished') {
    createSupportSessionEvent({
      sessionId: id,
      type: 'finished',
      actorUserId: actorUser?.id || null,
      body: `${actorUser?.name || 'Atendente'} finalizou o atendimento`
    });
  }

  syncContactFromLatestSession(session.phone);
  return getSupportSessionById(id);
}

export function reopenSupportSession(id, actorUser = null) {
  const session = findSessionStmt.get(id);
  if (!session) return null;
  if (session.status !== 'finished') return getSupportSessionById(id);

  const created = createSupportSession({
    contactId: session.contact_id,
    phone: session.phone,
    isGroup: session.is_group,
    status: 'active',
    startedAt: now(),
    lastMessageAt: now(),
    assignedUserId: actorUser?.id || null
  });
  createSupportSessionEvent({
    sessionId: created.id,
    type: 'reopened',
    actorUserId: actorUser?.id || null,
    body: `${actorUser?.name || 'Atendente'} reabriu o atendimento`
  });
  syncContactFromLatestSession(session.phone);
  return getSupportSessionById(created.id);
}

export function transferSupportSession(id, target, actorUser = null) {
  const session = findSessionStmt.get(id);
  if (!session) return null;
  const targetUserId = typeof target === 'object' ? target?.targetUserId : target;
  const targetSectorId = typeof target === 'object' ? target?.targetSectorId : '';
  if (targetSectorId) {
    const sector = findSectorStmt.get(targetSectorId);
    if (!sector || !sector.active) {
      const error = new Error('Setor destino nao encontrado ou inativo.');
      error.status = 400;
      throw error;
    }
    db.prepare('UPDATE support_sessions SET sector_id = ?, assigned_user_id = NULL, updated_at = ? WHERE id = ?').run(sector.id, now(), id);
    createSupportSessionEvent({
      sessionId: id,
      type: 'transferred',
      actorUserId: actorUser?.id || null,
      targetSectorId: sector.id,
      body: `${actorUser?.name || 'Atendente'} transferiu para o setor ${sector.name}`
    });
    return getSupportSessionById(id);
  }

  const targetUser = findUserStmt.get(targetUserId);
  if (!targetUser || !targetUser.active) {
    const error = new Error('Usuario destino nao encontrado ou inativo.');
    error.status = 400;
    throw error;
  }

  db.prepare('UPDATE support_sessions SET assigned_user_id = ?, updated_at = ? WHERE id = ?').run(targetUser.id, now(), id);
  createSupportSessionEvent({
    sessionId: id,
    type: 'transferred',
    actorUserId: actorUser?.id || null,
    targetUserId: targetUser.id,
    body: `${actorUser?.name || 'Atendente'} transferiu para ${targetUser.name}`
  });
  return getSupportSessionById(id);
}

export function setSupportSessionTags(sessionId, tagIds = []) {
  const session = findSessionStmt.get(sessionId);
  if (!session) return null;
  const ids = normalizeIdList(tagIds);
  const tags = ids
    .map((id) => findSupportTagStmt.get(id))
    .filter((tag) => tag && tag.active);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM support_session_tags WHERE session_id = ?').run(sessionId);
    for (const tag of tags) {
      db.prepare(`
        INSERT INTO support_session_tags (session_id, tag_id, created_at)
        VALUES (?, ?, ?)
      `).run(sessionId, tag.id, now());
    }
  });
  tx();
  return getSupportSessionById(sessionId);
}

export function setSupportSessionSector(sessionId, sectorId, actorUser = null) {
  const session = findSessionStmt.get(sessionId);
  if (!session) return null;
  const cleanSectorId = cleanOptional(sectorId);
  if (cleanSectorId && !findSectorStmt.get(cleanSectorId)) {
    const error = new Error('Setor nao encontrado.');
    error.status = 400;
    throw error;
  }
  db.prepare('UPDATE support_sessions SET sector_id = ?, updated_at = ? WHERE id = ?').run(cleanSectorId, now(), sessionId);
  createSupportSessionEvent({
    sessionId,
    type: 'sector',
    actorUserId: actorUser?.id || null,
    targetSectorId: cleanSectorId,
    body: cleanSectorId ? `${actorUser?.name || 'Atendente'} definiu o setor do atendimento` : `${actorUser?.name || 'Atendente'} removeu o setor do atendimento`
  });
  return getSupportSessionById(sessionId);
}

export function deleteSupportSession(id) {
  const session = findSessionStmt.get(id);
  if (!session) return false;

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
    db.prepare('DELETE FROM support_session_events WHERE session_id = ?').run(id);
    db.prepare('DELETE FROM support_session_tags WHERE session_id = ?').run(id);
    db.prepare('DELETE FROM support_sessions WHERE id = ?').run(id);
  });
  tx();
  syncContactFromLatestSession(session.phone);
  return true;
}

export function normalizeLegacyGroupChatIds() {
  const rows = db.prepare(`
    SELECT id, phone, name, avatar_url FROM contacts
    WHERE is_group = 1
      AND phone NOT LIKE '%@g.us'
      AND phone NOT LIKE '%@%'
  `).all();
  if (!rows.length) return 0;

  let changed = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const nextPhone = `${row.phone}@g.us`;
      const duplicate = findContactStmt.get(nextPhone);
      const targetId = duplicate?.id || row.id;

      if (duplicate) {
        db.prepare(`
          UPDATE contacts
          SET name = CASE
                WHEN (name IS NULL OR name = '' OR name = phone) THEN COALESCE(NULLIF(?, ''), name)
                ELSE name
              END,
              avatar_url = COALESCE(avatar_url, ?),
              is_group = 1,
              updated_at = ?
          WHERE id = ?
        `).run(row.name, row.avatar_url, now(), duplicate.id);
        db.prepare('UPDATE support_sessions SET contact_id = ? WHERE contact_id = ?').run(duplicate.id, row.id);
        db.prepare('UPDATE messages SET contact_id = ? WHERE contact_id = ?').run(duplicate.id, row.id);
        db.prepare('DELETE FROM contacts WHERE id = ?').run(row.id);
      } else {
        db.prepare('UPDATE contacts SET phone = ?, updated_at = ? WHERE id = ?').run(nextPhone, now(), row.id);
      }

      db.prepare('UPDATE support_sessions SET phone = ?, updated_at = ? WHERE contact_id = ? OR (is_group = 1 AND phone = ?)').run(nextPhone, now(), targetId, row.phone);
      db.prepare('UPDATE messages SET phone = ? WHERE contact_id = ? OR phone = ?').run(nextPhone, targetId, row.phone);
      changed += 1;
    }
  });
  tx();
  return changed;
}

export function createSupportSessionEventForTest(event) {
  return createSupportSessionEvent(event);
}

export function getSupportSessionByIdForTest(id) {
  return getSupportSessionById(id);
}

export function listWebhookEvents(limit = 80) {
  return db.prepare(`
    SELECT * FROM webhook_events
    ORDER BY datetime(created_at) DESC
    LIMIT ?
  `).all(limit).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    createdAt: row.created_at,
    raw: safeJson(row.raw_json)
  }));
}

export function buildSupportMetrics(filters = {}) {
  const sessions = listSupportSessions(filters);
  const byContact = Object.values(sessions.reduce((acc, session) => {
    const key = session.phone;
    if (!acc[key]) {
      acc[key] = {
        phone: session.phone,
        name: session.name,
        avatarUrl: session.avatarUrl,
        count: 0,
        finished: 0,
        active: 0,
        waiting: 0
      };
    }
    acc[key].count += 1;
    acc[key][session.chatStatus] += 1;
    return acc;
  }, {})).sort((a, b) => b.count - a.count);

  return {
    total: sessions.length,
    byContact,
    byUser: []
  };
}

export function buildDashboardMetrics(filters = {}) {
  const sessions = listSupportSessions(filters);
  const messages = listPeriodMessages(filters);
  const events = listWebhookEvents(12);
  const transfers = listRecentSessionEvents('transferred', 12);
  const unreadTotal = sessions.reduce((total, session) => total + Number(session.unreadCount || 0), 0);
  const status = {
    waiting: sessions.filter((session) => session.chatStatus === 'waiting').length,
    active: sessions.filter((session) => session.chatStatus === 'active').length,
    finished: sessions.filter((session) => session.chatStatus === 'finished').length
  };
  const byContact = Object.values(sessions.reduce((acc, session) => {
    const key = session.phone;
    if (!acc[key]) {
      acc[key] = {
        phone: session.phone,
        name: session.name,
        avatarUrl: session.avatarUrl,
        count: 0,
        unread: 0,
        finished: 0,
        active: 0,
        waiting: 0
      };
    }
    acc[key].count += 1;
    acc[key].unread += Number(session.unreadCount || 0);
    acc[key][session.chatStatus] += 1;
    return acc;
  }, {})).sort((a, b) => b.count - a.count).slice(0, 8);
  const byUser = buildUserMetrics(sessions);

  return {
    summary: {
      total: sessions.length,
      unread: unreadTotal,
      privateChats: sessions.filter((session) => !session.isGroup).length,
      groups: sessions.filter((session) => session.isGroup).length,
      inboundMessages: messages.filter((message) => message.direction === 'inbound').length,
      outboundMessages: messages.filter((message) => message.direction === 'outbound').length,
      averageFirstResponseMinutes: averageFirstResponseMinutes(sessions),
      averageCloseMinutes: averageCloseMinutes(sessions)
    },
    status,
    byContact,
    byUser,
    currentLoad: byUser.map((item) => ({
      userId: item.userId,
      name: item.name,
      active: item.active,
      waiting: item.waiting
    })),
    recentEvents: events,
    recentTransfers: transfers
  };
}

function resolveSessionForMessage({ contact, message }) {
  if (message.sessionId) {
    const found = findSessionStmt.get(message.sessionId);
    if (found) return found;
  }

  const current = db.prepare(`
    SELECT * FROM support_sessions
    WHERE phone = ? AND status != 'finished'
    ORDER BY datetime(COALESCE(last_message_at, started_at)) DESC
    LIMIT 1
  `).get(contact.phone);

  if (shouldCreateNewSessionForMessage({ direction: message.direction, currentStatus: current?.status })) {
    return createSupportSession({
      contactId: contact.id,
      phone: contact.phone,
      isGroup: contact.isGroup,
      status: getNextSessionStatusForMessage({ direction: message.direction }),
      startedAt: message.createdAt || now(),
      lastMessageAt: message.createdAt || now()
    });
  }

  const nextStatus = getNextSessionStatusForMessage({ direction: message.direction, currentStatus: current.status });
  if (nextStatus !== current.status) {
    db.prepare('UPDATE support_sessions SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now(), current.id);
  }

  return findSessionStmt.get(current.id);
}

function createSupportSession({ contactId, phone, isGroup = false, status, startedAt, lastMessageAt, assignedUserId = null, sectorId = null, agentId = null }) {
  const timestamp = now();
  const session = {
    id: randomUUID(),
    contactId,
    phone,
    isGroup: isGroup ? 1 : 0,
    status: normalizeConversationStatus(status),
    unreadCount: 0,
    startedAt: startedAt || timestamp,
    closedAt: null,
    lastMessageAt: lastMessageAt || startedAt || timestamp,
    assignedUserId,
    sectorId,
    agentId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  insertSessionStmt.run(session);
  return findSessionStmt.get(session.id);
}

function touchSessionAfterMessage(sessionId, message) {
  const incrementUnread = message.direction === 'inbound' ? 1 : 0;
  db.prepare(`
    UPDATE support_sessions
    SET last_message_at = ?,
        unread_count = unread_count + ?,
        updated_at = ?
    WHERE id = ?
  `).run(message.createdAt, incrementUnread, now(), sessionId);
}

function createSupportSessionEvent({ sessionId, type, actorUserId = null, targetUserId = null, targetSectorId = null, body }) {
  const event = {
    id: randomUUID(),
    sessionId,
    type,
    actorUserId,
    targetUserId,
    targetSectorId,
    body: body || type,
    createdAt: now()
  };
  db.prepare(`
    INSERT INTO support_session_events (id, session_id, type, actor_user_id, target_user_id, target_sector_id, body, created_at)
    VALUES (@id, @sessionId, @type, @actorUserId, @targetUserId, @targetSectorId, @body, @createdAt)
  `).run(event);
  return event;
}

function listSupportSessionEvents(sessionId) {
  return db.prepare(`
    SELECT e.*, actor.name AS actor_user_name, target.name AS target_user_name, sector.name AS target_sector_name
    FROM support_session_events e
    LEFT JOIN users actor ON actor.id = e.actor_user_id
    LEFT JOIN users target ON target.id = e.target_user_id
    LEFT JOIN sectors sector ON sector.id = e.target_sector_id
    WHERE e.session_id = ?
    ORDER BY datetime(e.created_at) ASC
  `).all(sessionId).map(mapSessionEvent);
}

export function getSupportSessionById(id) {
  const rows = db.prepare(`
    SELECT
      s.*,
      c.name,
      c.avatar_url,
      c.is_group,
      u.name AS assigned_user_name,
      u.email AS assigned_user_email,
      u.role AS assigned_user_role,
      sec.name AS sector_name,
      sec.color AS sector_color,
      agent.name AS agent_name,
      m.body AS last_body,
      m.direction AS last_direction,
      m.status AS last_status,
      m.created_at AS last_created_at,
      (
        SELECT COUNT(*) FROM support_sessions count_s
        WHERE count_s.contact_id = s.contact_id
      ) AS support_count,
      (
        SELECT COUNT(*) FROM messages count_m
        WHERE count_m.session_id = s.id
      ) AS message_count
    FROM support_sessions s
    JOIN contacts c ON c.id = s.contact_id
    LEFT JOIN users u ON u.id = s.assigned_user_id
    LEFT JOIN sectors sec ON sec.id = s.sector_id
    LEFT JOIN ai_agents agent ON agent.id = s.agent_id
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages
      WHERE session_id = s.id
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    )
    WHERE s.id = ?
  `).all(id);
  return rows[0] ? mapSessionRow(rows[0]) : null;
}

function syncContactFromLatestSession(phone) {
  const latest = db.prepare(`
    SELECT * FROM support_sessions
    WHERE phone = ?
    ORDER BY datetime(COALESCE(last_message_at, started_at)) DESC
    LIMIT 1
  `).get(phone);
  const contact = findContactStmt.get(phone);
  if (!contact) return;

  db.prepare(`
    UPDATE contacts
    SET chat_status = COALESCE(?, chat_status),
        unread_count = COALESCE((SELECT SUM(unread_count) FROM support_sessions WHERE phone = ? AND status != 'finished'), 0),
        last_message_at = COALESCE(?, last_message_at),
        updated_at = ?
    WHERE phone = ?
  `).run(latest?.status || 'waiting', phone, latest?.last_message_at || latest?.started_at || null, now(), phone);
}

function resolveReplyContext(message) {
  const externalId = message.replyToExternalId || extractReplyExternalId(message.raw);
  const quotedPreview = message.replyPreview || extractQuotedPreview(message.raw);
  if (!externalId) return quotedPreview ? { preview: quotedPreview } : null;
  const quoted = db.prepare(`
    SELECT * FROM messages
    WHERE external_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).get(externalId);

  return {
    externalId,
    messageId: quoted?.id || null,
    preview: quoted ? buildMessagePreview(mapMessage(quoted)) : quotedPreview
  };
}

function extractReplyExternalId(raw) {
  const context = findReplyContext(raw);
  return context?.stanzaId || context?.quotedMessageId || context?.messageId || context?.key?.id || '';
}

function extractQuotedPreview(raw) {
  const quoted = findReplyContext(raw)?.quotedMessage;
  if (!quoted || typeof quoted !== 'object') return '';
  return firstQuotedText(quoted) || (quoted.imageMessage ? 'Imagem' : quoted.stickerMessage ? 'Figurinha' : '');
}

function findReplyContext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw.data || (raw.message && typeof raw.message === 'object' ? raw.message : raw);
  const content = data.msgContent || data.message || data;
  const candidates = [
    content.extendedTextMessage?.contextInfo,
    content.imageMessage?.contextInfo,
    content.videoMessage?.contextInfo,
    content.stickerMessage?.contextInfo,
    content.documentMessage?.contextInfo,
    content.contextInfo,
    content.messageContextInfo?.quotedMessage ? content.messageContextInfo : null
  ];
  return candidates.find((item) => item && typeof item === 'object' && (item.stanzaId || item.quotedMessage || item.quotedMessageId || item.messageId || item.key?.id)) || null;
}

function firstQuotedText(source) {
  return source.conversation
    || source.extendedTextMessage?.text
    || source.imageMessage?.caption
    || source.videoMessage?.caption
    || source.documentMessage?.caption
    || '';
}

function buildMessagePreview(message) {
  if (!message) return '';
  const text = !/^\[[^\]]+\]$/.test(String(message.body || '').trim()) ? message.body : '';
  const fallback = {
    sticker: 'Figurinha',
    image: 'Imagem',
    audio: 'Audio',
    video: 'Video',
    document: 'Documento'
  }[message.type] || 'Mensagem';
  return String(text || fallback).replace(/\s+/g, ' ').trim().slice(0, 220);
}

function mapSessionRow(row) {
  return {
    id: row.id,
    sessionId: row.id,
    contactId: row.contact_id,
    phone: row.phone,
    name: row.name || row.phone,
    avatarUrl: row.avatar_url,
    isGroup: Boolean(row.is_group),
    chatStatus: row.status || 'waiting',
    unreadCount: row.unread_count,
    supportCount: row.support_count || 1,
    messageCount: row.message_count || 0,
    startedAt: row.started_at,
    closedAt: row.closed_at,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedUserId: row.assigned_user_id,
    assignedUserName: row.assigned_user_name || null,
    assignedUserEmail: row.assigned_user_email || null,
    assignedUserRole: row.assigned_user_role || null,
    sectorId: row.sector_id || null,
    sectorName: row.sector_name || null,
    sectorColor: row.sector_color || null,
    agentId: row.agent_id || null,
    agentName: row.agent_name || null,
    tags: listSessionTags(row.id),
    lastMessage: row.last_body
      ? {
          body: row.last_body,
          direction: row.last_direction,
          status: row.last_status,
          createdAt: row.last_created_at
        }
      : null
  };
}

function mapContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    avatarUrl: row.avatar_url,
    isGroup: Boolean(row.is_group),
    chatStatus: row.chat_status || 'waiting',
    unreadCount: row.unread_count,
    lastMessageAt: row.last_message_at,
    email: row.email || '',
    address: row.address || '',
    latitude: row.latitude || '',
    longitude: row.longitude || '',
    notes: row.notes || '',
    tags: Array.isArray(safeJson(row.tags)) ? safeJson(row.tags) : [],
    status: row.status || 'active',
    source: row.source || 'manual',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    themeColor: normalizeAccentColor(row.theme_color),
    sendNameHeader: Boolean(row.send_name_header),
    sectors: listUserSectors(row.id),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSector(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: normalizeAccentColor(row.color),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSupportTag(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: normalizeAccentColor(row.color),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAiAgent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    model: row.model || 'gemini-2.0-flash',
    temperature: Number(row.temperature ?? 0.4),
    context: row.context || '',
    rules: row.rules || '',
    behavior: row.behavior || '',
    transferMode: normalizeTransferMode(row.transfer_mode),
    transferUserId: row.transfer_user_id || '',
    transferSectorId: row.transfer_sector_id || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMessage(row) {
  if (!row) return null;
  const raw = safeJson(row.raw_json);
  return {
    id: row.id,
    externalId: row.external_id,
    contactId: row.contact_id,
    sessionId: row.session_id,
    phone: row.phone,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    direction: row.direction,
    type: row.type,
    body: row.body,
    status: row.status,
    mediaPath: row.media_path,
    replyToMessageId: row.reply_to_message_id,
    replyToExternalId: row.reply_to_external_id,
    replyPreview: row.reply_preview,
    raw,
    mentions: Array.isArray(raw.normalizedMentions) ? raw.normalizedMentions : Array.isArray(raw.mentions) ? raw.mentions : [],
    replyParticipant: raw.normalizedReplyParticipant || extractReplyParticipant(raw),
    createdAt: row.created_at
  };
}

function extractReplyParticipant(raw) {
  const content = raw?.msgContent || raw?.message || raw;
  const contexts = [
    content?.extendedTextMessage?.contextInfo,
    content?.imageMessage?.contextInfo,
    content?.videoMessage?.contextInfo,
    content?.stickerMessage?.contextInfo,
    content?.documentMessage?.contextInfo,
    content?.contextInfo,
    raw?.contextInfo
  ].filter(Boolean);
  return contexts
    .map((context) => String(context?.participant || context?.key?.participant || context?.participantJid || '').replace(/\s/g, '').trim())
    .find(Boolean) || '';
}

function mapSessionEvent(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    direction: 'system',
    type: row.type,
    body: row.body,
    status: 'event',
    actorUserId: row.actor_user_id,
    actorUserName: row.actor_user_name,
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_name,
    targetSectorId: row.target_sector_id,
    targetSectorName: row.target_sector_name,
    createdAt: row.created_at,
    raw: {}
  };
}

function migrateLegacySessions() {
  const contacts = db.prepare('SELECT * FROM contacts').all();
  const tx = db.transaction(() => {
    for (const contact of contacts) {
      const existing = db.prepare('SELECT id FROM support_sessions WHERE contact_id = ? LIMIT 1').get(contact.id);
      if (existing) {
        db.prepare('UPDATE messages SET session_id = ? WHERE contact_id = ? AND session_id IS NULL').run(existing.id, contact.id);
        continue;
      }

      const sessionId = randomUUID();
      const status = normalizeConversationStatus(contact.chat_status || 'waiting');
      insertSessionStmt.run({
        id: sessionId,
        contactId: contact.id,
        phone: contact.phone,
        isGroup: contact.is_group || 0,
        status,
        unreadCount: contact.unread_count || 0,
        startedAt: contact.created_at || now(),
        closedAt: status === 'finished' ? contact.updated_at || now() : null,
        lastMessageAt: contact.last_message_at || contact.updated_at || contact.created_at || now(),
        assignedUserId: null,
        sectorId: null,
        agentId: null,
        createdAt: contact.created_at || now(),
        updatedAt: contact.updated_at || now()
      });
      db.prepare('UPDATE messages SET session_id = ? WHERE contact_id = ? AND session_id IS NULL').run(sessionId, contact.id);
    }
  });
  tx();
}

function listPeriodMessages(filters = {}) {
  const where = [];
  const params = {};
  if (filters.from) {
    where.push('datetime(created_at) >= datetime(@from)');
    params.from = filters.from;
  }
  if (filters.to) {
    where.push('datetime(created_at) <= datetime(@to)');
    params.to = filters.to;
  }
  return db.prepare(`
    SELECT * FROM messages
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `).all(params).map(mapMessage);
}

function listRecentSessionEvents(type, limit = 12) {
  return db.prepare(`
    SELECT e.*, actor.name AS actor_user_name, target.name AS target_user_name, sector.name AS target_sector_name
    FROM support_session_events e
    LEFT JOIN users actor ON actor.id = e.actor_user_id
    LEFT JOIN users target ON target.id = e.target_user_id
    LEFT JOIN sectors sector ON sector.id = e.target_sector_id
    WHERE e.type = ?
    ORDER BY datetime(e.created_at) DESC
    LIMIT ?
  `).all(type, limit).map(mapSessionEvent);
}

function listUserSectors(userId) {
  return db.prepare(`
    SELECT s.*
    FROM user_sectors us
    JOIN sectors s ON s.id = us.sector_id
    WHERE us.user_id = ?
    ORDER BY s.name COLLATE NOCASE ASC
  `).all(userId).map(mapSector);
}

function setUserSectorIds(userId, sectorIds = []) {
  const ids = normalizeIdList(sectorIds);
  const sectors = ids.map((id) => findSectorStmt.get(id)).filter(Boolean);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_sectors WHERE user_id = ?').run(userId);
    for (const sector of sectors) {
      db.prepare(`
        INSERT INTO user_sectors (user_id, sector_id, created_at)
        VALUES (?, ?, ?)
      `).run(userId, sector.id, now());
    }
  });
  tx();
}

function listSessionTags(sessionId) {
  return db.prepare(`
    SELECT t.*
    FROM support_session_tags st
    JOIN support_tags t ON t.id = st.tag_id
    WHERE st.session_id = ?
    ORDER BY t.name COLLATE NOCASE ASC
  `).all(sessionId).map(mapSupportTag);
}

function buildUserMetrics(sessions) {
  const users = listUsers();
  const metrics = new Map(users.map((user) => [user.id, {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    activeUser: user.active,
    total: 0,
    waiting: 0,
    active: 0,
    finished: 0
  }]));

  for (const session of sessions) {
    const key = session.assignedUserId || 'unassigned';
    if (!metrics.has(key)) {
      metrics.set(key, {
        userId: null,
        name: 'Sem responsavel',
        email: '',
        role: '',
        activeUser: false,
        total: 0,
        waiting: 0,
        active: 0,
        finished: 0
      });
    }
    const item = metrics.get(key);
    item.total += 1;
    item[session.chatStatus] += 1;
  }

  return [...metrics.values()]
    .filter((item) => item.total > 0 || item.activeUser)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function averageFirstResponseMinutes(sessions) {
  const values = sessions.map((session) => {
    const inbound = db.prepare(`
      SELECT created_at FROM messages
      WHERE session_id = ? AND direction = 'inbound'
      ORDER BY datetime(created_at) ASC
      LIMIT 1
    `).get(session.id);
    const outbound = db.prepare(`
      SELECT created_at FROM messages
      WHERE session_id = ? AND direction = 'outbound'
      ORDER BY datetime(created_at) ASC
      LIMIT 1
    `).get(session.id);
    if (!inbound || !outbound) return null;
    return Math.max(0, new Date(outbound.created_at) - new Date(inbound.created_at)) / 60000;
  }).filter((value) => Number.isFinite(value));
  return Math.round(average(values));
}

function averageCloseMinutes(sessions) {
  const values = sessions
    .filter((session) => session.closedAt)
    .map((session) => Math.max(0, new Date(session.closedAt) - new Date(session.startedAt)) / 60000)
    .filter((value) => Number.isFinite(value));
  return Math.round(average(values));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUserRole(value) {
  const role = String(value || 'attendant').trim().toLowerCase();
  if (['admin', 'attendant'].includes(role)) return role;
  const error = new Error('Perfil de usuario invalido.');
  error.status = 400;
  throw error;
}

function normalizeAccentColor(value) {
  const color = String(value || 'green').trim().toLowerCase();
  return ['green', 'blue', 'red', 'orange', 'purple', 'pink'].includes(color) ? color : 'green';
}

function normalizeTransferMode(value) {
  const mode = String(value || 'none').trim().toLowerCase();
  return ['none', 'user', 'sector'].includes(mode) ? mode : 'none';
}

function clampTemperature(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.4;
  return Math.min(1, Math.max(0, number));
}

function normalizeContactStatus(value) {
  const status = String(value || 'active').trim().toLowerCase();
  return status || 'active';
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeTags(parsed);
    } catch {}
    return trimmed.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function normalizeIdList(value) {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeIdList(parsed);
    } catch {}
    return normalizeIdList(trimmed.split(','));
  }
  return [];
}

function cleanOptional(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function cleanPhone(value) {
  const cleaned = String(value || '').replace(/\s/g, '').trim();
  if (!cleaned) return '';
  if (cleaned.toLowerCase().endsWith('@g.us')) return cleaned;
  return cleaned.split('@')[0];
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const actual = Buffer.from(scryptSync(String(password), salt, 64).toString('hex'), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}
