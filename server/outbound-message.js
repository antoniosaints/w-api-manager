export function applyMessageNameHeader(message, user = {}) {
  const text = String(message || '').trim();
  const name = String(user?.name || '').trim();
  if (!text || !name || !user?.sendNameHeader) return text;
  const header = `*_${name}_*\n`;
  return text.startsWith(header) ? text : `${header}${text}`;
}
