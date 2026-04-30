import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/shared/api.js', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/pages/SettingsPanel.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const cssSource = stylesSource;
const appSource = [mainSource, apiSource, shellSource, settingsSource].join('\n');

test('inbox exposes waiting, active and finished tabs', () => {
  assert.match(mainSource, /conversationTabs/);
  assert.match(mainSource, /Espera/);
  assert.match(mainSource, /Ativos/);
  assert.match(mainSource, /Finalizados/);
  assert.match(stylesSource, /\.conversation-tabs/);
});

test('inbox exposes group tab and group sender labels', () => {
  assert.match(mainSource, /Grupos/);
  assert.match(mainSource, /isGroup/);
  assert.match(mainSource, /senderName/);
  assert.match(mainSource, /message-sender-label/);
  assert.match(mainSource, /showSenderName/);
  assert.match(mainSource, /selectedConversation\?\.isGroup/);
  assert.match(mainSource, /selected\?\.isGroup/);
});

test('chat has attend, reopen, finish and session delete actions', () => {
  assert.match(mainSource, /Atender/);
  assert.match(mainSource, /Reabrir/);
  assert.match(mainSource, /Finalizar/);
  assert.match(mainSource, /Apagar/);
  assert.match(mainSource, /canReply/);
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
  assert.match(mainSource, /periodFilter/);
  assert.match(mainSource, /Suportes por usuario/);
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
  assert.match(mainSource, /sidebarCollapsed/);
  assert.match(appSource, /Alternar menu/);
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
  assert.match(mainSource, /composer-shell/);
  assert.match(mainSource, /composer-bar/);
  assert.match(mainSource, /fileInputRef/);
  assert.match(mainSource, /MEDIA_FILE_ACCEPT/);
  assert.match(mainSource, /mediaDraft/);
  assert.match(mainSource, /validateMediaFile/);
  assert.match(mainSource, /onKeyDown=\{handleComposerKeyDown\}/);
  assert.match(mainSource, /Digite uma mensagem/);
  assert.match(mainSource, /event\.key === 'Enter'/);
  assert.match(mainSource, /event\.ctrlKey/);
  assert.match(mainSource, /replyingTo/);
  assert.match(mainSource, /replyToMessageId/);
  assert.match(mainSource, /message-reply-action/);
  assert.match(stylesSource, /\.composer-shell/);
  assert.match(stylesSource, /\.composer-bar/);
  assert.match(stylesSource, /\.composer-preview/);
  assert.match(stylesSource, /resize:\s*none/);
  assert.match(stylesSource, /\.reply-context/);
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
