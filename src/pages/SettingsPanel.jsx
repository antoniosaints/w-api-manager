import React, { useEffect, useState } from 'react';
import { Copy, CreditCard, ExternalLink, Loader2, QrCode, RefreshCw, Save, Settings } from 'lucide-react';
import { api } from '../shared/api.js';
import { formatInvoiceAmount, formatInvoiceDate, normalizeInvoice } from '../shared/payment.js';
import { Button, Card, Input, Switch } from '../components/ui/index.js';

export function SettingsPanel({ settings, setSettings, currentUser, onError, showToast }) {
  const [form, setForm] = useState({ baseUrl: '', instanceId: '', instanceJid: '', token: '', webhookPublicUrl: '', ignoreGroups: false, automaticAttendance: false, geminiApiKey: '' });
  const [saving, setSaving] = useState(false);
  const [invoicePayload, setInvoicePayload] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const canViewBilling = currentUser?.role === 'admin';
  const invoice = normalizeInvoice(invoicePayload || {});

  useEffect(() => {
    setForm({
      baseUrl: settings?.baseUrl || 'https://api.w-api.app',
      instanceId: settings?.instanceId || '',
      instanceJid: settings?.instanceJid || '',
      token: '',
      webhookPublicUrl: settings?.webhookPublicUrl || '',
      ignoreGroups: Boolean(settings?.ignoreGroups),
      automaticAttendance: Boolean(settings?.automaticAttendance),
      geminiApiKey: ''
    });
  }, [settings]);

  useEffect(() => {
    if (canViewBilling) loadInvoice();
  }, [canViewBilling, settings?.instanceId]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.token) delete payload.token;
      if (!payload.geminiApiKey) delete payload.geminiApiKey;
      const next = await api('/api/settings', { method: 'PUT', body: payload });
      setSettings(next);
      setForm((current) => ({ ...current, token: '', geminiApiKey: '' }));
      showToast('Configuracoes salvas');
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  async function loadInvoice() {
    setInvoiceLoading(true);
    try {
      setInvoicePayload(await api('/api/wapi/payment/status'));
    } catch (error) {
      onError(error);
      setInvoicePayload(null);
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(String(invoice.pixCode || ''));
      showToast('Codigo Pix copiado');
    } catch {
      onError(new Error('Nao foi possivel copiar o codigo Pix.'));
    }
  }

  return (
    <>
      <Card as="section" variant="panel" className="single-panel">
        <div className="panel-title">
          <Settings size={24} />
          <div><span>Credenciais locais</span><h1>Ajustes da API</h1><p>As credenciais ficam no servidor local e o token so e alterado quando preenchido.</p></div>
        </div>
        <form className="stacked-form form-grid" onSubmit={submit}>
          <Input label="Base URL" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} />
          <Input label="Instance ID" value={form.instanceId} onChange={(event) => setForm({ ...form, instanceId: event.target.value })} />
          <Input label="JID ou numero do bot" help="Usado para liberar respostas automaticas quando o bot for marcado em grupos." value={form.instanceJid} onChange={(event) => setForm({ ...form, instanceJid: event.target.value })} placeholder="5511999999999@s.whatsapp.net" />
          <Input label="Token" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} placeholder={settings?.hasToken ? 'Token ja configurado' : 'Bearer token da instancia'} type="password" />
          <Input label="URL publica webhook" value={form.webhookPublicUrl} onChange={(event) => setForm({ ...form, webhookPublicUrl: event.target.value })} placeholder="https://seu-tunel.app" />
          <Input label="Chave Gemini" value={form.geminiApiKey} onChange={(event) => setForm({ ...form, geminiApiKey: event.target.value })} placeholder={settings?.hasGeminiApiKey ? 'Chave ja configurada' : 'API key do Gemini'} type="password" />
          <Switch label="Ignorar grupos" help="Quando ativo, eventos de grupos recebidos pela W-API nao viram atendimentos." checked={form.ignoreGroups} onChange={(event) => setForm({ ...form, ignoreGroups: event.target.checked })} />
          <Switch label="Atendimento automatico" help="Quando ativo, agentes de IA podem responder conversas em espera." checked={form.automaticAttendance} onChange={(event) => setForm({ ...form, automaticAttendance: event.target.checked })} />
          <Button variant="primary" disabled={saving}>{saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}Salvar</Button>
        </form>
      </Card>

      {canViewBilling && (
        <Card as="section" variant="panel" className="single-panel invoice-panel">
          <div className="panel-title">
            <CreditCard size={24} />
            <div><span>Conexao W-API</span><h1>Fatura e pagamento</h1><p>Status financeiro retornado pela instancia configurada.</p></div>
          </div>

          <div className="invoice-toolbar">
            <span className={`invoice-status ${invoice.status}`}>{invoice.statusLabel}</span>
            <Button type="button" variant="secondary" onClick={loadInvoice} disabled={invoiceLoading}>
              {invoiceLoading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
              Atualizar
            </Button>
          </div>

          {invoiceLoading && !invoicePayload ? (
            <p className="empty">Carregando fatura da W-API.</p>
          ) : invoice.available ? (
            <div className="invoice-grid">
              <div className="invoice-facts">
                <span><strong>Valor</strong>{formatInvoiceAmount(invoice.amount)}</span>
                <span><strong>Vencimento</strong>{formatInvoiceDate(invoice.dueDate)}</span>
                <span><strong>Status</strong>{invoice.statusLabel}</span>
              </div>

              {invoice.qrCode && (
                <div className="invoice-qr">
                  <QrCode size={18} />
                  <img src={invoice.qrCode} alt="QR Code Pix" />
                </div>
              )}

              <div className="invoice-actions">
                {invoice.paymentUrl && (
                  <Button asChild variant="primary">
                    <a href={invoice.paymentUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={17} />
                      Pagar fatura
                    </a>
                  </Button>
                )}
                {invoice.pixCode && (
                  <Button type="button" variant="secondary" onClick={copyPix}>
                    <Copy size={17} />
                    Copiar Pix
                  </Button>
                )}
                {invoice.boletoUrl && !invoice.paymentUrl && (
                  <Button asChild variant="secondary">
                    <a href={invoice.boletoUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={17} />
                      Abrir boleto
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="empty">Nenhuma fatura disponivel para esta instancia.</p>
          )}
        </Card>
      )}
    </>
  );
}
