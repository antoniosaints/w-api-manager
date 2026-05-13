import { useEffect } from 'react';
import { setAppUnreadBadge, syncPushSubscription } from '../pwa.js';

export function usePushSync(currentUser) {
  useEffect(() => {
    if (!currentUser?.pushEnabled) return;
    syncPushSubscription(true).catch(() => null);
  }, [currentUser?.id, currentUser?.pushEnabled]);
}

export function useUnreadAppBadge({ currentUser, conversations }) {
  useEffect(() => {
    if (!currentUser) {
      setAppUnreadBadge(0).catch(() => null);
      return;
    }

    const unreadCount = conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0);
    setAppUnreadBadge(unreadCount).catch(() => null);
  }, [currentUser?.id, conversations]);
}

export function useLaunchRouteSelection({ launchRouteRef, currentUser, conversations, setView, setSelectedConversationId }) {
  useEffect(() => {
    const pendingRoute = launchRouteRef.current;
    if (!currentUser || !pendingRoute) return;
    if (pendingRoute.view) setView(pendingRoute.view);
    if (pendingRoute.sessionId && conversations.some((item) => item.id === pendingRoute.sessionId)) {
      setSelectedConversationId(pendingRoute.sessionId);
      launchRouteRef.current = null;
      clearLaunchRoute();
    }
  }, [conversations, currentUser, launchRouteRef, setSelectedConversationId, setView]);
}

export function readLaunchRoute() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const view = String(params.get('view') || '').trim();
  const sessionId = String(params.get('session') || '').trim();
  if (!view && !sessionId) return null;
  return {
    view: view || 'inbox',
    sessionId
  };
}

export function clearLaunchRoute() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('view');
  url.searchParams.delete('session');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}
