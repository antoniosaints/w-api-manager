import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextThemePreference,
  resolveThemePreference,
  sanitizeAccentColor,
  sanitizeThemePreference
} from '../src/theme.js';

test('sanitizes unknown theme preferences back to system', () => {
  assert.equal(sanitizeThemePreference('light'), 'light');
  assert.equal(sanitizeThemePreference('dark'), 'dark');
  assert.equal(sanitizeThemePreference('system'), 'system');
  assert.equal(sanitizeThemePreference('night'), 'system');
  assert.equal(sanitizeThemePreference(null), 'system');
});

test('resolves system preference to the detected concrete theme', () => {
  assert.equal(resolveThemePreference('system', 'dark'), 'dark');
  assert.equal(resolveThemePreference('system', 'light'), 'light');
  assert.equal(resolveThemePreference('light', 'dark'), 'light');
  assert.equal(resolveThemePreference('dark', 'light'), 'dark');
});

test('cycles theme preference through system, light and dark', () => {
  assert.equal(getNextThemePreference('system'), 'light');
  assert.equal(getNextThemePreference('light'), 'dark');
  assert.equal(getNextThemePreference('dark'), 'system');
  assert.equal(getNextThemePreference('unknown'), 'light');
});

test('sanitizes accent color choices to supported per-user palette', () => {
  assert.equal(sanitizeAccentColor('green'), 'green');
  assert.equal(sanitizeAccentColor('blue'), 'blue');
  assert.equal(sanitizeAccentColor('red'), 'red');
  assert.equal(sanitizeAccentColor('orange'), 'orange');
  assert.equal(sanitizeAccentColor('purple'), 'purple');
  assert.equal(sanitizeAccentColor('pink'), 'pink');
  assert.equal(sanitizeAccentColor('teal'), 'green');
  assert.equal(sanitizeAccentColor(null), 'green');
});
