export function buildDashboardInsights({ conversations = [], events = [], connected = false, settings = {} }) {
  const unreadTotal = conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0);

  return {
    cards: [
      {
        key: 'conversations',
        label: 'Conversas',
        value: conversations.length,
        note: `${unreadTotal} nao lidas`
      },
      {
        key: 'instance',
        label: 'Instancia',
        value: connected ? 'Online' : 'A verificar',
        note: settings?.instanceId || 'Sem instancia'
      },
      {
        key: 'events',
        label: 'Eventos',
        value: events.length,
        note: 'historico recente'
      }
    ]
  };
}
