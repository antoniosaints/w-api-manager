export const THEME_STORAGE_KEY = 'wapi-ui-theme';
export const THEME_PREFERENCES = ['system', 'light', 'dark'];
export const ACCENT_COLORS = ['green', 'blue', 'red', 'orange', 'purple', 'pink'];

export function sanitizeThemePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : 'system';
}

export function resolveThemePreference(preference, systemTheme = 'light') {
  const safePreference = sanitizeThemePreference(preference);
  if (safePreference !== 'system') return safePreference;
  return systemTheme === 'dark' ? 'dark' : 'light';
}

export function getNextThemePreference(preference) {
  const safePreference = sanitizeThemePreference(preference);
  const currentIndex = THEME_PREFERENCES.indexOf(safePreference);
  return THEME_PREFERENCES[(currentIndex + 1) % THEME_PREFERENCES.length];
}

export function sanitizeAccentColor(value) {
  return ACCENT_COLORS.includes(value) ? value : 'green';
}
