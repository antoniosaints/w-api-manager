import React, { useEffect, useState } from 'react';
import { Clock3, Loader2, Save, Webhook } from 'lucide-react';
import { api } from '../shared/api.js';
import { formatTime } from '../shared/format.js';
import { Button, Card, Input } from '../components/ui/index.js';

export function WebhookPanel({ settings, setSettings, events, onError, showToast }) {
  const [url, setUrl] = useState(settings?.webhookPublicUrl || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setUrl(settings?.webhookPublicUrl || ''); }, [settings?.webhookPublicUrl]);

  async function register() {
    setSaving(true);
    try {
      const result = await api('/api/wapi/webhooks/register', { method: 'PUT', body: { webhookPublicUrl: url } });
      const updated = await api('/api/settings');
      setSettings(updated);
      showToast(`Webhooks registrados: ${Object.keys(result.targets).length}`);
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="two-column webhooks-layout">
      <Card variant="panel" className="single-panel">
        <div className="panel-title">
          <Webhook size={24} />
          <div><span>Tempo real</span><h1>Registrar webhooks</h1><p>Atualize a URL publica usada pela W-API para eventos da instancia.</p></div>
        </div>
        <div className="stacked-form panel-pad">
          <Input label="URL publica do servidor" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://seu-tunel.app" />
          <div className="endpoint-list">
            {['/webhooks/wapi/received', '/webhooks/wapi/delivery', '/webhooks/wapi/message-status', '/webhooks/wapi/presence'].map((route) => <code key={route}>{route}</code>)}
          </div>
          <Button variant="primary" onClick={register} disabled={saving || !url}>{saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}Registrar na W-API</Button>
        </div>
      </Card>
      <Card variant="panel" className="single-panel event-panel">
        <div className="panel-title compact">
          <Clock3 size={22} />
          <div><span>Historico</span><h1>Eventos recebidos</h1><p>Ultimos eventos entregues pelos webhooks locais.</p></div>
        </div>
        <div className="event-list">
          {events.map((event) => <Card as="article" variant="row" key={event.id || `${event.eventType}-${event.createdAt}`}><strong>{event.eventType}</strong><small>{formatTime(event.createdAt)}</small><pre>{JSON.stringify(event.raw || event.payload || {}, null, 2)}</pre></Card>)}
          {!events.length && <p className="empty">Nenhum evento recebido ainda.</p>}
        </div>
      </Card>
    </section>
  );
}
