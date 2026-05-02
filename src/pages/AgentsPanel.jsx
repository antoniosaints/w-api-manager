import React, { useEffect, useState } from "react";
import {
  Bot,
  Edit3,
  Loader2,
  Plus,
  Save,
  Tags,
  Trash2,
  UsersRound,
} from "lucide-react";
import { api } from "../shared/api.js";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  SearchField,
  Select,
  Switch,
  Textarea,
} from "../components/ui/index.js";

const emptyAgent = {
  id: "",
  name: "",
  active: true,
  model: "gemini-2.0-flash",
  temperature: 0.4,
  context: "",
  rules: "",
  behavior: "",
  transferMode: "none",
  transferUserId: "",
  transferSectorId: "",
};

const emptyTaxonomy = { id: "", name: "", color: "green", active: true };
const colors = ["green", "blue", "red", "orange", "purple", "pink"];

export function AgentsPanel({
  settings,
  setSettings,
  users = [],
  onError,
  showToast,
}) {
  const [agents, setAgents] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [tags, setTags] = useState([]);
  const [agentModal, setAgentModal] = useState(null);
  const [sectorModal, setSectorModal] = useState(null);
  const [tagModal, setTagModal] = useState(null);
  const [geminiForm, setGeminiForm] = useState({
    geminiApiKey: "",
    automaticAttendance: false,
  });
  const [activeTab, setActiveTab] = useState("agents");
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState("");

  const filteredAgents = filterManagementItems(
    agents,
    listSearch,
    statusFilter,
    (agent) =>
      [
        agent.name,
        agent.context,
        agent.model,
        formatTransfer(agent, users, sectors),
      ].join(" "),
  );
  const filteredSectors = filterManagementItems(
    sectors,
    listSearch,
    statusFilter,
    (sector) => `${sector.name} ${sector.color}`,
  );
  const filteredTags = filterManagementItems(
    tags,
    listSearch,
    statusFilter,
    (tag) => `${tag.name} ${tag.color}`,
  );
  const tabs = [
    {
      id: "agents",
      label: "Agentes",
      description: "IA e roteamento",
      icon: Bot,
      total: agents.length,
      active: countActive(agents),
    },
    {
      id: "sectors",
      label: "Setores",
      description: "Filas operacionais",
      icon: UsersRound,
      total: sectors.length,
      active: countActive(sectors),
    },
    {
      id: "tags",
      label: "Tags",
      description: "Classificacao",
      icon: Tags,
      total: tags.length,
      active: countActive(tags),
    },
  ];

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setGeminiForm({
      geminiApiKey: "",
      automaticAttendance: Boolean(settings?.automaticAttendance),
    });
  }, [settings]);

  async function load() {
    try {
      const [agentData, sectorData, tagData] = await Promise.all([
        api("/api/ai-agents"),
        api("/api/sectors"),
        api("/api/support-tags"),
      ]);
      setAgents(agentData);
      setSectors(sectorData);
      setTags(tagData);
    } catch (error) {
      onError(error);
    }
  }

  async function saveGemini(event) {
    event.preventDefault();
    setSaving("gemini");
    try {
      const payload = { automaticAttendance: geminiForm.automaticAttendance };
      if (geminiForm.geminiApiKey)
        payload.geminiApiKey = geminiForm.geminiApiKey;
      const next = await api("/api/settings", { method: "PUT", body: payload });
      setSettings(next);
      setGeminiForm((current) => ({ ...current, geminiApiKey: "" }));
      showToast("Automacao atualizada");
    } catch (error) {
      onError(error);
    } finally {
      setSaving("");
    }
  }

  async function saveAgent(form) {
    setSaving("agent");
    try {
      const method = form.id ? "PATCH" : "POST";
      const path = form.id ? `/api/ai-agents/${form.id}` : "/api/ai-agents";
      await api(path, { method, body: form });
      setAgentModal(null);
      await load();
      showToast("Agente salvo");
    } catch (error) {
      onError(error);
    } finally {
      setSaving("");
    }
  }

  async function saveSector(form) {
    setSaving("sector");
    try {
      const method = form.id ? "PATCH" : "POST";
      const path = form.id ? `/api/sectors/${form.id}` : "/api/sectors";
      await api(path, { method, body: form });
      setSectorModal(null);
      await load();
      showToast("Setor salvo");
    } catch (error) {
      onError(error);
    } finally {
      setSaving("");
    }
  }

  async function saveTag(form) {
    setSaving("tag");
    try {
      const method = form.id ? "PATCH" : "POST";
      const path = form.id
        ? `/api/support-tags/${form.id}`
        : "/api/support-tags";
      await api(path, { method, body: form });
      setTagModal(null);
      await load();
      showToast("Tag salva");
    } catch (error) {
      onError(error);
    } finally {
      setSaving("");
    }
  }

  async function removeItem(kind, item) {
    if (!window.confirm(`Desativar ${item.name}?`)) return;
    try {
      await api(
        kind === "sector"
          ? `/api/sectors/${item.id}`
          : `/api/support-tags/${item.id}`,
        { method: "DELETE" },
      );
      await load();
      showToast(kind === "sector" ? "Setor desativado" : "Tag desativada");
    } catch (error) {
      onError(error);
    }
  }

  return (
    <Card as="section" variant="panel" className="single-panel agents-panel">
      <div className="panel-title agents-title">
        <Bot size={24} />
        <div>
          <span>Automacao</span>
          <h1>Agentes, setores e tags</h1>
          <p>Gerencie IA, filas e classificacoes sem sair do fluxo operacional.</p>
        </div>
      </div>

      <div className="agents-console">
        <div className="agents-console-summary">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <div key={tab.id} className="agents-summary-item">
                <Icon size={18} />
                <span>
                  <strong>{tab.total}</strong>
                  <small>{tab.label}</small>
                </span>
                <em>{tab.active} ativos</em>
              </div>
            );
          })}
        </div>

        <div className="agents-native-tabs" role="tablist" aria-label="Cadastros da automacao">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "agents"}
            className={activeTab === "agents" ? "agents-native-tab active" : "agents-native-tab"}
            onClick={() => {
              setActiveTab("agents");
              setListSearch("");
              setStatusFilter("all");
            }}
          >
            <Bot size={17} />
            <span>
              <strong>Agentes</strong>
              <small>IA de atendimento</small>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sectors"}
            className={activeTab === "sectors" ? "agents-native-tab active" : "agents-native-tab"}
            onClick={() => {
              setActiveTab("sectors");
              setListSearch("");
              setStatusFilter("all");
            }}
          >
            <UsersRound size={17} />
            <span>
              <strong>Setores</strong>
              <small>Filas e areas</small>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tags"}
            className={activeTab === "tags" ? "agents-native-tab active" : "agents-native-tab"}
            onClick={() => {
              setActiveTab("tags");
              setListSearch("");
              setStatusFilter("all");
            }}
          >
            <Tags size={17} />
            <span>
              <strong>Tags</strong>
              <small>Marcadores</small>
            </span>
          </button>
        </div>

        {activeTab === "agents" && (
          <section className="agents-tab-panel" role="tabpanel">
            <form className="agents-automation-card" onSubmit={saveGemini}>
              <div className="agents-automation-copy">
                <strong>Motor de atendimento</strong>
                <small>{settings?.hasGeminiApiKey ? "Chave Gemini configurada" : "Configure a chave Gemini para ativar a IA"}</small>
              </div>
              <Input
                label="Chave de API Gemini"
                type="password"
                value={geminiForm.geminiApiKey}
                placeholder={settings?.hasGeminiApiKey ? "Chave ja configurada" : "Cole a chave do Gemini"}
                onChange={(event) =>
                  setGeminiForm({
                    ...geminiForm,
                    geminiApiKey: event.target.value,
                  })
                }
              />
              <Switch
                label="Atendimento automatico"
                help="O primeiro agente ativo responde filas em espera."
                checked={geminiForm.automaticAttendance}
                onChange={(event) =>
                  setGeminiForm({
                    ...geminiForm,
                    automaticAttendance: event.target.checked,
                  })
                }
              />
              <Button variant="primary" disabled={saving === "gemini"}>
                {saving === "gemini" ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                Salvar
              </Button>
            </form>

            <ManagementHeader
              title="Agentes"
              count={filteredAgents.length}
              total={agents.length}
              actionLabel="Novo agente"
              onCreate={() => setAgentModal(emptyAgent)}
            />
            <ManagementToolbar
              search={listSearch}
              status={statusFilter}
              placeholder="Buscar por nome, contexto, modelo ou transferencia"
              onSearchChange={setListSearch}
              onStatusChange={setStatusFilter}
            />
            <AgentsTable
              agents={filteredAgents}
              users={users}
              sectors={sectors}
              onEdit={setAgentModal}
            />
          </section>
        )}

        {activeTab === "sectors" && (
          <section className="agents-tab-panel" role="tabpanel">
            <ManagementHeader
              title="Setores"
              count={filteredSectors.length}
              total={sectors.length}
              actionLabel="Novo setor"
              onCreate={() => setSectorModal(emptyTaxonomy)}
            />
            <ManagementToolbar
              search={listSearch}
              status={statusFilter}
              placeholder="Buscar setor ou cor"
              onSearchChange={setListSearch}
              onStatusChange={setStatusFilter}
            />
            <TaxonomyTable
              items={filteredSectors}
              empty="Nenhum setor cadastrado."
              onEdit={setSectorModal}
              onDelete={(item) => removeItem("sector", item)}
            />
          </section>
        )}

        {activeTab === "tags" && (
          <section className="agents-tab-panel" role="tabpanel">
            <ManagementHeader
              title="Tags"
              count={filteredTags.length}
              total={tags.length}
              actionLabel="Nova tag"
              onCreate={() => setTagModal(emptyTaxonomy)}
            />
            <ManagementToolbar
              search={listSearch}
              status={statusFilter}
              placeholder="Buscar tag ou cor"
              onSearchChange={setListSearch}
              onStatusChange={setStatusFilter}
            />
            <TaxonomyTable
              items={filteredTags}
              empty="Nenhuma tag cadastrada."
              onEdit={setTagModal}
              onDelete={(item) => removeItem("tag", item)}
            />
          </section>
        )}
      </div>
      {agentModal && (
        <AgentFormModal
          initialAgent={agentModal}
          users={users}
          sectors={sectors}
          saving={saving === "agent"}
          onClose={() => setAgentModal(null)}
          onSave={saveAgent}
        />
      )}
      {sectorModal && (
        <SectorFormModal
          initialItem={sectorModal}
          saving={saving === "sector"}
          onClose={() => setSectorModal(null)}
          onSave={saveSector}
        />
      )}
      {tagModal && (
        <TagFormModal
          initialItem={tagModal}
          saving={saving === "tag"}
          onClose={() => setTagModal(null)}
          onSave={saveTag}
        />
      )}
    </Card>
  );
}

function ManagementToolbar({
  search,
  status,
  placeholder,
  onSearchChange,
  onStatusChange,
}) {
  return (
    <div className="agents-management-toolbar">
      <SearchField
        value={search}
        placeholder={placeholder}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <Select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        className="agents-status-filter"
      >
        <option value="all">Todos</option>
        <option value="active">Ativos</option>
        <option value="inactive">Inativos</option>
      </Select>
    </div>
  );
}

function ManagementHeader({ title, count, total, actionLabel, onCreate }) {
  return (
    <div className="agents-management-header">
      <div>
        <strong>{title}</strong>
        <small>{count} de {total} registros</small>
      </div>
      <Button variant="primary" onClick={onCreate}>
        <Plus size={18} />
        {actionLabel}
      </Button>
    </div>
  );
}

function AgentsTable({ agents, users, sectors, onEdit }) {
  return (
    <div className="agents-table-wrap">
      <table className="agents-management-table">
        <thead>
          <tr>
            <th>Agente</th>
            <th>Status</th>
            <th>Modelo</th>
            <th>Temperatura</th>
            <th>Transferencia</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id}>
              <td data-label="Agente">
                <span className="agents-table-primary">
                  <strong>{agent.name}</strong>
                  <small>{agent.context || "Sem contexto definido"}</small>
                </span>
              </td>
              <td data-label="Status">
                <Badge tone={agent.active ? "active" : "inactive"}>
                  {agent.active ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td data-label="Modelo">{agent.model}</td>
              <td data-label="Temperatura">{agent.temperature}</td>
              <td data-label="Transferencia">{formatTransfer(agent, users, sectors)}</td>
              <td data-label="Acoes">
                <div className="agents-row-actions">
                  <Button compact onClick={() => onEdit(agent)}>
                    <Edit3 size={16} />
                    Editar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!agents.length && <p className="empty">Nenhum agente criado ainda.</p>}
    </div>
  );
}

function TaxonomyTable({ items, empty, onEdit, onDelete }) {
  return (
    <div className="agents-table-wrap">
      <table className="agents-management-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th>Cor</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Nome">
                <span className="agents-table-primary">
                  <strong>{item.name}</strong>
                  <small>Cadastro operacional</small>
                </span>
              </td>
              <td data-label="Status">
                <Badge tone={item.active ? "active" : "inactive"}>
                  {item.active ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td data-label="Cor">
                <span className="tag-pill" data-color={item.color}>
                  {item.color}
                </span>
              </td>
              <td data-label="Acoes">
                <div className="agents-row-actions">
                  <Button compact onClick={() => onEdit(item)}>
                    <Edit3 size={16} />
                    Editar
                  </Button>
                  <Button compact danger onClick={() => onDelete(item)} disabled={!item.active}>
                    <Trash2 size={16} />
                    Desativar
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <p className="empty">{empty}</p>}
    </div>
  );
}

function AgentFormModal({
  initialAgent,
  users,
  sectors,
  saving,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(initialAgent || emptyAgent);

  return (
    <Modal
      title={form.id ? "Editar agente" : "Novo agente"}
      description="Configure contexto, regras e destino de transferencia."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" form="agent-form" disabled={saving}>
            {saving ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="agent-form"
        className="stacked-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <Input
          label="Nome"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <div className="form-inline">
          <Input
            label="Modelo"
            value={form.model}
            onChange={(event) =>
              setForm({ ...form, model: event.target.value })
            }
          />
          <Input
            label="Temperatura"
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={form.temperature}
            onChange={(event) =>
              setForm({ ...form, temperature: event.target.value })
            }
          />
        </div>
        <Select
          label="Transferir para"
          value={form.transferMode}
          onChange={(event) =>
            setForm({ ...form, transferMode: event.target.value })
          }
        >
          <option value="none">Sem transferencia padrao</option>
          <option value="user">Usuario</option>
          <option value="sector">Setor</option>
        </Select>
        {form.transferMode === "user" && (
          <Select
            label="Usuario destino"
            value={form.transferUserId}
            onChange={(event) =>
              setForm({ ...form, transferUserId: event.target.value })
            }
          >
            <option value="">Selecione</option>
            {users
              .filter((user) => user.active)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </Select>
        )}
        {form.transferMode === "sector" && (
          <Select
            label="Setor destino"
            value={form.transferSectorId}
            onChange={(event) =>
              setForm({ ...form, transferSectorId: event.target.value })
            }
          >
            <option value="">Selecione</option>
            {sectors
              .filter((sector) => sector.active)
              .map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
          </Select>
        )}
        <Textarea
          label="Contexto"
          value={form.context}
          onChange={(event) =>
            setForm({ ...form, context: event.target.value })
          }
        />
        <Textarea
          label="Regras"
          value={form.rules}
          onChange={(event) => setForm({ ...form, rules: event.target.value })}
        />
        <Textarea
          label="Comportamento"
          value={form.behavior}
          onChange={(event) =>
            setForm({ ...form, behavior: event.target.value })
          }
        />
        <Checkbox
          label="Agente ativo"
          checked={form.active}
          onChange={(event) =>
            setForm({ ...form, active: event.target.checked })
          }
        />
      </form>
    </Modal>
  );
}

function SectorFormModal(props) {
  return (
    <TaxonomyFormModal
      {...props}
      kind="sector"
      title={props.initialItem?.id ? "Editar setor" : "Novo setor"}
    />
  );
}

function TagFormModal(props) {
  return (
    <TaxonomyFormModal
      {...props}
      kind="tag"
      title={props.initialItem?.id ? "Editar tag" : "Nova tag"}
    />
  );
}

function TaxonomyFormModal({ initialItem, title, saving, onClose, onSave }) {
  const [form, setForm] = useState(initialItem || emptyTaxonomy);
  return (
    <Modal
      title={title}
      description="Defina nome, cor e disponibilidade para a operacao."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" form="taxonomy-form" disabled={saving}>
            {saving ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            Salvar
          </Button>
        </>
      }
    >
      <form
        id="taxonomy-form"
        className="stacked-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <Input
          label="Nome"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          required
        />
        <Select
          label="Cor"
          value={form.color}
          onChange={(event) => setForm({ ...form, color: event.target.value })}
        >
          {colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </Select>
        <Switch
          label="Ativo"
          checked={form.active}
          onChange={(event) =>
            setForm({ ...form, active: event.target.checked })
          }
        />
      </form>
    </Modal>
  );
}

function formatTransfer(agent, users, sectors) {
  if (agent.transferMode === "user")
    return (
      users.find((user) => user.id === agent.transferUserId)?.name || "Usuario"
    );
  if (agent.transferMode === "sector")
    return (
      sectors.find((sector) => sector.id === agent.transferSectorId)?.name ||
      "Setor"
    );
  return "Sem padrao";
}

function filterManagementItems(items, search, status, getText) {
  const normalizedSearch = search.trim().toLowerCase();
  return items.filter((item) => {
    if (status === "active" && !item.active) return false;
    if (status === "inactive" && item.active) return false;
    if (!normalizedSearch) return true;
    return getText(item).toLowerCase().includes(normalizedSearch);
  });
}

function countActive(items) {
  return items.filter((item) => item.active).length;
}
