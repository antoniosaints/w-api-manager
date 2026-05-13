import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/shared/api.js', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
const chatWindowSource = readFileSync(new URL('../src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');
const messageBubbleSource = readFileSync(new URL('../src/components/chat/MessageBubble.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/pages/SettingsPanel.jsx', import.meta.url), 'utf8');
const usersSource = readFileSync(new URL('../src/pages/UsersPanel.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const pwaSource = readFileSync(new URL('../src/pwa.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../src/app/runtime-effects.js', import.meta.url), 'utf8');
const serviceWorkerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const packageSource = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const shellSourceWithIndex = [shellSource, readFileSync(new URL('../index.html', import.meta.url), 'utf8')].join('\n');
const cssSource = stylesSource;
const appSource = [mainSource, apiSource, shellSource, settingsSource].join('\n');

test('inbox exposes waiting, active and finished tabs', () => {
  assert.match(mainSource, /conversationTabs/);
  assert.match(mainSource, /Espera/);
  assert.match(mainSource, /Ativos/);
  assert.match(mainSource, /Finalizados/);
  assert.match(stylesSource, /\.conversation-tabs/);
});

test('changing inbox tabs waits for the user to choose a conversation', () => {
  assert.match(mainSource, /setActiveTab\(status\)/);
  assert.match(mainSource, /setSelectedConversationId\(''\)/);
  assert.doesNotMatch(mainSource, /const first = conversations\.find\(\(item\) => conversationMatchesTab\(item, status\)\)/);
  assert.doesNotMatch(mainSource, /setSelectedConversationId\(first\?\.id \|\| ''\)/);
});

test('inbox exposes group tab and group sender labels', () => {
  assert.match(mainSource, /Grupos/);
  assert.match(mainSource, /isGroup/);
  assert.match(messageBubbleSource, /senderName/);
  assert.match(messageBubbleSource, /message-sender-label/);
  assert.match(messageBubbleSource, /showSenderName/);
  assert.match(chatWindowSource, /selectedConversation\?\.isGroup/);
  assert.match(mainSource, /selected\?\.isGroup/);
});

test('chat has attend, reopen, finish and session delete actions', () => {
  assert.match(chatWindowSource, /Assumir/);
  assert.match(chatWindowSource, /Reabrir/);
  assert.match(chatWindowSource, /Finalizar/);
  assert.match(chatWindowSource, /danger-action/);
  assert.match(chatWindowSource, /canReply/);
});

test('server exposes conversation lifecycle endpoints', () => {
  assert.match(serverSource, /app\.patch\('\/api\/support-sessions\/:id\/status'/);
  assert.match(serverSource, /app\.post\('\/api\/support-sessions\/:id\/reopen'/);
  assert.match(serverSource, /app\.delete\('\/api\/support-sessions\/:id'/);
});

test('history menu and dashboard support metrics are wired', () => {
  assert.match(mainSource, /'history'/);
  assert.match(mainSource, /Historico/);
  assert.match(mainSource, /HistoryPanel/);
  assert.match(mainSource, /buildHistoryQuery/);
  assert.match(mainSource, /Atendimentos por usuario/);
});

test('dashboard renders compact Chart.js analytics cards', () => {
  assert.match(packageSource, /"chart\.js"/);
  assert.match(mainSource, /from 'chart\.js\/auto'/);
  assert.match(mainSource, /ChartCanvas/);
  assert.match(mainSource, /TimelineChart/);
  assert.match(mainSource, /BarRankChart/);
  assert.match(mainSource, /StatusDistributionChart/);
  assert.doesNotMatch(mainSource, /function MiniTimelineChart/);
  assert.doesNotMatch(mainSource, /function HorizontalBars/);
  assert.doesNotMatch(mainSource, /dashboard-wide/);
  assert.match(stylesSource, /\.chart-shell/);
  assert.match(stylesSource, /height:\s*220px/);
  assert.match(stylesSource, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('auth, users, transfer and dashboard screens are wired in the UI', () => {
  assert.match(mainSource, /LoginScreen/);
  assert.match(mainSource, /UsersPanel/);
  assert.match(mainSource, /transferSupportSession/);
  assert.match(mainSource, /\/api\/auth\/me/);
  assert.match(mainSource, /\/api\/dashboard/);
  assert.match(appSource, /credentials:\s*'include'/);
});

test('settings expose ignore groups option and sidebar can collapse', () => {
  assert.match(appSource, /ignoreGroups/);
  assert.match(appSource, /Ignorar grupos/);
  assert.match(settingsSource, /instanceJid/);
  assert.match(settingsSource, /JID ou numero do bot/);
  assert.match(mainSource, /sidebarCollapsed/);
  assert.match(appSource, /Alternar menu/);
});

test('message name header is controlled only from the admin user form', () => {
  assert.doesNotMatch(shellSource, /Nome da mensagem/);
  assert.match(usersSource, /sendNameHeader/);
  assert.match(usersSource, /Nome da mensagem/);
  assert.doesNotMatch(serverSource, /changes\.sendNameHeader\s*=\s*req\.body\.sendNameHeader/);
});

test('collapsed sidebar keeps toggle aligned and gives nav icons consistent padding', () => {
  assert.match(stylesSource, /\.sidebar-actions/);
  assert.match(stylesSource, /\.sidebar\.collapsed \.sidebar-toggle/);
  assert.match(stylesSource, /width:\s*44px/);
  assert.match(stylesSource, /height:\s*44px/);
  assert.match(stylesSource, /\.side-nav button svg/);
  assert.match(stylesSource, /\.app-shell\.sidebar-collapsed/);
});

test('composer supports media upload, enter send, ctrl-enter newline and message reply context', () => {
  assert.match(chatWindowSource, /composer-shell/);
  assert.match(chatWindowSource, /composer-bar/);
  assert.match(chatWindowSource, /fileInputRef/);
  assert.match(chatWindowSource, /MEDIA_FILE_ACCEPT/);
  assert.match(chatWindowSource, /mediaDraft/);
  assert.match(chatWindowSource, /validateMediaFile/);
  assert.match(chatWindowSource, /onKeyDown=\{handleComposerKeyDown\}/);
  assert.match(chatWindowSource, /Digite uma mensagem/);
  assert.match(chatWindowSource, /event\.key === 'Enter'/);
  assert.match(chatWindowSource, /event\.ctrlKey/);
  assert.match(chatWindowSource, /replyingTo/);
  assert.match(chatWindowSource, /replyToMessageId/);
  assert.match(messageBubbleSource, /message-reply-action/);
  assert.match(stylesSource, /\.composer-shell/);
  assert.match(stylesSource, /\.composer-bar/);
  assert.match(stylesSource, /\.composer-preview/);
  assert.match(stylesSource, /resize:\s*none/);
  assert.match(stylesSource, /\.reply-context/);
});

test('chat exposes quick scroll to the latest message', () => {
  const chatWindowSource = readFileSync(new URL('../src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');
  assert.match(chatWindowSource, /streamRef/);
  assert.match(chatWindowSource, /scrollToLatestMessage/);
  assert.match(chatWindowSource, /showScrollToLatest/);
  assert.match(chatWindowSource, /chat-scroll-bottom/);
  assert.match(chatWindowSource, /window\.requestAnimationFrame/);
  assert.match(chatWindowSource, /stream\.scrollTo/);
  assert.match(chatWindowSource, /loadingMessages/);
  assert.match(stylesSource, /\.chat-scroll-bottom/);
});

test('composer uploads media separately and sends only a lightweight upload reference', () => {
  const chatWindowSource = readFileSync(new URL('../src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');
  assert.match(serverSource, /app\.post\('\/api\/messages\/upload'/);
  assert.match(serverSource, /express\.raw/);
  assert.match(chatWindowSource, /\/api\/messages\/upload/);
  assert.match(chatWindowSource, /uploadPreparedMedia/);
  assert.match(chatWindowSource, /uploadId/);
  assert.doesNotMatch(chatWindowSource, /dataUrl:\s*mediaDraft\.dataUrl/);
});

test('composer can paste clipboard files into the chat without breaking text paste', () => {
  const chatWindowSource = readFileSync(new URL('../src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');
  assert.match(chatWindowSource, /handleComposerPaste/);
  assert.match(chatWindowSource, /onPaste=\{handleComposerPaste\}/);
  assert.match(chatWindowSource, /clipboardData\?\.items/);
  assert.match(chatWindowSource, /getAsFile\?\.\(\)/);
  assert.match(chatWindowSource, /event\.preventDefault\(\)/);
  assert.match(chatWindowSource, /Cole um arquivo por vez no chat/);
  assert.match(chatWindowSource, /arquivo-colado/);
});

test('image attachments open a pre-send modal with crop and resize presets', () => {
  const chatWindowSource = readFileSync(new URL('../src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');
  const imageModalSource = readFileSync(new URL('../src/components/chat/ImagePreSendModal.jsx', import.meta.url), 'utf8');
  const imageEditingSource = readFileSync(new URL('../src/components/chat/image-editing.js', import.meta.url), 'utf8');
  assert.match(chatWindowSource, /ImagePreSendModal/);
  assert.match(chatWindowSource, /setImagePreSendDraft/);
  assert.match(chatWindowSource, /validation\.type === 'image'/);
  assert.match(imageModalSource, /Preparo da imagem/);
  assert.match(imageModalSource, /Anexar imagem/);
  assert.match(imageEditingSource, /Quadrado 1:1/);
  assert.match(imageEditingSource, /Retrato 4:5/);
  assert.match(imageEditingSource, /Paisagem 16:9/);
  assert.match(imageEditingSource, /1600 px/);
  assert.match(imageEditingSource, /buildEditedImageFile/);
  assert.match(imageEditingSource, /resolveCenteredCrop/);
});

test('selected chat clears unread badge optimistically while read confirmation is saved', () => {
  assert.match(mainSource, /function markConversationRead\(sessionId\)/);
  assert.match(mainSource, /item\.id === sessionId \? \{ \.\.\.item, unreadCount: 0 \} : item/);
  assert.match(serverSource, /app\.patch\('\/api\/support-sessions\/:id\/read'/);
  assert.match(serverSource, /markSupportSessionRead\(req\.params\.id\)/);
});

test('toast is positioned at the top center of the viewport', () => {
  assert.match(stylesSource, /\.toast[\s\S]*top:\s*18px/);
  assert.match(stylesSource, /\.toast[\s\S]*left:\s*50%/);
  assert.match(stylesSource, /\.toast[\s\S]*transform:\s*translateX\(-50%\)/);
  assert.doesNotMatch(stylesSource, /\.toast[\s\S]*bottom:\s*22px/);
});

test('settings expose W-API billing status only through admin-gated payment routes', () => {
  assert.match(settingsSource, /\/api\/wapi\/payment\/status/);
  assert.match(settingsSource, /Pagar fatura/);
  assert.match(settingsSource, /Copiar Pix/);
  assert.match(settingsSource, /currentUser\?\.role === 'admin'/);
  assert.match(serverSource, /app\.get\('\/api\/wapi\/payment\/status', requireAdmin/);
});

test('agents menu, accent picker, sectors and attendance tags are wired', () => {
  assert.match(mainSource, /AgentsPanel/);
  assert.match(mainSource, /accentColor/);
  assert.match(shellSource, /onAccentChange/);
  assert.match(stylesSource, /data-accent="purple"/);
  assert.match(stylesSource, /\.conversation-tags/);
  assert.match(serverSource, /\/api\/ai-agents/);
  assert.match(serverSource, /\/api\/sectors/);
  assert.match(serverSource, /\/api\/support-tags/);
  assert.match(serverSource, /\/api\/auth\/me\/preferences/);
});

test('supervisor role has operational menus without admin-only system access', () => {
  const navigationSource = readFileSync(new URL('../src/app/navigation.jsx', import.meta.url), 'utf8');
  const agentsSource = readFileSync(new URL('../src/pages/AgentsPanel.jsx', import.meta.url), 'utf8');

  assert.match(navigationSource, /supervisor/);
  assert.match(navigationSource, /allowedRoles/);
  assert.match(navigationSource, /'agents'[\s\S]*supervisor/);
  assert.match(usersSource, /Supervisor/);
  assert.match(serverSource, /requireAdminOrSupervisor/);
  assert.match(serverSource, /app\.get\('\/api\/history\/sessions'/);
  assert.match(agentsSource, /canManageAutomationSettings/);
  assert.match(agentsSource, /currentUser\?\.role === 'admin'/);
});

test('chat action header uses an organization modal and admin-only deletion', () => {
  const chatWindowSource = readFileSync(new URL('../src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');

  assert.match(chatWindowSource, /SupportOrganizationModal/);
  assert.match(chatWindowSource, /Organizar/);
  assert.match(chatWindowSource, /Assumir/);
  assert.match(chatWindowSource, /onOpenContact/);
  assert.match(chatWindowSource, /currentUser\?\.role === 'admin'/);
  assert.match(chatWindowSource, /removeTag/);
  assert.doesNotMatch(chatWindowSource, /<option value="">Tag<\/option>/);
  assert.doesNotMatch(chatWindowSource, /title="Setor do atendimento"/);
});

test('history status labels and chat contact editing stay wired', () => {
  const inboxStart = mainSource.indexOf('function Inbox({');
  const inboxEnd = mainSource.indexOf('function getEmptyTabCopy', inboxStart);
  const inboxSource = mainSource.slice(inboxStart, inboxEnd);

  assert.match(mainSource, /function getConversationStatusLabel\(status\)/);
  assert.match(mainSource, /getConversationStatusLabel\(item\.chatStatus\)/);
  assert.match(mainSource, /getConversationStatusLabel\(selected\.chatStatus\)/);
  assert.match(mainSource, /onOpenContact=\{openContactFromConversation\}/);
  assert.match(inboxSource, /onOpenContact,/);
  assert.match(inboxSource, /onOpenContact=\{onOpenContact\}/);
  assert.match(chatWindowSource, /onClick=\{\(\) => onOpenContact\?\.\(selectedConversation\)\}/);
  assert.match(mainSource, /api\(`\/api\/contacts\/\$\{conversation\.contactId\}`\)/);
});

test('user menu exposes device push toggle and app registers a service worker', () => {
  assert.match(shellSource, /Push no dispositivo/);
  assert.match(shellSource, /onTogglePushNotifications/);
  assert.match(mainSource, /registerAppServiceWorker/);
  assert.match(mainSource, /useDevicePushState\(currentUser\)/);
  assert.match(mainSource, /pushEnabled=\{devicePushEnabled\}/);
  assert.doesNotMatch(mainSource, /pushEnabled=\{Boolean\(currentUser\?\.pushEnabled\)\}/);
  assert.match(pwaSource, /enablePushNotifications/);
  assert.match(pwaSource, /disablePushNotifications/);
  assert.match(pwaSource, /getCurrentPushSubscription/);
  assert.match(runtimeSource, /isPushEnabledForCurrentBrowser/);
  assert.doesNotMatch(runtimeSource, /currentUser\?\.pushEnabled/);
  assert.match(serverSource, /\/api\/push\/public-key/);
  assert.match(serverSource, /\/api\/push\/subscribe/);
  assert.match(serverSource, /\/api\/push\/unsubscribe/);
});

test('html shell wires the manifest and apple install metadata for the pwa', () => {
  assert.match(shellSourceWithIndex, /manifest\.webmanifest/);
  assert.match(shellSourceWithIndex, /apple-mobile-web-app-capable/);
  assert.match(shellSourceWithIndex, /theme-color/);
});

test('push notifications deep-link the app back into inbox conversations', () => {
  assert.match(runtimeSource, /readLaunchRoute/);
  assert.match(runtimeSource, /clearLaunchRoute/);
  assert.match(runtimeSource, /params\.get\('session'\)/);
});

test('installed pwa taskbar badge follows unread conversation count', () => {
  assert.match(pwaSource, /setAppUnreadBadge/);
  assert.match(pwaSource, /navigator\.setAppBadge/);
  assert.match(pwaSource, /navigator\.clearAppBadge/);
  assert.match(runtimeSource, /useUnreadAppBadge/);
  assert.match(runtimeSource, /conversations\.reduce\(\(total, item\) => total \+ Number\(item\.unreadCount \|\| 0\), 0\)/);
  assert.match(mainSource, /useUnreadAppBadge\(\{ currentUser, conversations \}\)/);
});

test('service worker keeps installed pwa badge in sync with push notifications', () => {
  assert.match(serviceWorkerSource, /setAppBadgeCount/);
  assert.match(serviceWorkerSource, /self\.registration\.setAppBadge/);
  assert.match(serviceWorkerSource, /self\.registration\.clearAppBadge/);
  assert.match(serviceWorkerSource, /payload\.unreadCount/);
  assert.match(serviceWorkerSource, /notificationclick/);
});

test('chat bubbles use WhatsApp-like compact tails and spacing', () => {
  assert.match(stylesSource, /\.bubble::before/);
  assert.match(stylesSource, /\.bubble\.inbound::before/);
  assert.match(stylesSource, /\.bubble\.outbound::before/);
  assert.match(stylesSource, /border-radius:\s*7\.5px/);
  assert.match(stylesSource, /--bubble-in/);
  assert.match(stylesSource, /--bubble-out/);
});

test('tailwind is configured as the UI styling layer', () => {
  assert.match(cssSource, /@tailwind base/);
  assert.match(cssSource, /@layer components/);
});
