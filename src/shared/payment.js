export function normalizeInvoice(payload = {}) {
  const invoice = payload.invoice && typeof payload.invoice === 'object' ? payload.invoice : {};
  const raw = payload.raw && typeof payload.raw === 'object' ? payload.raw : payload;
  return {
    available: Boolean(invoice.available ?? hasInvoiceSignal(raw)),
    status: invoice.status || firstByKey(raw, ['status', 'paymentStatus', 'invoiceStatus', 'subscriptionStatus']) || 'unknown',
    statusLabel: invoice.statusLabel || statusLabel(invoice.status || firstByKey(raw, ['status', 'paymentStatus', 'invoiceStatus', 'subscriptionStatus'])),
    amount: invoice.amount || firstByKey(raw, ['amount', 'value', 'total', 'price', 'invoiceValue']),
    dueDate: invoice.dueDate || firstByKey(raw, ['dueDate', 'due_date', 'expiresAt', 'expirationDate', 'expiration', 'invoiceDueDate']),
    paymentUrl: invoice.paymentUrl || firstUrlByKey(raw, ['paymentUrl', 'paymentLink', 'checkoutUrl', 'invoiceUrl', 'url', 'link', 'boletoUrl', 'bankSlipUrl']),
    pixCode: invoice.pixCode || firstByKey(raw, ['pixCode', 'pixCopiaECola', 'pixCopyPaste', 'copyPaste', 'copyPasteCode', 'brCode']),
    qrCode: invoice.qrCode || firstQrCode(raw),
    boletoUrl: invoice.boletoUrl || firstUrlByKey(raw, ['boletoUrl', 'bankSlipUrl', 'bankSlip', 'billetUrl'])
  };
}

export function formatInvoiceAmount(value) {
  if (value === '' || value === null || value === undefined) return 'Valor nao informado';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
}

export function formatInvoiceDate(value) {
  if (!value) return 'Vencimento nao informado';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function statusLabel(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['paid', 'approved', 'active'].includes(status)) return 'Paga';
  if (['pending', 'waiting', 'open', 'created'].includes(status)) return 'Pendente';
  if (['overdue', 'expired', 'late'].includes(status)) return 'Vencida';
  if (['canceled', 'cancelled', 'inactive'].includes(status)) return 'Cancelada';
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Nao informado';
}

function hasInvoiceSignal(value) {
  return Boolean(
    firstByKey(value, ['status', 'paymentStatus', 'invoiceStatus', 'amount', 'value', 'pixCode'])
      || firstUrlByKey(value, ['paymentUrl', 'paymentLink', 'invoiceUrl', 'boletoUrl'])
  );
}

function firstByKey(source, keys) {
  const matches = [];
  walk(source, (key, value) => {
    if (matches.length) return;
    if (keys.some((candidate) => candidate.toLowerCase() === key.toLowerCase()) && ['string', 'number', 'boolean'].includes(typeof value)) {
      matches.push(value);
    }
  });
  return matches[0] ?? '';
}

function firstUrlByKey(source, keys) {
  const matches = [];
  walk(source, (key, value) => {
    if (matches.length || typeof value !== 'string') return;
    if (!keys.some((candidate) => candidate.toLowerCase() === key.toLowerCase())) return;
    if (/^https?:\/\//i.test(value.trim())) matches.push(value.trim());
  });
  return matches[0] || '';
}

function firstQrCode(source) {
  const matches = [];
  walk(source, (key, value) => {
    if (matches.length || typeof value !== 'string' || !/(qr|qrcode)/i.test(key)) return;
    const text = value.trim();
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
