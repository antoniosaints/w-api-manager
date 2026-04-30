import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardInsights } from '../src/dashboard.js';

test('builds dashboard insights from current conversations, status and events', () => {
  const insights = buildDashboardInsights({
    conversations: [
      { unreadCount: 2 },
      { unreadCount: 0 },
      { unreadCount: 4 }
    ],
    events: [{}, {}, {}],
    connected: true,
    settings: { instanceId: 'inst-1' }
  });

  assert.deepEqual(insights.cards, [
    { key: 'conversations', label: 'Conversas', value: 3, note: '6 nao lidas' },
    { key: 'instance', label: 'Instancia', value: 'Online', note: 'inst-1' },
    { key: 'events', label: 'Eventos', value: 3, note: 'historico recente' }
  ]);
});
