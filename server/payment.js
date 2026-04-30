const STATUS_LABELS = {
  paid: 'Paga',
  approved: 'Paga',
  active: 'Paga',
  pending: 'Pendente',
  waiting: 'Pendente',
  overdue: 'Vencida',
  expired: 'Vencida',
  canceled: 'Cancelada',
  cancelled: 'Cancelada'
};

export function normalizePaymentStatus(payload = {}) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const statusValue = firstByKey(data, ['status', 'paymentStatus', 'invoiceStatus', 'subscriptionStatus', 'state']);
  const status = normalizeStatus(statusValue || (data?.paid === true ? 'paid' : ''));
  const amount = firstByKey(data, ['amount', 'value', 'total', 'price', 'invoiceValue', 'planValue']);
  const dueDate = firstByKey(data, ['dueDate', 'due_date', 'expiresAt', 'expirationDate', 'expiration', 'invoiceDueDate']);
  const paymentUrl = firstUrlByKey(data, ['paymentUrl', 'paymentLink', 'checkoutUrl', 'invoiceUrl', 'url', 'link', 'boletoUrl', 'bankSlipUrl']);
  const pixCode = firstByKey(data, ['pixCode', 'pixCopiaECola', 'pixCopyPaste', 'copyPaste', 'copyPasteCode', 'brCode']);
  const qrCode = firstQrCode(data);
  const boletoUrl = firstUrlByKey(data, ['boletoUrl', 'bankSlipUrl', 'bankSlip', 'billetUrl']);

  return {
    available: Boolean(status || amount || dueDate || paymentUrl || pixCode || qrCode || boletoUrl),
    status: status || 'unknown',
    statusLabel: STATUS_LABELS[status] || (status ? titleCase(status) : 'Nao informado'),
    amount,
    dueDate,
    paymentUrl,
    pixCode,
    qrCode,
    boletoUrl
  };
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!status) return '';
  if (['paid', 'approved', 'active'].includes(status)) return 'paid';
  if (['pending', 'waiting', 'open', 'created'].includes(status)) return 'pending';
  if (['overdue', 'expired', 'late'].includes(status)) return 'overdue';
  if (['canceled', 'cancelled', 'inactive'].includes(status)) return 'canceled';
  return status;
}

function firstByKey(source, keys) {
  const matches = [];
  walk(source, (key, value) => {
    if (matches.length) return;
    if (keys.some((candidate) => candidate.toLowerCase() === key.toLowerCase()) && isScalar(value)) {
      matches.push(value);
    }
  });
  return matches[0] ?? '';
}

function firstUrlByKey(source, keys) {
  const matches = [];
  walk(source, (key, value) => {
    if (matches.length || typeof value !== 'string') return;
    const lowerKey = key.toLowerCase();
    if (keys.some((candidate) => candidate.toLowerCase() === lowerKey) && /^https?:\/\//i.test(value.trim())) {
      matches.push(value.trim());
    }
  });
  return matches[0] || '';
}

function firstQrCode(source) {
  const matches = [];
  walk(source, (key, value) => {
    if (matches.length || typeof value !== 'string') return;
    const lowerKey = key.toLowerCase();
    const text = value.trim();
    if (!/(qr|qrcode)/.test(lowerKey)) return;
    if (/^data:image\//i.test(text) || /^https?:\/\//i.test(text)) {
      matches.push(text);
    } else if (/^[a-z0-9+/=]+$/i.test(text) && text.length > 80) {
      matches.push(`data:image/png;base64,${text}`);
    }
  });
  return matches[0] || '';
}

function walk(value, visitor) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child);
    if (child && typeof child === 'object') walk(child, visitor);
  }
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function titleCase(value) {
  const text = String(value || '').replace(/[_-]+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
