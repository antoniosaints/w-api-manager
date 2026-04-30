export function initials(value) {
  return String(value || '?').slice(0, 2).toUpperCase();
}

export function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  }).format(new Date(value));
}

export function isPlaceholderBody(value) {
  return /^\[[^\]]+\]$/.test(String(value || '').trim());
}

export function findQrImage(payload) {
  if (!payload) return '';
  const value = payload.qrCode || payload.qrcode || payload.base64 || payload.image || payload.png;
  if (!value) return '';
  if (String(value).startsWith('data:image')) return value;
  if (String(value).startsWith('http')) return value;
  return `data:image/png;base64,${value}`;
}

export function eventToRow(event) {
  return {
    id: crypto.randomUUID(),
    eventType: event.eventType,
    raw: event.payload,
    createdAt: new Date().toISOString()
  };
}

export function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function isConnected(status) {
  return Boolean(status?.connected || status?.status === 'connected' || status?.instance?.connected);
}
