import {
  createMessage,
  getSupportSessionById,
  getUserById,
  listIdleActiveSupportSessions,
  publicSettings,
  updateSupportSessionStatus
} from './db.js';
import { sendTextMessage } from './wapi.js';
import { normalizeAutoCloseSettings } from './auto-close-settings.js';

export async function runAutoCloseActiveSessions({
  settings,
  now = () => new Date(),
  limit = 25,
  sendText = sendTextMessage,
  onMessage,
  onConversationsChanged
} = {}) {
  const resolvedSettings = normalizeAutoCloseSettings(settings || publicSettings());
  if (!resolvedSettings.autoCloseActiveConversations) {
    return { checked: 0, closed: [], failed: [], skipped: 'disabled' };
  }

  const currentDate = normalizeDate(typeof now === 'function' ? now() : now);
  if (!currentDate) {
    return { checked: 0, closed: [], failed: [], skipped: 'invalid-now' };
  }

  const idleBefore = new Date(currentDate.getTime() - resolvedSettings.autoCloseIdleMinutes * 60_000);
  const candidates = listIdleActiveSupportSessions({ idleBefore, limit });
  const closed = [];
  const failed = [];

  for (const candidate of candidates) {
    const session = getSupportSessionById(candidate.id);
    if (!isStillIdleActive(session, idleBefore)) continue;

    try {
      const response = await sendText({
        phone: session.phone,
        message: resolvedSettings.autoCloseMessage
      });
      const message = createMessage({
        phone: session.phone,
        sessionId: session.id,
        direction: 'outbound',
        type: 'text',
        body: resolvedSettings.autoCloseMessage,
        status: 'sent',
        externalId: response?.messageId || response?.id || null,
        raw: {
          automaticClosure: true,
          autoCloseIdleMinutes: resolvedSettings.autoCloseIdleMinutes,
          wapi: response || {}
        }
      });
      if (message && typeof onMessage === 'function') onMessage(message);

      const actor = resolveClosureActor(session);
      const conversation = updateSupportSessionStatus(session.id, 'finished', actor);
      if (typeof onConversationsChanged === 'function') onConversationsChanged(conversation);

      closed.push({
        sessionId: session.id,
        phone: session.phone,
        messageId: message?.id || null,
        conversation
      });
    } catch (error) {
      failed.push({
        sessionId: session.id,
        phone: session.phone,
        error: error.message || String(error)
      });
    }
  }

  return { checked: candidates.length, closed, failed };
}

function isStillIdleActive(session, idleBefore) {
  if (!session || session.chatStatus !== 'active') return false;
  const lastActivity = normalizeDate(session.lastMessageAt || session.startedAt);
  if (!lastActivity) return false;
  return lastActivity.getTime() <= idleBefore.getTime();
}

function resolveClosureActor(session) {
  if (!session?.assignedUserId) return { name: 'Sistema' };
  return getUserById(session.assignedUserId) || {
    id: session.assignedUserId,
    name: session.assignedUserName || 'Atendente'
  };
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
