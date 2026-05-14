export const DEFAULT_AUTO_CLOSE_IDLE_MINUTES = 60;
export const DEFAULT_AUTO_CLOSE_MESSAGE = 'Encerramos este atendimento por inatividade. Se precisar de ajuda novamente, envie uma nova mensagem.';
export const MAX_AUTO_CLOSE_IDLE_MINUTES = 10080;
export const MAX_AUTO_CLOSE_MESSAGE_LENGTH = 1000;

export function normalizeAutoCloseSettings(settings = {}) {
  return {
    autoCloseActiveConversations: normalizeBoolean(settings.autoCloseActiveConversations),
    autoCloseIdleMinutes: normalizeAutoCloseIdleMinutes(settings.autoCloseIdleMinutes),
    autoCloseMessage: normalizeAutoCloseMessage(settings.autoCloseMessage)
  };
}

export function normalizeAutoCloseIdleMinutes(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_AUTO_CLOSE_IDLE_MINUTES;
  return Math.min(parsed, MAX_AUTO_CLOSE_IDLE_MINUTES);
}

export function normalizeAutoCloseMessage(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return DEFAULT_AUTO_CLOSE_MESSAGE;
  return text.slice(0, MAX_AUTO_CLOSE_MESSAGE_LENGTH);
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}
