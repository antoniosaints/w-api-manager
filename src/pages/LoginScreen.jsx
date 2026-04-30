import React, { useState } from 'react';
import { Loader2, PlugZap, UserCheck } from 'lucide-react';
import { Button, Card, Input } from '../components/ui/index.js';

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onLogin({ email, password });
    } catch (err) {
      setError(err.message || 'Nao foi possivel entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Card as="form" variant="auth" className="auth-card stacked-form" onSubmit={submit}>
        <span className="brand-mark"><PlugZap size={26} /></span>
        <div>
          <span>Acesso operacional</span>
          <h1>W-API Atendimento</h1>
          <p>Entre para atender, transferir e acompanhar a operacao.</p>
        </div>
        <Input label="Email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
        <Input label="Senha" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        {error && <p className="form-error">{error}</p>}
        <Button variant="primary" disabled={loading || !email || !password}>
          {loading ? <Loader2 className="spin" size={18} /> : <UserCheck size={18} />}
          Entrar
        </Button>
      </Card>
    </main>
  );
}
