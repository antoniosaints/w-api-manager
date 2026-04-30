import React, { useEffect, useState } from 'react';
import { Edit3, Loader2, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../shared/api.js';
import { Badge, Button, Card, Checkbox, Input, Modal, Pagination, SearchField, Select, Switch, Table } from '../components/ui/index.js';

const emptyForm = { name: '', email: '', password: '', role: 'attendant', active: true, sendNameHeader: false, sectorIds: [] };

export function UsersPanel({ onRefresh, onDeleteUser, onError, showToast, currentUser, sectors = [] }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', role: '', active: '', page: 1 });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [filters.search, filters.role, filters.active, filters.page]);

  async function load() {
    try {
      const query = new URLSearchParams({ ...filters, limit: '10' });
      const result = await api(`/api/users/table?${query}`);
      setRows(result.data);
      setMeta(result.meta);
    } catch (error) {
      onError(error);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setModal({ mode: 'create' });
  }

  function openEdit(user) {
    setForm({ name: user.name, email: user.email, password: '', role: user.role, active: user.active, sendNameHeader: Boolean(user.sendNameHeader), id: user.id, sectorIds: (user.sectors || []).map((sector) => sector.id) });
    setModal({ mode: 'edit' });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await api('/api/users', { method: 'POST', body: form });
        showToast('Usuario criado');
      } else {
        const { id, password, ...changes } = form;
        await api(`/api/users/${id}`, { method: 'PATCH', body: changes });
        if (password) await api(`/api/users/${id}/password`, { method: 'PATCH', body: { password } });
        showToast('Usuario atualizado');
      }
      setModal(null);
      await load();
      await onRefresh();
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  async function remove(user) {
    if (user.id === currentUser?.id) {
      onError(new Error('Nao e possivel apagar o proprio usuario conectado.'));
      return;
    }
    if (!window.confirm(`Apagar o usuario ${user.name}?`)) return;
    try {
      await api(`/api/users/${user.id}`, { method: 'DELETE' });
      showToast('Usuario apagado');
      await load();
      await onRefresh?.();
      await onDeleteUser?.(user);
    } catch (error) {
      onError(error);
    }
  }

  const columns = [
    { key: 'name', label: 'Usuario', render: (user) => <div className="table-primary"><strong>{user.name}</strong><small>{user.email}</small></div> },
    { key: 'role', label: 'Perfil', render: (user) => user.role === 'admin' ? 'Admin' : 'Atendente' },
    { key: 'sectors', label: 'Setores', render: (user) => (user.sectors || []).map((sector) => sector.name).join(', ') || '-' },
    { key: 'active', label: 'Status', render: (user) => <Badge tone={user.active ? 'active' : 'inactive'}>{user.active ? 'Ativo' : 'Inativo'}</Badge> },
    {
      key: 'actions',
      label: 'Acoes',
      render: (user) => (
        <div className="row-actions">
          <Button compact onClick={() => openEdit(user)}><Edit3 size={16} />Editar</Button>
          <Button compact danger disabled={user.id === currentUser?.id} onClick={() => remove(user)}><Trash2 size={16} />Apagar</Button>
        </div>
      )
    }
  ];

  return (
    <Card as="section" variant="panel" className="single-panel">
      <div className="panel-title">
        <Users size={24} />
        <div>
          <span>Equipe</span>
          <h1>Usuarios cadastrados</h1>
          <p>Busque, filtre e gerencie acessos locais em uma tabela completa.</p>
        </div>
        <Button variant="primary" onClick={openCreate}><Plus size={18} />Novo</Button>
      </div>
      <div className="data-toolbar">
        <SearchField placeholder="Buscar usuario" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} />
        <Select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value, page: 1 })}>
          <option value="">Todos perfis</option>
          <option value="admin">Admin</option>
          <option value="attendant">Atendente</option>
        </Select>
        <Select value={filters.active} onChange={(event) => setFilters({ ...filters, active: event.target.value, page: 1 })}>
          <option value="">Todos status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </Select>
      </div>
      <Table columns={columns} rows={rows} empty="Nenhum usuario encontrado." density="compact" />
      <Pagination meta={meta} onPage={(page) => setFilters({ ...filters, page })} />
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Novo usuario' : 'Editar usuario'}
          description="Preencha os dados de acesso no padrao operacional do sistema."
          onClose={() => setModal(null)}
          footer={<><Button onClick={() => setModal(null)}>Cancelar</Button><Button variant="primary" form="user-form" disabled={saving}>{saving ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}Salvar</Button></>}
        >
          <form id="user-form" className="stacked-form" onSubmit={submit}>
            <Input label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Input label="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" required />
            <Input label={modal.mode === 'create' ? 'Senha' : 'Nova senha'} help={modal.mode === 'edit' ? 'Preencha apenas para trocar a senha.' : ''} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" required={modal.mode === 'create'} />
            <Select label="Perfil" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="attendant">Atendente</option>
              <option value="admin">Admin</option>
            </Select>
            <div className="option-grid">
              {(sectors || []).map((sector) => (
                <Checkbox
                  key={sector.id}
                  label={sector.name}
                  checked={(form.sectorIds || []).includes(sector.id)}
                  onChange={(event) => setForm({
                    ...form,
                    sectorIds: event.target.checked
                      ? [...(form.sectorIds || []), sector.id]
                      : (form.sectorIds || []).filter((id) => id !== sector.id)
                  })}
                />
              ))}
            </div>
            <Switch label="Usuario ativo" help="Pode entrar no sistema e receber transferencias." checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            <Switch label="Nome da mensagem" help="Inclui o nome deste usuario no topo das mensagens enviadas." checked={form.sendNameHeader} onChange={(event) => setForm({ ...form, sendNameHeader: event.target.checked })} />
          </form>
        </Modal>
      )}
    </Card>
  );
}
