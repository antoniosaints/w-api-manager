import { useCallback } from 'react';
import { api } from '../shared/api.js';
import { disablePushNotifications, enablePushNotifications } from '../pwa.js';

export function useUserPreferenceActions({ setCurrentUser, setDevicePushEnabled, showToast, handleError }) {
  const updateUserPreferences = useCallback(async (changes, successMessage = 'Preferencias atualizadas') => {
    try {
      const data = await api('/api/auth/me/preferences', { method: 'PATCH', body: changes });
      setCurrentUser(data.user);
      showToast(successMessage);
      return data.user;
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [handleError, setCurrentUser, showToast]);

  const updateAccentColor = useCallback((themeColor) => {
    return updateUserPreferences({ themeColor }, 'Cor do tema atualizada');
  }, [updateUserPreferences]);

  const togglePushNotifications = useCallback(async (nextEnabled) => {
    try {
      if (nextEnabled) {
        await enablePushNotifications();
      } else {
        await disablePushNotifications();
      }
      setDevicePushEnabled?.(nextEnabled);
      showToast(nextEnabled ? 'Notificacoes ativadas' : 'Notificacoes desativadas');
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setDevicePushEnabled, showToast]);

  return {
    updateAccentColor,
    updateUserPreferences,
    togglePushNotifications
  };
}
