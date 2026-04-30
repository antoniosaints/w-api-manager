import React, { useEffect, useState } from 'react';
import { Edit3, Loader2, Navigation, Plus, Send, Trash2 } from 'lucide-react';
import { api } from '../shared/api.js';
import { Badge, Button, Card, Input, Modal, Pagination, SearchField, Select, Table, Textarea } from '../components/ui/index.js';

const emptyContact = {
  name: '',
  phone: '',
  email: '',
  address: '',
  latitude: '',
  longitude: '',
  notes: '',
  tags: '',
  status: 'active',
  source: 'manual'
};

const CONTACT_STATUS_LABELS = {
  active: 'Ativo',
  lead: 'Lead',
  inactive: 'Inativo'
};

export function ContactModal({ initialContact, onClose, onSaved, onError, showToast }) {
  const [form, setForm] = useState(() => ({ ...emptyContact, ...initialContact, tags: Array.isArray(initialContact?.tags) ? initialContact.tags.join(', ') : initialContact?.tags || '' }));
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, tags: String(form.tags || '').split(',').map((item) => item.trim()).filter(Boolean) };
      const result = form.id
        ? await api(`/api/contacts/${form.id}`, { method: 'PATCH', body: payload })
        : await api('/api/contacts', { method: 'POST', body: payload });
      showToast?.('Contato salvo');
      onSaved?.(result.contact);
      onClose();
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={form.id ? 'Editar contato' : 'Salvar contato'}
      description="Organize os dados do cliente para atendimento e envio posterior."
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" form="contact-form" disabled={saving || !form.phone}>{saving ? <Loader2 className="spin" size={18} /> : <Navigation size={18} />}Salvar</Button></>}
    >
      <form id="contact-form" className="stacked-form" onSubmit={submit}>
        <Input label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input label="Telefone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
        <Input label="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" />
        <Input label="Endereco" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        <div className="form-inline">
          <Input label="Latitude" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} />
          <Input label="Longitude" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} />
        </div>
        <Input label="Tags" help="Separe por virgulas." value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
        <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="active">Ativo</option>
          <option value="lead">Lead</option>
          <option value="inactive">Inativo</option>
        </Select>
        <Textarea label="Observacoes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
      </form>
    </Modal>
  );
}

export function ContactsPanel({ onError, showToast, onSendToContact, onDeleteContact }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', status: '', tag: '', page: 1 });
  const [modalContact, setModalContact] = useState(null);

  useEffect(() => { load(); }, [filters.search, filters.status, filters.tag, filters.page]);

  async function load() {
    try {
      const query = new URLSearchParams({ ...filters, limit: '10' });
      const result = await api(`/api/contacts?${query}`);
      setRows(result.data);
      setMeta(result.meta);
    } catch (error) {
      onError(error);
    }
  }

  async function remove(contact) {
    if (!window.confirm(`Apagar o contato ${contact.name || contact.phone}?`)) return;
    try {
      await api(`/api/contacts/${contact.id}`, { method: 'DELETE' });
      showToast('Contato apagado');
      await load();
      await onDeleteContact?.(contact);
    } catch (error) {
      onError(error);
    }
  }

  const columns = [
    { key: 'name', label: 'Contato', render: (contact) => <div className="table-primary"><strong>{contact.name || contact.phone}</strong><small>{contact.phone}</small></div> },
    { key: 'email', label: 'Email', render: (contact) => contact.email || '-' },
    { key: 'address', label: 'Localizacao', render: (contact) => contact.address || [contact.latitude, contact.longitude].filter(Boolean).join(', ') || '-' },
    { key: 'status', label: 'Status', render: (contact) => <Badge tone={contact.status}>{CONTACT_STATUS_LABELS[contact.status] || contact.status}</Badge> },
    {
      key: 'actions',
      label: 'Acoes',
      render: (contact) => (
        <div className="row-actions">
          <Button compact onClick={() => onSendToContact(contact)}><Send size={16} />Enviar</Button>
          <Button compact onClick={() => setModalContact(contact)}><Edit3 size={16} />Editar</Button>
          <Button compact danger onClick={() => remove(contact)}><Trash2 size={16} />Apagar</Button>
        </div>
      )
    }
  ];

  return (
    <Card as="section" variant="panel" className="single-panel">
      <div className="panel-title">
        <Navigation size={24} />
        <div>
          <span>CRM leve</span>
          <h1>Gerenciamento de contatos</h1>
          <p>Cadastre clientes, localizacao, tags e dados para envio posterior.</p>
        </div>
        <Button variant="primary" onClick={() => setModalContact(emptyContact)}><Plus size={18} />Novo contato</Button>
      </div>
      <div className="data-toolbar">
        <SearchField placeholder="Buscar nome, telefone ou email" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} />
        <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}>
          <option value="">Todos status</option>
          <option value="active">Ativo</option>
          <option value="lead">Lead</option>
          <option value="inactive">Inativo</option>
        </Select>
        <Input value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value, page: 1 })} placeholder="Tag" />
      </div>
      <Table columns={columns} rows={rows} empty="Nenhum contato encontrado." density="compact" />
      <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
      {modalContact && <ContactModal initialContact={modalContact} onClose={() => setModalContact(null)} onSaved={load} onError={onError} showToast={showToast} />}
    </Card>
  );
}
