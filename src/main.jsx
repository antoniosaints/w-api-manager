import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  CircleDot,
  Clock3,
  CornerUpLeft,
  History,
  Loader2,
  MessageCircle,
  Mic,
  Navigation,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  Square,
  Tags,
  Trash2,
  UserPlus,
  UserCheck,
  Users,
  X,
  MessageSquareShareIcon
} from 'lucide-react';
import './styles.css';
import { API, api } from './shared/api.js';
import { eventToRow, formatTime, getSystemTheme, initials, isConnected, isPlaceholderBody } from './shared/format.js';
import { buildSupportCountByContact, filterSessionsByPeriod, periodToQuery } from './shared/support.js';
import { Sidebar, Header, MobileNav } from './components/AppShell.jsx';
import {
  MediaModal as ChatMediaModal,
  MessageBubble as ChatMessageBubble
} from './components/chat/MessageBubble.jsx';
import { ChatWindow as ChatWindowPanel } from './components/chat/ChatWindow.jsx';
import { Card, SearchField, Select } from './components/ui/index.js';
import { LoginScreen } from './pages/LoginScreen.jsx';
import { UsersPanel } from './pages/UsersPanel.jsx';
import { ContactsPanel, ContactModal } from './pages/ContactsPanel.jsx';
import { SendPanel } from './pages/SendPanel.jsx';
import { ConnectionPanel } from './pages/ConnectionPanel.jsx';
import { WebhookPanel } from './pages/WebhookPanel.jsx';
import { SettingsPanel } from './pages/SettingsPanel.jsx';
import { AgentsPanel } from './pages/AgentsPanel.jsx';
import { useLaunchRouteSelection, usePushSync, useUnreadAppBadge, readLaunchRoute } from './app/runtime-effects.js';
import { useUserPreferenceActions } from './app/user-preferences.js';
import { mergeMessageUpdate } from './app/messages.js';
import { getMessageMedia } from './media.js';
import { MEDIA_FILE_ACCEPT, formatBytes, prepareMediaFile, validateMediaFile } from './media-config.js';
import { registerAppServiceWorker } from './pwa.js';
import {
  getNextThemePreference,
  resolveThemePreference,
  sanitizeThemePreference,
  THEME_STORAGE_KEY
} from './theme.js';

const socket = io(API, { transports: ['websocket', 'polling'], withCredentials: true, autoConnect: false });

const conversationTabs = [
  ['waiting', 'Espera'],
  ['active', 'Ativos'],
  ['finished', 'Finalizados'],
  ['groups', 'Grupos']
];

function App() {
  const [view, setView] = useState('dashboard');
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [themePreference, setThemePreference] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return sanitizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  });
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [supportTags, setSupportTags] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [contactDraft, setContactDraft] = useState(null);
  const [sendContact, setSendContact] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('wapi-sidebar-collapsed') === 'true';
  });
  const messagesRequestRef = useRef(0);
  const launchRouteRef = useRef(readLaunchRoute());

  const selectedConversation = conversations.find((item) => item.id === selectedConversationId);
  const selectedPhone = selectedConversation?.phone || '';
  const resolvedTheme = resolveThemePreference(themePreference, systemTheme);
  const connected = isConnected(status);
  const {
    updateAccentColor,
    updateUserPreferences,
    togglePushNotifications
  } = useUserPreferenceActions({ setCurrentUser, showToast, handleError });

  useEffect(() => {
    checkAuth();
    registerAppServiceWorker().catch(() => null);
  }, []);

  useEffect(() => {
    if (currentUser) loadInitial();
  }, [currentUser?.id]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemTheme(media.matches ? 'dark' : 'light');
    updateSystemTheme();
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.accent = currentUser?.themeColor || 'green';
    document.documentElement.style.colorScheme = resolvedTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference, currentUser?.themeColor]);

  useEffect(() => {
    window.localStorage.setItem('wapi-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  usePushSync(currentUser);
  useUnreadAppBadge({ currentUser, conversations });
  useLaunchRouteSelection({
    launchRouteRef,
    currentUser,
    conversations,
    setView,
    setSelectedConversationId
  });

  useEffect(() => {
    if (!currentUser) return;
    socket.connect();
    socket.on('message:new', (message) => {
      if (message.sessionId === selectedConversationId) {
        setMessages((current) => mergeMessageUpdate(current, message));
        markConversationRead(message.sessionId);
      }
      showToast('Nova mensagem sincronizada');
    });

    socket.on('conversations:update', setConversations);
    socket.on('webhook:event', (event) => {
      setEvents((current) => [eventToRow(event), ...current].slice(0, 80));
    });

    return () => {
      socket.off('message:new');
      socket.off('conversations:update');
      socket.off('webhook:event');
      socket.disconnect();
    };
  }, [currentUser, selectedConversationId]);

  useEffect(() => {
    const requestId = messagesRequestRef.current + 1;
    messagesRequestRef.current = requestId;

    if (!currentUser || !selectedConversationId) {
      setMessages([]);
      setChatLoading(false);
      return;
    }

    setChatLoading(true);
    setMessages([]);
    api(`/api/support-sessions/${selectedConversationId}/messages`)
      .then((data) => {
        if (messagesRequestRef.current === requestId) setMessages(data);
      })
      .catch((error) => {
        if (messagesRequestRef.current === requestId) handleError(error);
      })
      .finally(() => {
        if (messagesRequestRef.current === requestId) setChatLoading(false);
      });
  }, [currentUser, selectedConversationId]);

  useEffect(() => {
    if (!currentUser || !selectedConversationId || !selectedConversation?.unreadCount) return;
    markConversationRead(selectedConversationId);
  }, [currentUser, selectedConversationId, selectedConversation?.unreadCount]);

  async function checkAuth() {
    try {
      const data = await api('/api/auth/me');
      setCurrentUser(data.user);
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthReady(true);
    }
  }

  async function login(credentials) {
    const data = await api('/api/auth/login', { method: 'POST', body: credentials });
    setCurrentUser(data.user);
    setView('dashboard');
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
    socket.disconnect();
    setCurrentUser(null);
    setConversations([]);
    setMessages([]);
    setUsers([]);
  }

  async function loadInitial() {
    try {
      const [settingsData, conversationData, eventData, userData, sectorData, tagData] = await Promise.all([
        api('/api/settings'),
        api('/api/conversations'),
        api('/api/webhook-events'),
        api('/api/users'),
        api('/api/sectors'),
        api('/api/support-tags')
      ]);
      setSettings(settingsData);
      setConversations(conversationData);
      setEvents(eventData);
      setUsers(userData);
      setSectors(sectorData);
      setSupportTags(tagData);
    } catch (error) {
      handleError(error);
    }
  }

  async function refreshStatus() {
    setLoading(true);
    try {
      const data = await api('/api/wapi/status');
      setStatus(data);
      showToast('Status atualizado');
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshConversations(preferredSessionId = selectedConversationId) {
    const data = await api('/api/conversations');
    setConversations(data);
    if (preferredSessionId && data.some((item) => item.id === preferredSessionId)) {
      setSelectedConversationId(preferredSessionId);
    } else {
      setSelectedConversationId('');
      setMessages([]);
    }
    return data;
  }

  async function markConversationRead(sessionId) {
    if (!sessionId) return null;
    setConversations((current) =>
      current.map((item) => (item.id === sessionId ? { ...item, unreadCount: 0 } : item))
    );
    try {
      const result = await api(`/api/support-sessions/${sessionId}/read`, { method: 'PATCH' });
      if (result?.conversation) {
        setConversations((current) =>
          current.map((item) => (item.id === result.conversation.id ? result.conversation : item))
        );
      }
      return result?.conversation || null;
    } catch (error) {
      handleError(error);
      return null;
    }
  }

  async function refreshUsers() {
    const data = await api('/api/users');
    setUsers(data);
    return data;
  }

  async function refreshSectorsAndTags() {
    const [sectorData, tagData] = await Promise.all([api('/api/sectors'), api('/api/support-tags')]);
    setSectors(sectorData);
    setSupportTags(tagData);
  }

  async function changeConversationStatus(sessionId, status) {
    try {
      await api(`/api/support-sessions/${sessionId}/status`, {
        method: 'PATCH',
        body: { status }
      });
      await refreshConversations(sessionId);
      showToast(status === 'active' ? 'Contato em atendimento' : 'Chat finalizado');
    } catch (error) {
      handleError(error);
    }
  }

  async function reopenConversation(sessionId) {
    try {
      const result = await api(`/api/support-sessions/${sessionId}/reopen`, { method: 'POST' });
      await refreshConversations(result.conversation.id);
      showToast('Atendimento reaberto');
    } catch (error) {
      handleError(error);
    }
  }

  async function transferSupportSession(sessionId, target) {
    try {
      const payload = typeof target === 'string'
        ? target.startsWith('sector:')
          ? { targetSectorId: target.replace('sector:', '') }
          : { targetUserId: target.replace('user:', '') }
        : target;
      await api(`/api/support-sessions/${sessionId}/transfer`, {
        method: 'POST',
        body: payload
      });
      await refreshConversations(sessionId);
      const updatedMessages = await api(`/api/support-sessions/${sessionId}/messages`);
      setMessages(updatedMessages);
      showToast('Atendimento transferido');
    } catch (error) {
      handleError(error);
    }
  }

  async function updateConversationTags(sessionId, tagIds) {
    try {
      await api(`/api/support-sessions/${sessionId}/tags`, { method: 'PATCH', body: { tagIds } });
      await refreshConversations(sessionId);
      showToast('Tags atualizadas');
    } catch (error) {
      handleError(error);
    }
  }

  async function updateConversationSector(sessionId, sectorId) {
    try {
      await api(`/api/support-sessions/${sessionId}/sector`, { method: 'PATCH', body: { sectorId } });
      await refreshConversations(sessionId);
      showToast('Setor atualizado');
    } catch (error) {
      handleError(error);
    }
  }

  async function removeConversation(sessionId) {
    if (typeof window !== 'undefined' && !window.confirm('Apagar esta sessao e suas mensagens?')) return;

    try {
      await api(`/api/support-sessions/${sessionId}`, { method: 'DELETE' });
      const data = await refreshConversations('');
      if (!data.some((item) => item.id === sessionId)) setMessages([]);
      showToast('Sessao apagada');
    } catch (error) {
      handleError(error);
    }
  }

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(''), 3200);
  }

  function handleError(error) {
    showToast(error.message || 'Algo saiu do trilho');
  }

  if (!authReady) {
    return (
      <div className="auth-page">
        <Loader2 className="spin" size={28} />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className={sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <Sidebar
        view={view}
        setView={setView}
        settings={settings}
        currentUser={currentUser}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
      />

      <div className={sidebarCollapsed ? 'main-shell sidebar-is-collapsed' : 'main-shell'}>
        <Header
          view={view}
          status={status}
          connected={connected}
          loading={loading}
          themePreference={themePreference}
          resolvedTheme={resolvedTheme}
          accentColor={currentUser?.themeColor || 'green'}
          pushEnabled={Boolean(currentUser?.pushEnabled)}
          currentUser={currentUser}
          onRefreshStatus={refreshStatus}
          onCycleTheme={() => setThemePreference((current) => getNextThemePreference(current))}
          onAccentChange={updateAccentColor}
          onTogglePushNotifications={togglePushNotifications}
          onPreferenceChange={updateUserPreferences}
          onLogout={logout}
        />

        <main className="workspace">
          <div className="view-stage">
            {view === 'dashboard' && (
              <DashboardPanel
                conversations={conversations}
                events={events}
                connected={connected}
                settings={settings}
              />
            )}

            {view === 'users' && currentUser.role === 'admin' && (
              <UsersPanel
                users={users}
                sectors={sectors}
                onRefresh={refreshUsers}
                onDeleteUser={refreshUsers}
                onError={handleError}
                showToast={showToast}
                currentUser={currentUser}
              />
            )}

            {view === 'agents' && currentUser.role === 'admin' && (
              <AgentsPanel
                settings={settings}
                setSettings={setSettings}
                users={users}
                onError={handleError}
                showToast={(message) => {
                  showToast(message);
                  refreshSectorsAndTags().catch(handleError);
                }}
              />
            )}

            {view === 'inbox' && (
              <Inbox
                conversations={conversations}
                selectedConversationId={selectedConversationId}
                setSelectedConversationId={setSelectedConversationId}
                selectedConversation={selectedConversation}
                messages={messages}
                loadingMessages={chatLoading}
                onOpenMedia={setMediaPreview}
                onAttend={(sessionId) => changeConversationStatus(sessionId, 'active')}
                onReopen={reopenConversation}
                onFinish={(sessionId) => changeConversationStatus(sessionId, 'finished')}
                onDelete={removeConversation}
                onTransfer={transferSupportSession}
                onTagsChange={updateConversationTags}
                onSectorChange={updateConversationSector}
                onSaveContact={(contact) => setContactDraft(contact)}
                users={users}
                sectors={sectors}
                supportTags={supportTags}
                currentUser={currentUser}
                onSent={(message) => {
                  setMessages((current) => mergeMessageUpdate(current, message));
                  refreshConversations(message.sessionId).catch(handleError);
                }}
                onError={handleError}
              />
            )}

            {view === 'contacts' && (
              <ContactsPanel
                onError={handleError}
                showToast={showToast}
                onDeleteContact={() => refreshConversations('').catch(handleError)}
                onSendToContact={(contact) => {
                  setSendContact(contact);
                  setView('send');
                }}
              />
            )}

            {view === 'history' && (
              <HistoryPanel
                conversations={conversations}
                onOpenMedia={setMediaPreview}
                onError={handleError}
              />
            )}

            {view === 'send' && (
              <SendPanel
                initialContact={sendContact}
                onSent={(message) => {
                  showToast('Mensagem enviada');
                  setSelectedConversationId(message.sessionId);
                  setSendContact(null);
                  setView('inbox');
                }}
                onError={handleError}
              />
            )}

            {view === 'connection' && currentUser.role === 'admin' && (
              <ConnectionPanel
                settings={settings}
                status={status}
                setStatus={setStatus}
                onError={handleError}
                showToast={showToast}
              />
            )}

            {view === 'webhooks' && currentUser.role === 'admin' && (
              <WebhookPanel
                settings={settings}
                setSettings={setSettings}
                events={events}
                onError={handleError}
                showToast={showToast}
              />
            )}

            {view === 'settings' && currentUser.role === 'admin' && (
              <SettingsPanel
                settings={settings}
                setSettings={setSettings}
                currentUser={currentUser}
                onError={handleError}
                showToast={showToast}
              />
            )}
          </div>
        </main>
      </div>

      <MobileNav view={view} setView={setView} currentUser={currentUser} />

      {mediaPreview && <ChatMediaModal media={mediaPreview} onClose={() => setMediaPreview(null)} />}
      {contactDraft && (
        <ContactModal
          initialContact={contactDraft}
          onClose={() => setContactDraft(null)}
          onSaved={() => showToast('Contato salvo')}
          onError={handleError}
          showToast={showToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function DashboardPanel({ connected, settings }) {
  const [periodFilter, setPeriodFilter] = useState('30');
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    const query = periodToQuery(periodFilter);
    api(`/api/dashboard${query}`).then(setDashboard).catch(() => setDashboard(null));
  }, [periodFilter]);

  const summary = dashboard?.summary || {};
  const status = dashboard?.status || {};
  const cards = [
    { key: 'total', icon: MessageCircle, label: 'Atendimentos', value: summary.total || 0, note: `${summary.unread || 0} nao lidas` },
    { key: 'waiting', icon: BellRing, label: 'Em espera', value: status.waiting || 0, note: 'fila atual' },
    { key: 'active', icon: Activity, label: 'Ativos', value: status.active || 0, note: 'em atendimento' },
    { key: 'finished', icon: CheckCircle2, label: 'Finalizados', value: status.finished || 0, note: 'no periodo' },
    { key: 'response', icon: Clock3, label: '1a resposta', value: `${summary.averageFirstResponseMinutes || 0} min`, note: 'media operacional' },
    { key: 'close', icon: CircleDot, label: 'Fechamento', value: `${summary.averageCloseMinutes || 0} min`, note: 'tempo medio' }
  ];

  return (
    <section className="dashboard-layout">
      <div className="dashboard-toolbar">
        <Select className="toolbar-select" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
          <option value="7">Ultimos 7 dias</option>
          <option value="30">Ultimos 30 dias</option>
          <option value="90">Ultimos 90 dias</option>
          <option value="all">Todo historico</option>
        </Select>
        <span className={connected ? 'status-pill connected' : 'status-pill'}>
          <CircleDot size={15} />
          {connected ? 'Instancia online' : settings?.instanceId || 'Instancia a verificar'}
        </span>
      </div>

      <div className="summary-strip" aria-label="Resumo operacional">
        {cards.map((card) => (
          <SummaryCard
            key={card.key}
            icon={card.icon}
            label={card.label}
            value={card.value}
            note={card.note}
          />
        ))}
      </div>

      <div className="dashboard-grid">
        <Card as="section" variant="panel" className="single-panel dashboard-panel">
          <div className="panel-title compact">
            <BarChart3 size={22} />
            <div>
              <span>Contatos</span>
              <h1>Top suportes por contato</h1>
              <p>Quem mais acionou o atendimento no periodo.</p>
            </div>
          </div>
          <div className="insight-list">
            {(dashboard?.byContact || []).map((item) => (
              <Card as="article" variant="row" key={item.phone}>
                <ContactAvatar contact={item} />
                <div>
                  <strong>{item.name || item.phone}</strong>
                  <small>{item.finished} finalizados · {item.active} ativos</small>
                </div>
                <span className="badge neutral-badge">{item.count}</span>
              </Card>
            ))}
            {!dashboard?.byContact?.length && <p className="empty">Nenhum atendimento no periodo.</p>}
          </div>
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel">
          <div className="panel-title compact">
            <Users size={22} />
            <div>
              <span>Equipe</span>
              <h1>Suportes por usuario</h1>
              <p>Responsaveis, carga atual e finalizacoes.</p>
            </div>
          </div>
          <div className="insight-list">
            {(dashboard?.byUser || []).map((item) => (
              <Card as="article" variant="row" key={item.userId || item.name}>
                <span className="avatar fallback">{initials(item.name)}</span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.active} ativos · {item.finished} finalizados</small>
                </div>
                <span className="badge neutral-badge">{item.total}</span>
              </Card>
            ))}
            {!dashboard?.byUser?.length && <p className="empty">Nenhum usuario com suporte no periodo.</p>}
          </div>
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel">
          <div className="panel-title compact">
            <Activity size={22} />
            <div>
              <span>Carga</span>
              <h1>Carga atual</h1>
              <p>Atendimentos abertos por responsavel.</p>
            </div>
          </div>
          <div className="insight-list">
            {(dashboard?.currentLoad || []).map((item) => (
              <Card as="article" variant="row" key={item.userId || item.name}>
                <span className="avatar fallback">{initials(item.name)}</span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.waiting} em espera</small>
                </div>
                <span className="badge">{item.active}</span>
              </Card>
            ))}
            {!dashboard?.currentLoad?.length && <p className="empty">Sem carga operacional.</p>}
          </div>
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel">
          <div className="panel-title compact">
            <Clock3 size={22} />
            <div>
              <span>Webhooks</span>
              <h1>Eventos recentes</h1>
              <p>Eventos e transferencias recentes.</p>
            </div>
          </div>
          <div className="insight-list events-compact">
            {(dashboard?.recentTransfers || []).map((event) => (
              <Card as="article" variant="row" key={event.id}>
                <span className="event-dot" />
                <div>
                  <strong>{event.body}</strong>
                  <small>{formatTime(event.createdAt)}</small>
                </div>
              </Card>
            ))}
            {(dashboard?.recentEvents || []).slice(0, 5).map((event) => (
              <Card as="article" variant="row" key={event.id || `${event.eventType}-${event.createdAt}`}>
                <span className="event-dot" />
                <div>
                  <strong>{event.eventType}</strong>
                  <small>{formatTime(event.createdAt)}</small>
                </div>
              </Card>
            ))}
            {!dashboard?.recentEvents?.length && !dashboard?.recentTransfers?.length && <p className="empty">Nenhum evento recebido ainda.</p>}
          </div>
        </Card>
      </div>
    </section>
  );
}

function HistoryPanel({ conversations, onOpenMedia, onError }) {
  const [periodFilter, setPeriodFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedHistoryId, setSelectedHistoryId] = useState(conversations[0]?.id || '');
  const [historyMessages, setHistoryMessages] = useState([]);
  const filtered = filterSessionsByPeriod(conversations, periodFilter).filter((item) => {
    const haystack = `${item.name} ${item.phone} ${item.lastMessage?.body || ''}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const selected = filtered.find((item) => item.id === selectedHistoryId) || filtered[0] || null;

  useEffect(() => {
    if (!selected?.id) {
      setHistoryMessages([]);
      return;
    }
    setSelectedHistoryId(selected.id);
    api(`/api/support-sessions/${selected.id}/messages`).then(setHistoryMessages).catch(onError);
  }, [selected?.id]);

  return (
    <section className="history-layout">
      <Card as="aside" variant="panel" className="single-panel history-list-panel">
        <div className="panel-title compact">
          <History size={22} />
          <div>
            <span>Historico</span>
            <h1>Atendimentos</h1>
            <p>Consulta geral de todas as sessoes.</p>
          </div>
        </div>
        <div className="history-filters">
          <SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar historico" />
          <Select className="toolbar-select" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
            <option value="7">Ultimos 7 dias</option>
            <option value="30">Ultimos 30 dias</option>
            <option value="90">Ultimos 90 dias</option>
            <option value="all">Todo historico</option>
          </Select>
        </div>
        <div className="conversation-items history-items">
          {filtered.map((item) => (
            <button
              key={item.id}
              className={item.id === selected?.id ? 'conversation selected' : 'conversation'}
              onClick={() => setSelectedHistoryId(item.id)}
            >
              <ContactAvatar contact={item} />
              <span className="conversation-copy">
                <strong>{item.name || item.phone}</strong>
                <small>{getConversationStatusLabel(item.chatStatus)} · {item.messageCount || 0} mensagens</small>
              </span>
              <span className="conversation-meta">
                {item.startedAt && <small>{formatTime(item.startedAt)}</small>}
                <span className="session-chip">#{String(item.supportCount || 1).padStart(2, '0')}</span>
              </span>
            </button>
          ))}
          {!filtered.length && <p className="empty">Nenhum historico encontrado.</p>}
        </div>
      </Card>

      <section className="chat-panel">
        {selected ? (
          <>
            <div className="chat-header">
              <ContactAvatar contact={selected} fallback={selected.phone} large />
              <div className="chat-title-copy">
                <strong>{selected.name || selected.phone}</strong>
                <small>{selected.phone} · {getConversationStatusLabel(selected.chatStatus)}</small>
              </div>
              <span className="chat-chip">{historyMessages.length} mensagens</span>
            </div>
            <div className="message-stream">
              {historyMessages.map((message) => (
                <ChatMessageBubble
                  key={message.id}
                  message={message}
                  onOpenMedia={onOpenMedia}
                  showSenderName={Boolean(selected?.isGroup)}
                />
              ))}
              {!historyMessages.length && <p className="empty stream-empty">Sessao sem mensagens.</p>}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <History size={42} />
            <h1>Historico de atendimentos</h1>
            <p>Selecione uma sessao para consultar as mensagens.</p>
          </div>
        )}
      </section>
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value, note }) {
  return (
    <Card variant="metric" className="summary-card">
      <span>
        <Icon size={18} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{note}</em>
      </div>
    </Card>
  );
}

function ContactAvatar({ contact, fallback = '', large = false }) {
  const label = contact?.name || fallback || contact?.phone || '?';
  const avatarUrl = contact?.avatarUrl;

  return (
    <span className={large ? 'avatar large' : 'avatar'} aria-label={label} title={label}>
      {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initials(label)}
    </span>
  );
}

function Inbox({
  conversations,
  selectedConversationId,
  setSelectedConversationId,
  selectedConversation,
  messages,
  loadingMessages,
  onOpenMedia,
  onAttend,
  onReopen,
  onFinish,
  onDelete,
  onTransfer,
  onTagsChange,
  onSectorChange,
  onSaveContact,
  users,
  sectors = [],
  supportTags = [],
  currentUser,
  onSent,
  onError
}) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('waiting');
  const filtered = conversations.filter((item) => {
    const haystack = `${item.name} ${item.phone} ${item.lastMessage?.body || ''}`.toLowerCase();
    return conversationMatchesTab(item, activeTab) && haystack.includes(query.toLowerCase());
  });
  const counts = conversationTabs.reduce((acc, [status]) => {
    acc[status] = conversations.filter((item) => conversationMatchesTab(item, status)).length;
    return acc;
  }, {});

  useEffect(() => {
    if (selectedConversation?.isGroup && activeTab !== 'groups') {
      setActiveTab('groups');
      return;
    }
    if (selectedConversation && !selectedConversation.isGroup && (selectedConversation.chatStatus || 'waiting') !== activeTab) {
      setActiveTab(selectedConversation.chatStatus || 'waiting');
    }
  }, [activeTab, selectedConversation]);

  return (
    <section className="inbox-layout">
      <aside className="conversation-list">
        {/* <div className="section-heading">
          <div>
            <span>Fila de atendimento</span>
            <strong>{filtered.length} de {counts[activeTab] || 0} conversas</strong>
          </div>
          <BellRing size={20} />
        </div> */}

        <div className="conversation-tabs" role="tablist" aria-label="Status das conversas">
          {conversationTabs.map(([status, label]) => (
            <button
              key={status}
              type="button"
              className={activeTab === status ? 'active' : ''}
              onClick={() => {
                setActiveTab(status);
                setSelectedConversationId('');
              }}
            >
              <span>{label}</span>
              <strong>{counts[status] || 0}</strong>
            </button>
          ))}
        </div>

        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contato" />
        </label>

        <div className="conversation-items">
          {filtered.map((item) => (
            <button
              key={item.id}
              className={item.id === selectedConversationId ? 'conversation selected' : 'conversation'}
              onClick={() => setSelectedConversationId(item.id)}
            >
              <ContactAvatar contact={item} />
              <span className="conversation-copy">
                <strong>{item.name || item.phone}</strong>
                <small>{item.lastMessage?.body || item.phone}</small>
                <ConversationTags conversation={item} />
              </span>
              <span className="conversation-meta">
                {item.lastMessage?.createdAt && <small>{formatTime(item.lastMessage.createdAt)}</small>}
                {item.unreadCount > 0 && <span className="badge">{item.unreadCount}</span>}
              </span>
            </button>
          ))}
          {!filtered.length && <p className="empty">{getEmptyTabCopy(activeTab)}</p>}
        </div>
      </aside>

      <ChatWindowPanel
        selectedConversation={selectedConversation}
        messages={messages}
        loadingMessages={loadingMessages}
        onOpenMedia={onOpenMedia}
        onAttend={onAttend}
        onReopen={onReopen}
        onFinish={onFinish}
        onDelete={onDelete}
        onTransfer={onTransfer}
        onTagsChange={onTagsChange}
        onSectorChange={onSectorChange}
        onSaveContact={onSaveContact}
        users={users}
        sectors={sectors}
        supportTags={supportTags}
        currentUser={currentUser}
        onSent={onSent}
        onError={onError}
      />
    </section>
  );
}

function getEmptyTabCopy(status) {
  if (status === 'groups') return 'Nenhum grupo recebido. Ajustes podem ignorar eventos de grupo.';
  if (status === 'active') return 'Nenhum atendimento ativo. Abra a aba Espera e atenda um contato para iniciar.';
  if (status === 'finished') return 'Nenhum chat finalizado ainda.';
  return 'Nenhum contato em espera. O webhook recebido vai preencher esta fila.';
}

function conversationMatchesTab(item, tab) {
  if (tab === 'groups') return Boolean(item.isGroup);
  return !item.isGroup && (item.chatStatus || 'waiting') === tab;
}

function ConversationTags({ conversation }) {
  const tags = conversation?.tags || [];
  const hasBadges = Boolean(conversation?.sectorName || tags.length);
  if (!hasBadges) return null;
  return (
    <span className="conversation-tags">
      {conversation.sectorName && <span className="tag-pill sector-tag" data-color={conversation.sectorColor || 'green'}>{conversation.sectorName}</span>}
      {tags.slice(0, 3).map((tag) => <span key={tag.id} className="tag-pill" data-color={tag.color}>{tag.name}</span>)}
    </span>
  );
}

function MessageBubble({ message, onOpenMedia, onReply, canReply = false, showSenderName = false }) {
  if (message.direction === 'system') {
    return (
      <article className="system-event">
        <span>{message.body}</span>
        <small>{formatTime(message.createdAt)}</small>
      </article>
    );
  }

  const media = getMessageMedia(message);
  const imageSource = media && ['image', 'sticker'].includes(media.type) ? media.src : '';
  const hasText = Boolean(message.body && !isPlaceholderBody(message.body));
  const isSticker = media?.type === 'sticker' || isStickerMessage(message);
  const mediaLabel = getMessageMediaLabel(message, media);
  const imageAlt = hasText ? message.body : mediaLabel;
  const senderLabel = showSenderName && message.direction === 'inbound' && (message.senderName || message.senderPhone)
    ? message.senderName || message.senderPhone
    : '';

  return (
    <article className={`bubble ${message.direction} ${media ? 'with-media' : ''} ${isSticker ? 'is-sticker' : ''} ${media?.type ? `media-${media.type}` : ''}`}>
      {senderLabel && <span className="message-sender-label">{senderLabel}</span>}
      {message.replyPreview && (
        <div className="reply-context">
          <CornerUpLeft size={14} />
          <span>{message.replyPreview}</span>
        </div>
      )}
      {imageSource && (
        <button
          type="button"
          className="message-image-button"
          onClick={() => onOpenMedia?.({ src: imageSource, alt: imageAlt, caption: hasText ? message.body : '' })}
          title="Abrir imagem"
        >
          <img className="message-image" src={imageSource} alt={imageAlt} loading="lazy" />
        </button>
      )}
      {media?.type === 'audio' && (
        <div className="message-audio">
          <div className="message-media-heading">
            <AudioLines size={17} />
            <span>{media.fileName || 'Audio'}</span>
          </div>
          <MediaMeta media={media} />
        </div>
      )}
      {media?.type === 'video' && (
        <div className="message-video">
          <video controls preload="metadata" src={media.src}>
            <a href={media.src}>Abrir video</a>
          </video>
          <MediaMeta media={media} />
        </div>
      )}
      {media?.type === 'document' && (
        <a className="message-document" href={media.src} target="_blank" rel="noreferrer" download={media.fileName || undefined}>
          <FileText size={22} />
          <span>
            <strong>{media.fileName || 'Documento'}</strong>
            <small>{[formatBytes(media.size), media.mimeType].filter(Boolean).join(' · ') || 'Abrir arquivo'}</small>
          </span>
          <Download size={17} />
        </a>
      )}
      {hasText && <p>{message.body}</p>}
      {!hasText && media && (
        <p className="media-caption">
          <MediaLabelIcon type={media.type} size={15} />
          {mediaLabel}
        </p>
      )}
      <footer>
        {canReply && (
          <button
            type="button"
            className="message-reply-action"
            onClick={() => onReply?.(message)}
            title="Responder esta mensagem"
          >
            <CornerUpLeft size={13} />
            Responder
          </button>
        )}
        <span>{formatTime(message.createdAt)}</span>
        {message.direction === 'outbound' && <CheckCheck size={14} />}
      </footer>
    </article>
  );
}

function MediaMeta({ media }) {
  const details = [formatDuration(media.duration), formatBytes(media.size)].filter(Boolean);
  if (!details.length) return null;
  return <small className="message-media-meta">{details.join(' · ')}</small>;
}

function MediaLabelIcon({ type, size = 16 }) {
  if (type === 'audio') return <AudioLines size={size} />;
  if (type === 'video') return <Film size={size} />;
  if (type === 'document') return <FileText size={size} />;
  return <ImageIcon size={size} />;
}

function getMessageMediaLabel(message, media = null) {
  if (media?.type === 'audio') return 'Audio recebido';
  if (media?.type === 'video') return 'Video recebido';
  if (media?.type === 'document') return media.fileName || 'Documento recebido';
  if (isStickerMessage(message) || media?.type === 'sticker') return 'Figurinha';
  return 'Imagem recebida';
}

function isStickerMessage(message) {
  return Boolean(
    message?.type === 'sticker'
      || message?.raw?.msgContent?.stickerMessage
      || message?.raw?.message?.stickerMessage
  );
}

function MediaModal({ media, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="media-modal" role="dialog" aria-modal="true" aria-label="Imagem recebida" onClick={onClose}>
      <div className="media-modal-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="media-modal-close" onClick={onClose} title="Fechar imagem">
          <X size={20} />
        </button>
        <img src={media.src} alt={media.alt || 'Imagem recebida'} />
        {media.caption && <p className="media-modal-caption">{media.caption}</p>}
      </div>
    </div>
  );
}

function ChatWindow({
  selectedConversation,
  messages,
  loadingMessages = false,
  onOpenMedia,
  onAttend,
  onReopen,
  onFinish,
  onDelete,
  onTransfer,
  onTagsChange,
  onSectorChange,
  onSaveContact,
  users = [],
  sectors = [],
  supportTags = [],
  currentUser,
  onSent,
  onError
}) {
  const [draft, setDraft] = useState('');
  const [mediaDraft, setMediaDraft] = useState(null);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatStatus = selectedConversation?.chatStatus || 'waiting';
  const selectedSessionId = selectedConversation?.id || '';
  const selectedPhone = selectedConversation?.phone || '';
  const canReply = chatStatus === 'active';
  const transferUsers = users.filter((user) => user.active && user.id !== currentUser?.id);
  const currentTagIds = (selectedConversation?.tags || []).map((tag) => tag.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedSessionId]);

  useEffect(() => {
    setDraft('');
    setMediaDraft(null);
    setMediaProgress(0);
    setReplyingTo(null);
    setTransferTarget('');
  }, [selectedSessionId]);

  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!selectedPhone || (!text && !mediaDraft) || !canReply) return;
    setSending(true);
    try {
      const result = await api('/api/messages/send', {
        method: 'POST',
        body: {
          phone: selectedPhone,
          message: text,
          sessionId: selectedSessionId,
          media: mediaDraft ? {
            type: mediaDraft.type,
            dataUrl: mediaDraft.dataUrl,
            name: mediaDraft.name,
            mimeType: mediaDraft.mimeType,
            size: mediaDraft.size,
            extension: mediaDraft.extension
          } : null,
          replyToMessageId: replyingTo?.id || '',
          replyToExternalId: replyingTo?.externalId || '',
          replyPreview: replyingTo ? buildReplyPreview(replyingTo) : ''
        }
      });
      setDraft('');
      setMediaDraft(null);
      setMediaProgress(0);
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSent(result.message);
    } catch (error) {
      onError(error);
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      insertTextareaValue(event.currentTarget, '\n', setDraft);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleMediaSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const validation = validateMediaFile(file);
      if (!validation.valid) throw new Error(validation.message);
      setMediaProgress(4);
      const prepared = await prepareMediaFile(file, { onProgress: setMediaProgress });
      setMediaDraft(prepared);
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Nao foi possivel ler a midia selecionada.'));
      setMediaProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!selectedPhone) {
    return (
      <section className="chat-panel empty-state">
        <MessageCircle size={42} />
        <h1>Atendimento em tempo real</h1>
        <p>Quando a W-API chamar o webhook de recebimento, a conversa aparece aqui automaticamente.</p>
      </section>
    );
  }

  return (
    <section className="chat-panel">
      <div className="chat-header justify-between">
        <div className="flex items-center gap-2">
        <ContactAvatar contact={selectedConversation} fallback={selectedPhone} large />
        <div className="chat-title-copy">
          <strong>{selectedConversation?.name || selectedPhone}</strong>
          <ConversationTags conversation={selectedConversation} />
          <small>{selectedPhone} · {getConversationStatusLabel(chatStatus)}</small>
        </div>
        </div>
        <div className="chat-actions">
          <label className="transfer-control">
            <Tags size={16} />
            <select value="" onChange={(event) => {
              const tagId = event.target.value;
              if (tagId && !currentTagIds.includes(tagId)) onTagsChange?.(selectedSessionId, [...currentTagIds, tagId]);
            }} title="Adicionar tag">
              <option value="">Tag</option>
              {supportTags.filter((tag) => tag.active && !currentTagIds.includes(tag.id)).map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </label>
          <label className="transfer-control">
            <Navigation size={16} />
            <select value={selectedConversation?.sectorId || ''} onChange={(event) => onSectorChange?.(selectedSessionId, event.target.value)} title="Setor do atendimento">
              <option value="">Setor</option>
              {sectors.filter((sector) => sector.active).map((sector) => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
          </label>
          {chatStatus === 'waiting' && (
            <button type="button" className="secondary-action compact-action" onClick={() => onAttend(selectedSessionId)}>
              <UserCheck size={17} />
              Atender
            </button>
          )}
          {chatStatus === 'finished' && (
            <button type="button" className="secondary-action compact-action" onClick={() => onReopen(selectedSessionId)}>
              <RotateCcw size={17} />
              Reabrir
            </button>
          )}
          {chatStatus === 'active' && (
            <>
              <label className="transfer-control">
                <Users size={16} />
                <select value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} title="Transferir atendimento">
                  <option value="">Transferir</option>
                  {transferUsers.map((user) => (
                    <option key={user.id} value={`user:${user.id}`}>{user.name}</option>
                  ))}
                  {sectors.filter((sector) => sector.active).map((sector) => (
                    <option key={sector.id} value={`sector:${sector.id}`}>Setor: {sector.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-action compact-action"
                disabled={!transferTarget}
                onClick={() => onTransfer?.(selectedSessionId, transferTarget)}
              >
                <MessageSquareShareIcon size={17} />
              </button>
              <button type="button" className="secondary-action compact-action" onClick={() => onFinish(selectedSessionId)}>
                <CheckCircle2 size={17} />
                Finalizar
              </button>
            </>
          )}
          <button
            type="button"
            className="secondary-action compact-action"
            onClick={() => onSaveContact?.({
              phone: selectedPhone,
              name: selectedConversation?.name || '',
              avatarUrl: selectedConversation?.avatarUrl || '',
              isGroup: Boolean(selectedConversation?.isGroup),
              source: 'chat'
            })}
          >
            <UserPlus size={17} />
          </button>
          <button type="button" className="secondary-action compact-action danger-action" onClick={() => onDelete(selectedSessionId)}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="message-stream">
        {loadingMessages ? (
          <div className="chat-loading">
            <Loader2 className="spin" size={22} />
            <span>Carregando mensagens</span>
          </div>
        ) : messages.length ? messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onOpenMedia={onOpenMedia}
            onReply={setReplyingTo}
            canReply={canReply}
            showSenderName={Boolean(selectedConversation?.isGroup)}
          />
        )) : <p className="empty stream-empty">Nenhuma mensagem carregada para esta conversa.</p>}
        <div ref={bottomRef} />
      </div>

      <form className="composer composer-shell" onSubmit={submit}>
        {(replyingTo || mediaDraft || mediaProgress > 0) && (
          <div className="composer-preview">
            <div>
              {replyingTo && (
                <span>
                  <CornerUpLeft size={15} />
                  Respondendo: {buildReplyPreview(replyingTo)}
                </span>
              )}
              {mediaDraft && (
                <span>
                  <MediaLabelIcon type={mediaDraft.type} size={15} />
                  {mediaDraft.name}
                  {mediaDraft.size ? ` · ${formatBytes(mediaDraft.size)}` : ''}
                  {mediaDraft.compressed ? ' · comprimida' : ''}
                </span>
              )}
              {!mediaDraft && mediaProgress > 0 && (
                <span>
                  <Loader2 className="spin" size={15} />
                  Preparando midia {mediaProgress}%
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setMediaDraft(null);
                setMediaProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              title="Limpar anexos"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept={MEDIA_FILE_ACCEPT}
          onChange={handleMediaSelection}
          disabled={!canReply || sending}
        />
        <div className="composer-bar">
          <button
            type="button"
            className="attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canReply || sending}
            title="Anexar midia"
          >
            <Paperclip size={21} />
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={canReply ? 'Digite uma mensagem' : 'Atenda o contato para responder'}
            disabled={!canReply}
            rows={1}
          />
          <button className="send-button" disabled={sending || (!draft.trim() && !mediaDraft) || !canReply} title="Enviar resposta">
            {sending ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </form>
    </section>
  );
}

function getConversationStatusLabel(status) {
  if (status === 'active') return 'Ativo';
  if (status === 'finished') return 'Finalizado';
  return 'Em espera';
}

function buildReplyPreview(message) {
  if (!message) return '';
  const text = !isPlaceholderBody(message.body) ? message.body : '';
  const media = getMessageMedia(message);
  const fallback = media ? getMessageMediaLabel(message, media).replace(' recebido', '') : 'Mensagem';
  return String(text || fallback).replace(/\s+/g, ' ').trim().slice(0, 140);
}

function insertTextareaValue(textarea, value, setValue) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const next = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
  setValue(next);
  requestAnimationFrame(() => {
    textarea.selectionStart = start + value.length;
    textarea.selectionEnd = start + value.length;
  });
}

createRoot(document.getElementById('root')).render(<App />);
