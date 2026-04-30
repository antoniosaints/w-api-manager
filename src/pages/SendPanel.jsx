import React, { useEffect, useState } from 'react';
import { Navigation, Send } from 'lucide-react';
import { api } from '../shared/api.js';
import { Button, Card, Input, Select, Textarea } from '../components/ui/index.js';

export function SendPanel({ onSent, onError, initialContact = null }) {
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState('');
  const [phone, setPhone] = useState(initialContact?.phone || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api('/api/contacts?limit=100').then((result) => setContacts(result.data || [])).catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    if (!initialContact) return;
    setPhone(initialContact.phone || '');
    setContactId(initialContact.id || '');
  }, [initialContact?.id]);

  function chooseContact(id) {
    setContactId(id);
    const contact = contacts.find((item) => item.id === id);
    if (contact) setPhone(contact.phone);
  }

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    try {
      const result = await api('/api/messages/send', { method: 'POST', body: { phone, message } });
      setMessage('');
      onSent(result.message);
    } catch (error) {
      onError(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card as="section" variant="panel" className="single-panel">
      <div className="panel-title">
        <Navigation size={24} />
        <div>
          <span>Envio direto</span>
          <h1>Mandar nova mensagem</h1>
          <p>Escolha um contato salvo ou use o numero com DDI para iniciar uma conversa.</p>
        </div>
      </div>
      <form className="stacked-form form-grid" onSubmit={submit}>
        <Select label="Contato salvo" value={contactId} onChange={(event) => chooseContact(event.target.value)}>
          <option value="">Selecionar contato</option>
          {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || contact.phone} - {contact.phone}</option>)}
        </Select>
        <Input label="Telefone com DDI" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="5511999999999" />
        <Textarea label="Mensagem" value={message} onChange={(event) => setMessage(event.target.value)} rows={7} />
        <Button variant="primary" disabled={sending || !phone || !message.trim()}>
          <Send size={18} />
          Enviar
        </Button>
      </form>
    </Card>
  );
}
