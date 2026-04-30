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
  Select,
  Switch,
  Textarea,
} from "../components/ui/index.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/shadcn/tabs.jsx";

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
  const [saving, setSaving] = useState("");

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
      <div className="panel-title">
        <Bot size={24} />
        <div>
          <span>Automacao</span>
          <h1>Agentes, setores e tags</h1>
          <p>Gerencie IA e classificacoes da operacao em uma tela unica.</p>
        </div>
      </div>

      <div>
        <Tabs defaultValue="agents" className="agents-tabs p-4">
          <TabsList className="agents-tabs-list">
            <TabsTrigger value="agents">Agentes</TabsTrigger>
            <TabsTrigger value="sectors">Setores</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="agents-tab-content">
            <form className="automation-strip" onSubmit={saveGemini}>
              <Input
                label="Chave de API Gemini"
                type="password"
                value={geminiForm.geminiApiKey}
                placeholder={
                  settings?.hasGeminiApiKey
                    ? "Chave ja configurada"
                    : "Cole a chave do Gemini"
                }
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
                {saving === "gemini" ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                Salvar
              </Button>
            </form>

            <div className="table-section-heading">
              <div>
                <strong>Agentes</strong>
                <small>{agents.length} cadastrados</small>
              </div>
              <Button
                variant="primary"
                onClick={() => setAgentModal(emptyAgent)}
              >
                <Plus size={18} />
                Novo agente
              </Button>
            </div>

            <div className="agent-list">
              {agents.map((agent) => (
                <article key={agent.id} className="agent-row">
                  <div className="agent-row-main">
                    <strong>{agent.name}</strong>
                    <small>{agent.context || "Sem contexto definido"}</small>
                  </div>
                  <div className="agent-meta-grid">
                    <span>
                      <strong>Modelo</strong>
                      {agent.model}
                    </span>
                    <span>
                      <strong>Temperatura</strong>
                      {agent.temperature}
                    </span>
                    <span>
                      <strong>Transferencia</strong>
                      {formatTransfer(agent, users, sectors)}
                    </span>
                  </div>
                  <Badge tone={agent.active ? "active" : "inactive"}>
                    {agent.active ? "Ativo" : "Inativo"}
                  </Badge>
                  <div className="row-actions">
                    <Button compact onClick={() => setAgentModal(agent)}>
                      <Edit3 size={16} />
                      Editar
                    </Button>
                  </div>
                </article>
              ))}
              {!agents.length && (
                <p className="empty">Nenhum agente criado ainda.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sectors" className="agents-tab-content">
            <TaxonomyHeader
              icon={UsersRound}
              title="Setores"
              count={sectors.length}
              onCreate={() => setSectorModal(emptyTaxonomy)}
            />
            <TaxonomyList
              items={sectors}
              onEdit={setSectorModal}
              onDelete={(item) => removeItem("sector", item)}
              empty="Nenhum setor cadastrado."
            />
          </TabsContent>

          <TabsContent value="tags" className="agents-tab-content">
            <TaxonomyHeader
              icon={Tags}
              title="Tags"
              count={tags.length}
              onCreate={() => setTagModal(emptyTaxonomy)}
            />
            <TaxonomyList
              items={tags}
              onEdit={setTagModal}
              onDelete={(item) => removeItem("tag", item)}
              empty="Nenhuma tag cadastrada."
            />
          </TabsContent>
        </Tabs>
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

function TaxonomyHeader({ icon: Icon, title, count, onCreate }) {
  return (
    <div className="table-section-heading">
      <div>
        <Icon size={18} />
        <strong>{title}</strong>
        <small>{count} cadastrados</small>
      </div>
      <Button variant="primary" onClick={onCreate}>
        <Plus size={18} />
        Novo
      </Button>
    </div>
  );
}

function TaxonomyList({ items, onEdit, onDelete, empty }) {
  return (
    <div className="taxonomy-list">
      {items.map((item) => (
        <article key={item.id} className="taxonomy-row">
          <span className="tag-pill" data-color={item.color}>
            {item.name}
          </span>
          <Badge tone={item.active ? "active" : "inactive"}>
            {item.active ? "Ativo" : "Inativo"}
          </Badge>
          <div className="row-actions">
            <Button compact onClick={() => onEdit(item)}>
              <Edit3 size={16} />
              Editar
            </Button>
            <Button
              compact
              danger
              onClick={() => onDelete(item)}
              disabled={!item.active}
            >
              <Trash2 size={16} />
              Desativar
            </Button>
          </div>
        </article>
      ))}
      {!items.length && <p className="empty">{empty}</p>}
    </div>
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
