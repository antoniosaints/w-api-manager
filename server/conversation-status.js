export const CHAT_STATUSES = ['waiting', 'active', 'finished'];

export function normalizeConversationStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (CHAT_STATUSES.includes(status)) return status;

  const error = new Error('Status de conversa invalido.');
  error.status = 400;
  throw error;
}

export function shouldCreateNewSessionForMessage({ direction, currentStatus }) {
  if (!currentStatus) return true;
  if (currentStatus === 'finished') return true;
  return direction === 'outbound' && currentStatus !== 'active' && currentStatus !== 'waiting';
}

export function getNextSessionStatusForMessage({ direction, currentStatus }) {
  if (currentStatus === 'active') return 'active';
  return direction === 'outbound' ? 'active' : 'waiting';
}
