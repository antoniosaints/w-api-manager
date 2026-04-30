import React, { useState } from 'react';
import { Loader2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { api } from '../shared/api.js';
import { findQrImage } from '../shared/format.js';
import { Button, Card } from '../components/ui/index.js';

function Info({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

export function ConnectionPanel({ settings, status, setStatus, onError, showToast }) {
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState('');

  async function run(kind) {
    setLoading(kind);
    try {
      const data = await api(kind === 'status' ? '/api/wapi/status' : '/api/wapi/qr-code');
      if (kind === 'status') {
        setStatus(data);
        showToast('Status atualizado');
      } else {
        setQr(data);
      }
    } catch (error) {
      onError(error);
    } finally {
      setLoading('');
    }
  }

  const qrImage = findQrImage(qr);
  return (
    <section className="two-column">
      <Card variant="panel" className="single-panel">
        <div className="panel-title">
          <Smartphone size={24} />
          <div>
            <span>Instancia</span>
            <h1>Conexao W-API</h1>
            <p>Valide a conexao antes de registrar webhooks ou disparar mensagens.</p>
          </div>
        </div>
        <div className="info-list">
          <Info label="Base URL" value={settings?.baseUrl || '-'} />
          <Info label="Instance ID" value={settings?.instanceId || '-'} />
          <Info label="Token" value={settings?.hasToken ? 'Configurado' : 'Pendente'} />
        </div>
        <div className="button-row">
          <Button onClick={() => run('status')}>{loading === 'status' ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}Status</Button>
          <Button onClick={() => run('qr')}>{loading === 'qr' ? <Loader2 className="spin" size={18} /> : <QrCode size={18} />}QR Code</Button>
        </div>
        {status && <pre className="json-box">{JSON.stringify(status, null, 2)}</pre>}
      </Card>
      <Card variant="panel" className="single-panel qr-panel">
        {qrImage ? <img src={qrImage} alt="QR Code da instancia W-API" /> : <div className="qr-placeholder"><QrCode size={58} /><p>Gere o QR Code para conectar o WhatsApp nesta instancia.</p></div>}
      </Card>
    </section>
  );
}
