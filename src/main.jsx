import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import Chart from 'chart.js/auto';
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  History,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Tags,
  UserCheck,
  Users,
  MessageSquareShareIcon
} from 'lucide-react';
import './styles.css';
import { API, api } from './shared/api.js';
import { eventToRow, formatTime, getSystemTheme, initials, isConnected, isPlaceholderBody } from './shared/format.js';
import { canAccessView } from './app/navigation.jsx';
import { Sidebar, Header, MobileNav } from './components/AppShell.jsx';
import {
  MediaModal as ChatMediaModal,
  MessageBubble as ChatMessageBubble
} from './components/chat/MessageBubble.jsx';
import { ChatWindow as ChatWindowPanel } from './components/chat/ChatWindow.jsx';
import { Card, Input, Pagination, SearchField, Select } from './components/ui/index.js';
import { LoginScreen } from './pages/LoginScreen.jsx';
import { UsersPanel } from './pages/UsersPanel.jsx';
import { ContactsPanel, ContactModal } from './pages/ContactsPanel.jsx';
import { SendPanel } from './pages/SendPanel.jsx';
import { ConnectionPanel } from './pages/ConnectionPanel.jsx';
import { WebhookPanel } from './pages/WebhookPanel.jsx';
import { SettingsPanel } from './pages/SettingsPanel.jsx';
import { AgentsPanel } from './pages/AgentsPanel.jsx';
import { useDevicePushState, useLaunchRouteSelection, usePushSync, useUnreadAppBadge, readLaunchRoute } from './app/runtime-effects.js';
import { useUserPreferenceActions } from './app/user-preferences.js';
import { mergeMessageUpdate } from './app/messages.js';
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
  ['assigned', 'Atribuidos'],
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
  const { devicePushEnabled, setDevicePushEnabled } = useDevicePushState(currentUser);
  const {
    updateAccentColor,
    updateUserPreferences,
    togglePushNotifications
  } = useUserPreferenceActions({ setCurrentUser, setDevicePushEnabled, showToast, handleError });

  useEffect(() => {
    checkAuth();
    registerAppServiceWorker().catch(() => null);
  }, []);

  useEffect(() => {
    if (currentUser) loadInitial();
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser && !canAccessView(view, currentUser.role)) {
      setView('dashboard');
    }
  }, [currentUser?.role, view]);

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

  async function openContactFromConversation(conversation) {
    if (!conversation?.contactId) {
      setContactDraft({
        phone: conversation?.phone || '',
        name: conversation?.name || '',
        avatarUrl: conversation?.avatarUrl || '',
        isGroup: Boolean(conversation?.isGroup),
        source: 'chat'
      });
      return;
    }

    try {
      const result = await api(`/api/contacts/${conversation.contactId}`);
      setContactDraft(result.contact);
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
          pushEnabled={devicePushEnabled}
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
              <DashboardPanelPro
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

            {view === 'agents' && canAccessView('agents', currentUser.role) && (
              <AgentsPanel
                settings={settings}
                setSettings={setSettings}
                users={users}
                onError={handleError}
                currentUser={currentUser}
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
                onOpenContact={openContactFromConversation}
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

            {view === 'history' && canAccessView('history', currentUser.role) && (
              <HistoryPanel
                users={users}
                sectors={sectors}
                onOpenMedia={setMediaPreview}
                onError={handleError}
              />
            )}

            {view === 'send' && currentUser.role === 'admin' && (
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
          onSaved={() => refreshConversations(selectedConversationId).catch(handleError)}
          onError={handleError}
          showToast={showToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function DashboardPanelPro({ connected, settings }) {
  const [filters, setFilters] = useState({ period: '30', from: '', to: '' });
  const [dashboard, setDashboard] = useState(null);
  const [contactPage, setContactPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);

  useEffect(() => {
    const query = buildPeriodQuery(filters);
    api(`/api/dashboard${query}`).then(setDashboard).catch(() => setDashboard(null));
  }, [filters.period, filters.from, filters.to]);

  const summary = dashboard?.summary || {};
  const status = dashboard?.status || {};
  const contactRows = paginateRows(dashboard?.byContact || [], contactPage, 5);
  const eventRows = paginateRows([...(dashboard?.recentTransfers || []), ...(dashboard?.recentEvents || [])], eventPage, 5);
  const cards = [
    { key: 'total', icon: MessageCircle, label: 'Atendimentos', value: summary.total || 0, note: `${summary.unread || 0} nao lidas` },
    { key: 'waiting', icon: BellRing, label: 'Em espera', value: status.waiting || 0, note: 'fila atual' },
    { key: 'active', icon: Activity, label: 'Ativos', value: status.active || 0, note: 'em atendimento' },
    { key: 'finished', icon: CheckCircle2, label: 'Finalizados', value: status.finished || 0, note: `${summary.completionRate || 0}% conclusao` },
    { key: 'response', icon: Clock3, label: '1a resposta', value: `${summary.averageFirstResponseMinutes || 0} min`, note: 'media operacional' },
    { key: 'wait', icon: UserCheck, label: 'Espera', value: `${summary.averageWaitMinutes || 0} min`, note: 'ate assumir' },
    { key: 'close', icon: CircleDot, label: 'Fechamento', value: `${summary.averageCloseMinutes || 0} min`, note: 'tempo medio' },
    { key: 'messages', icon: Send, label: 'Mensagens', value: `${summary.inboundMessages || 0}/${summary.outboundMessages || 0}`, note: `${summary.messagesPerSession || 0} por atendimento` },
    { key: 'transfers', icon: MessageSquareShareIcon, label: 'Transferencias', value: summary.transfers || 0, note: `${summary.reopened || 0} reabertos` }
  ];

  function updateFilter(changes) {
    setContactPage(1);
    setEventPage(1);
    setFilters((current) => ({ ...current, ...changes }));
  }

  return (
    <section className="dashboard-layout">
      <div className="dashboard-toolbar dashboard-toolbar-rich">
        <Select className="toolbar-select" value={filters.period} onChange={(event) => updateFilter({ period: event.target.value })}>
          <option value="7">Ultimos 7 dias</option>
          <option value="30">Ultimos 30 dias</option>
          <option value="90">Ultimos 90 dias</option>
          <option value="custom">Periodo customizado</option>
          <option value="all">Todo historico</option>
        </Select>
        {filters.period === 'custom' && (
          <div className="date-range-controls">
            <Input label="Inicio" type="date" value={filters.from} onChange={(event) => updateFilter({ from: event.target.value })} />
            <Input label="Fim" type="date" value={filters.to} onChange={(event) => updateFilter({ to: event.target.value })} />
          </div>
        )}
        <span className={connected ? 'status-pill connected' : 'status-pill'}>
          <CircleDot size={15} />
          {connected ? 'Instancia online' : settings?.instanceId || 'Instancia a verificar'}
        </span>
      </div>

      <div className="summary-strip dashboard-summary-rich" aria-label="Resumo operacional">
        {cards.map((card) => (
          <SummaryCard key={card.key} icon={card.icon} label={card.label} value={card.value} note={card.note} />
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid-rich">
        <Card as="section" variant="panel" className="single-panel dashboard-panel dashboard-chart-card">
          <div className="panel-title compact">
            <BarChart3 size={22} />
            <div>
              <span>Timeline</span>
              <h1>Fluxo por dia</h1>
              <p>Entradas, saidas e finalizacoes do periodo.</p>
            </div>
          </div>
          <TimelineChart data={dashboard?.timeline || []} />
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel dashboard-chart-card">
          <div className="panel-title compact">
            <CircleDot size={22} />
            <div>
              <span>Status</span>
              <h1>Distribuicao atual</h1>
              <p>Fila, ativos e finalizados no periodo.</p>
            </div>
          </div>
          <StatusDistributionChart status={status} />
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel dashboard-chart-card">
          <div className="panel-title compact">
            <Users size={22} />
            <div>
              <span>Equipe</span>
              <h1>Atendimentos por usuario</h1>
              <p>Responsaveis, ativos e finalizados.</p>
            </div>
          </div>
          <BarRankChart rows={dashboard?.byUser || []} labelKey="name" valueKey="total" detail={(item) => `${item.active} ativos - ${item.finished} finalizados`} />
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel dashboard-chart-card">
          <div className="panel-title compact">
            <Activity size={22} />
            <div>
              <span>Setores</span>
              <h1>Volume por setor</h1>
              <p>Distribuicao operacional por fila.</p>
            </div>
          </div>
          <BarRankChart rows={dashboard?.bySector || []} labelKey="name" valueKey="total" detail={(item) => `${item.waiting} espera - ${item.active} ativos`} />
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel dashboard-chart-card">
          <div className="panel-title compact">
            <Tags size={22} />
            <div>
              <span>Tags</span>
              <h1>Classificacoes</h1>
              <p>Marcadores mais usados no periodo.</p>
            </div>
          </div>
          <BarRankChart rows={dashboard?.byTag || []} labelKey="name" valueKey="total" detail={(item) => `${item.finished} finalizados`} />
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel">
          <div className="panel-title compact">
            <MessageCircle size={22} />
            <div>
              <span>Contatos</span>
              <h1>Top atendimentos</h1>
              <p>Clientes que mais acionaram a equipe.</p>
            </div>
          </div>
          <div className="insight-list">
            {contactRows.data.map((item) => (
              <Card as="article" variant="row" key={item.phone}>
                <ContactAvatar contact={item} />
                <div>
                  <strong>{item.name || item.phone}</strong>
                  <small>{item.finished} finalizados - {item.active} ativos</small>
                </div>
                <span className="badge neutral-badge">{item.count}</span>
              </Card>
            ))}
            {!dashboard?.byContact?.length && <p className="empty">Nenhum atendimento no periodo.</p>}
          </div>
          <Pagination meta={contactRows.meta} onPage={setContactPage} />
        </Card>

        <Card as="section" variant="panel" className="single-panel dashboard-panel">
          <div className="panel-title compact">
            <Clock3 size={22} />
            <div>
              <span>Eventos</span>
              <h1>Timeline recente</h1>
              <p>Webhooks e transferencias recentes.</p>
            </div>
          </div>
          <div className="insight-list events-compact">
            {eventRows.data.map((event) => (
              <Card as="article" variant="row" key={event.id || `${event.eventType}-${event.createdAt}`}>
                <span className="event-dot" />
                <div>
                  <strong>{event.body || event.eventType}</strong>
                  <small>{formatTime(event.createdAt)}</small>
                </div>
              </Card>
            ))}
            {!eventRows.data.length && <p className="empty">Nenhum evento recebido ainda.</p>}
          </div>
          <Pagination meta={eventRows.meta} onPage={setEventPage} />
        </Card>
      </div>
    </section>
  );
}

function HistoryPanel({ users = [], sectors = [], onOpenMedia, onError }) {
  const [filters, setFilters] = useState({ search: '', status: '', assignedUserId: '', sectorId: '', period: 'all', from: '', to: '', page: 1 });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [historyMessages, setHistoryMessages] = useState([]);
  const selected = rows.find((item) => item.id === selectedHistoryId) || rows[0] || null;

  useEffect(() => {
    const query = buildHistoryQuery(filters);
    api(`/api/history/sessions?${query}`)
      .then((result) => {
        setRows(result.data || []);
        setMeta(result.meta || { page: 1, limit: 12, total: 0, totalPages: 1 });
      })
      .catch(onError);
  }, [filters.search, filters.status, filters.assignedUserId, filters.sectorId, filters.period, filters.from, filters.to, filters.page]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedHistoryId('');
      return;
    }
    if (!rows.some((item) => item.id === selectedHistoryId)) {
      setSelectedHistoryId(rows[0].id);
    }
  }, [rows, selectedHistoryId]);

  useEffect(() => {
    if (!selected?.id) {
      setHistoryMessages([]);
      return;
    }
    api(`/api/support-sessions/${selected.id}/messages`).then(setHistoryMessages).catch(onError);
  }, [selected?.id]);

  function updateFilters(changes) {
    setFilters((current) => ({ ...current, ...changes, page: changes.page || 1 }));
  }

  return (
    <section className="history-layout">
      <Card as="aside" variant="panel" className="single-panel history-list-panel">
        <div className="panel-title compact">
          <History size={22} />
          <div>
            <span>Historico</span>
            <h1>Atendimentos</h1>
            <p>Consulta paginada por periodo, setor e responsavel.</p>
          </div>
        </div>
        <div className="history-filters history-filters-advanced">
          <SearchField value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Buscar historico" />
          <Select className="toolbar-select" value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
            <option value="">Todos status</option>
            <option value="waiting">Em espera</option>
            <option value="active">Ativo</option>
            <option value="finished">Finalizado</option>
          </Select>
          <Select className="toolbar-select" value={filters.assignedUserId} onChange={(event) => updateFilters({ assignedUserId: event.target.value })}>
            <option value="">Todos atendentes</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </Select>
          <Select className="toolbar-select" value={filters.sectorId} onChange={(event) => updateFilters({ sectorId: event.target.value })}>
            <option value="">Todos setores</option>
            {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
          </Select>
          <Select className="toolbar-select" value={filters.period} onChange={(event) => updateFilters({ period: event.target.value })}>
            <option value="7">Ultimos 7 dias</option>
            <option value="30">Ultimos 30 dias</option>
            <option value="90">Ultimos 90 dias</option>
            <option value="custom">Periodo especifico</option>
            <option value="all">Todo historico</option>
          </Select>
          {filters.period === 'custom' && (
            <div className="date-range-controls">
              <Input label="Inicio" type="date" value={filters.from} onChange={(event) => updateFilters({ from: event.target.value })} />
              <Input label="Fim" type="date" value={filters.to} onChange={(event) => updateFilters({ to: event.target.value })} />
            </div>
          )}
        </div>
        <div className="conversation-items history-items">
          {rows.map((item) => (
            <button
              key={item.id}
              className={item.id === selected?.id ? 'conversation selected' : 'conversation'}
              onClick={() => setSelectedHistoryId(item.id)}
            >
              <ContactAvatar contact={item} />
              <span className="conversation-copy">
                <strong>{item.name || item.phone}</strong>
                <small>{getConversationStatusLabel(item.chatStatus)} - {item.messageCount || 0} mensagens</small>
              </span>
              <span className="conversation-meta">
                {item.startedAt && <small>{formatTime(item.startedAt)}</small>}
                <span className="session-chip">#{String(item.supportCount || 1).padStart(2, '0')}</span>
              </span>
            </button>
          ))}
          {!rows.length && <p className="empty">Nenhum historico encontrado.</p>}
        </div>
        <Pagination meta={meta} onPage={(page) => updateFilters({ page })} />
      </Card>

      <section className="chat-panel">
        {selected ? (
          <>
            <div className="chat-header">
              <ContactAvatar contact={selected} fallback={selected.phone} large />
              <div className="chat-title-copy">
                <strong>{selected.name || selected.phone}</strong>
                <small>{selected.phone} - {getConversationStatusLabel(selected.chatStatus)}</small>
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

function ChartCanvas({ type, data, options, className = 'chart-shell' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const chart = new Chart(canvasRef.current, { type, data, options });
    return () => chart.destroy();
  }, [type, data, options]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function TimelineChart({ data }) {
  const theme = getChartTheme();
  const chartData = useMemo(() => ({
    labels: data.map((item) => formatShortDate(item.date)),
    datasets: [
      {
        label: 'Entradas',
        data: data.map((item) => Number(item.inbound || 0)),
        borderColor: theme.accent,
        backgroundColor: theme.accentSoft,
        tension: 0.36,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        fill: true
      },
      {
        label: 'Saidas',
        data: data.map((item) => Number(item.outbound || 0)),
        borderColor: theme.blue,
        backgroundColor: theme.blueSoft,
        tension: 0.36,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        fill: false
      },
      {
        label: 'Finalizados',
        data: data.map((item) => Number(item.finished || 0)),
        borderColor: theme.amber,
        backgroundColor: theme.amberSoft,
        tension: 0.36,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        fill: false
      }
    ]
  }), [data, theme.accent, theme.accentSoft, theme.blue, theme.blueSoft, theme.amber, theme.amberSoft]);
  const options = useMemo(() => ({
    ...getBaseChartOptions(theme),
    scales: getCartesianChartScales(theme)
  }), [theme.grid, theme.ink, theme.line, theme.muted, theme.surface]);

  if (!data.length) return <p className="empty chart-empty">Nenhum dado no periodo.</p>;
  return <ChartCanvas type="line" data={chartData} options={options} />;
}

function StatusDistributionChart({ status }) {
  const theme = getChartTheme();
  const rows = [
    { label: 'Em espera', value: Number(status?.waiting || 0), color: theme.amber },
    { label: 'Ativos', value: Number(status?.active || 0), color: theme.accent },
    { label: 'Finalizados', value: Number(status?.finished || 0), color: theme.blue }
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const chartData = useMemo(() => ({
    labels: rows.map((row) => row.label),
    datasets: [{
      data: rows.map((row) => row.value),
      backgroundColor: rows.map((row) => row.color),
      borderColor: theme.surface,
      borderWidth: 3,
      hoverOffset: 5
    }]
  }), [rows, theme.surface]);
  const options = useMemo(() => ({
    ...getBaseChartOptions(theme),
    cutout: '66%',
    plugins: {
      ...getBaseChartOptions(theme).plugins,
      legend: {
        ...getBaseChartOptions(theme).plugins.legend,
        position: 'right'
      }
    }
  }), [theme.grid, theme.ink, theme.line, theme.muted, theme.surface]);

  if (!total) return <p className="empty chart-empty">Nenhum atendimento no periodo.</p>;
  return (
    <>
      <ChartCanvas type="doughnut" data={chartData} options={options} className="chart-shell chart-shell-doughnut" />
      <div className="chart-total">
        <strong>{total}</strong>
        <small>atendimentos</small>
      </div>
    </>
  );
}

function BarRankChart({ rows, labelKey, valueKey, detail }) {
  const theme = getChartTheme();
  const chartRows = rows.slice(0, 8);
  const chartData = useMemo(() => ({
    labels: chartRows.map((item) => shortenChartLabel(item[labelKey] || 'Sem nome')),
    datasets: [{
      label: 'Total',
      data: chartRows.map((item) => Number(item[valueKey] || 0)),
      backgroundColor: chartRows.map((_, index) => theme.palette[index % theme.palette.length]),
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 22
    }]
  }), [chartRows, labelKey, valueKey, theme.palette]);
  const options = useMemo(() => ({
    ...getBaseChartOptions(theme),
    indexAxis: 'y',
    scales: getCartesianChartScales(theme),
    plugins: {
      ...getBaseChartOptions(theme).plugins,
      legend: { display: false },
      tooltip: {
        ...getBaseChartOptions(theme).plugins.tooltip,
        callbacks: {
          afterLabel: (context) => detail?.(chartRows[context.dataIndex]) || ''
        }
      }
    }
  }), [chartRows, detail, theme.grid, theme.ink, theme.line, theme.muted, theme.surface]);

  if (!chartRows.length) return <p className="empty chart-empty">Nenhum registro no periodo.</p>;

  return (
    <>
      <ChartCanvas type="bar" data={chartData} options={options} />
      <div className="chart-footnotes">
        {chartRows.slice(0, 3).map((item) => (
          <span key={item.userId || item.sectorId || item.tagId || item[labelKey]}>
            <strong>{item[labelKey] || 'Sem nome'}</strong>
            <small>{detail?.(item)}</small>
          </span>
        ))}
      </div>
    </>
  );
}

function getChartTheme() {
  if (typeof window === 'undefined') {
    return {
      accent: '#247c5a',
      accentSoft: '#dcefe6',
      amber: '#996515',
      amberSoft: '#fff4d8',
      blue: '#2c638f',
      blueSoft: '#e6f0f8',
      grid: '#d9e1dc',
      ink: '#121a17',
      line: '#d9e1dc',
      muted: '#68786f',
      surface: '#ffffff',
      palette: ['#247c5a', '#2c638f', '#996515', '#4f766a', '#5f6e8a', '#8a6f42', '#49756c', '#6a7f93']
    };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  const accent = read('--accent', '#247c5a');
  const blue = read('--blue', '#2c638f');
  const amber = read('--amber', '#996515');
  return {
    accent,
    accentSoft: read('--accent-soft', '#dcefe6'),
    amber,
    amberSoft: read('--amber-soft', '#fff4d8'),
    blue,
    blueSoft: read('--blue-soft', '#e6f0f8'),
    grid: read('--line', '#d9e1dc'),
    ink: read('--ink', '#121a17'),
    line: read('--line', '#d9e1dc'),
    muted: read('--muted', '#68786f'),
    surface: read('--surface', '#ffffff'),
    palette: [accent, blue, amber, read('--accent-strong', '#145f43'), read('--ink-soft', '#31413a'), '#6f7f88', '#8a7a52', '#52776b']
  };
}

function getBaseChartOptions(theme) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: theme.muted,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          font: { family: 'Roboto', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: theme.surface,
        titleColor: theme.ink,
        bodyColor: theme.muted,
        borderColor: theme.line,
        borderWidth: 1,
        padding: 10,
        displayColors: true
      }
    }
  };
}

function getCartesianChartScales(theme) {
  return {
    x: {
      grid: { color: theme.grid },
      ticks: { color: theme.muted, precision: 0, font: { family: 'Roboto', size: 11 } }
    },
    y: {
      grid: { color: theme.grid },
      ticks: { color: theme.muted, precision: 0, font: { family: 'Roboto', size: 11 } }
    }
  };
}

function shortenChartLabel(value) {
  const label = String(value || '').trim();
  return label.length > 18 ? `${label.slice(0, 17)}...` : label;
}

function paginateRows(rows, page, limit) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 5);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;
  return {
    data: rows.slice(start, start + safeLimit),
    meta: { page: safePage, limit: safeLimit, total, totalPages }
  };
}

function buildPeriodQuery(filters) {
  const params = new URLSearchParams();
  const period = filters?.period || '30';
  if (period === 'all') return '';
  if (period === 'custom') {
    if (filters.from) params.set('from', startOfLocalDate(filters.from));
    if (filters.to) params.set('to', endOfLocalDate(filters.to));
  } else {
    const days = Number(period || 30);
    params.set('from', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
    params.set('to', new Date().toISOString());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function buildHistoryQuery(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.assignedUserId) params.set('assignedUserId', filters.assignedUserId);
  if (filters.sectorId) params.set('sectorId', filters.sectorId);
  if (filters.page) params.set('page', String(filters.page));
  params.set('limit', '12');
  const periodQuery = buildPeriodQuery(filters).replace(/^\?/, '');
  if (periodQuery) {
    for (const [key, value] of new URLSearchParams(periodQuery)) params.set(key, value);
  }
  return params.toString();
}

function startOfLocalDate(value) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : '';
}

function endOfLocalDate(value) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : '';
}

function formatShortDate(value) {
  if (!value) return '';
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
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
  onOpenContact,
  users,
  sectors = [],
  supportTags = [],
  currentUser,
  onSent,
  onError
}) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('waiting');
  const [mobileInboxPane, setMobileInboxPane] = useState('list');
  const conversationTabsRef = useRef(null);
  const lastSelectedConversationIdRef = useRef('');
  const filtered = conversations.filter((item) => {
    const haystack = `${item.name} ${item.phone} ${item.lastMessage?.body || ''}`.toLowerCase();
    return conversationMatchesTab(item, activeTab) && haystack.includes(query.toLowerCase());
  });
  const counts = conversationTabs.reduce((acc, [status]) => {
    acc[status] = conversations.filter((item) => conversationMatchesTab(item, status)).length;
    return acc;
  }, {});

  useEffect(() => {
    const selectedTab = getConversationTab(selectedConversation);
    if (selectedTab && selectedTab !== activeTab) setActiveTab(selectedTab);
  }, [activeTab, selectedConversation]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMobileInboxPane('list');
      lastSelectedConversationIdRef.current = '';
      return;
    }

    if (selectedConversationId !== lastSelectedConversationIdRef.current) {
      setMobileInboxPane('chat');
      lastSelectedConversationIdRef.current = selectedConversationId;
    }
  }, [selectedConversationId]);

  function scrollConversationTabs(direction) {
    const node = conversationTabsRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * Math.max(140, Math.round(node.clientWidth * 0.8)),
      behavior: 'smooth'
    });
  }

  const mobilePaneClass = selectedConversationId && mobileInboxPane === 'chat' ? 'mobile-chat-open' : 'mobile-list-open';

  return (
    <section className={`inbox-layout ${mobilePaneClass}`}>
      <aside className="conversation-list">
        {/* <div className="section-heading">
          <div>
            <span>Fila de atendimento</span>
            <strong>{filtered.length} de {counts[activeTab] || 0} conversas</strong>
          </div>
          <BellRing size={20} />
        </div> */}

        <div className="conversation-tabs-shell">
          <button
            type="button"
            className="conversation-tabs-arrow"
            onClick={() => scrollConversationTabs(-1)}
            title="Ver abas anteriores"
            aria-label="Ver abas anteriores"
          >
            <ChevronLeft size={17} />
          </button>
          <div ref={conversationTabsRef} className="conversation-tabs" role="tablist" aria-label="Status das conversas">
            {conversationTabs.map(([status, label]) => (
              <button
                key={status}
                type="button"
                className={activeTab === status ? 'active' : ''}
                onClick={() => {
                  setActiveTab(status);
                  setMobileInboxPane('list');
                  setSelectedConversationId('');
                }}
              >
                <span>{label}</span>
                <strong>{counts[status] || 0}</strong>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="conversation-tabs-arrow"
            onClick={() => scrollConversationTabs(1)}
            title="Ver proximas abas"
            aria-label="Ver proximas abas"
          >
            <ChevronRight size={17} />
          </button>
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
              onClick={() => {
                setSelectedConversationId(item.id);
                setMobileInboxPane('chat');
              }}
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
        onOpenContact={onOpenContact}
        users={users}
        sectors={sectors}
        supportTags={supportTags}
        currentUser={currentUser}
        onBackToList={() => setMobileInboxPane('list')}
        onSent={onSent}
        onError={onError}
      />
    </section>
  );
}

function getEmptyTabCopy(status) {
  if (status === 'groups') return 'Nenhum grupo recebido. Ajustes podem ignorar eventos de grupo.';
  if (status === 'assigned') return 'Nenhum atendimento atribuido a setor nesta fila.';
  if (status === 'active') return 'Nenhum atendimento ativo. Abra a aba Espera e atenda um contato para iniciar.';
  if (status === 'finished') return 'Nenhum chat finalizado ainda.';
  return 'Nenhum contato em espera. O webhook recebido vai preencher esta fila.';
}

function getConversationStatusLabel(status) {
  if (status === 'active') return 'Ativo';
  if (status === 'finished') return 'Finalizado';
  return 'Em espera';
}

function conversationMatchesTab(item, tab) {
  return getConversationTab(item) === tab;
}

function getConversationTab(item) {
  if (!item) return '';
  if (item.isGroup) return 'groups';
  const status = item.chatStatus || 'waiting';
  if (status === 'waiting' && item.sectorId) return 'assigned';
  if (status === 'waiting') return 'waiting';
  if (status === 'active') return 'active';
  if (status === 'finished') return 'finished';
  return 'waiting';
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

createRoot(document.getElementById('root')).render(<App />);
