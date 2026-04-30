export function filterSessionsByPeriod(items, periodFilter) {
  if (periodFilter === 'all') return items;
  const days = Number(periodFilter || 30);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const value = item.closedAt || item.lastMessageAt || item.startedAt || item.createdAt;
    return value && new Date(value).getTime() >= since;
  });
}

export function periodToQuery(periodFilter) {
  if (periodFilter === 'all') return '';
  const days = Number(periodFilter || 30);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date().toISOString();
  return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export function buildSupportCountByContact(items) {
  return Object.values(items.reduce((acc, item) => {
    const key = item.phone;
    if (!acc[key]) {
      acc[key] = {
        phone: item.phone,
        name: item.name,
        avatarUrl: item.avatarUrl,
        count: 0
      };
    }
    acc[key].count += 1;
    return acc;
  }, {})).sort((a, b) => b.count - a.count);
}
