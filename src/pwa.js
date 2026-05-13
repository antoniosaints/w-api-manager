import { api } from './shared/api.js';

let registrationPromise = null;

export function canUsePushNotifications() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function registerAppServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register('/sw.js');
  }
  return registrationPromise;
}

export async function enablePushNotifications() {
  if (!canUsePushNotifications()) {
    throw new Error('Push notifications nao sao suportadas neste navegador.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissao de notificacoes nao concedida neste dispositivo.');
  }

  const registration = await registerAppServiceWorker();
  if (!registration) {
    throw new Error('Service worker indisponivel para notificacoes push.');
  }

  const { publicKey } = await api('/api/push/public-key');
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await api('/api/push/subscribe', {
    method: 'POST',
    body: {
      subscription: subscription.toJSON(),
      deviceLabel: describeCurrentDevice()
    }
  });

  return subscription;
}

export async function disablePushNotifications() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  const registration = await registerAppServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  const endpoint = subscription?.endpoint || '';

  if (endpoint) {
    await api('/api/push/unsubscribe', {
      method: 'POST',
      body: { endpoint }
    }).catch(() => null);
  }

  if (subscription) {
    await subscription.unsubscribe().catch(() => null);
    return true;
  }

  return false;
}

export async function syncPushSubscription(pushEnabled) {
  if (!pushEnabled || !canUsePushNotifications()) return null;
  if (Notification.permission !== 'granted') return null;
  return enablePushNotifications();
}

function describeCurrentDevice() {
  if (typeof window === 'undefined') return '';
  const ua = window.navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone/iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Navegador';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
