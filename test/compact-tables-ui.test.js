import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contactsSource = readFileSync(new URL('../src/pages/ContactsPanel.jsx', import.meta.url), 'utf8');
const usersSource = readFileSync(new URL('../src/pages/UsersPanel.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('contacts table renders Portuguese status labels', () => {
  assert.match(contactsSource, /CONTACT_STATUS_LABELS/);
  assert.match(contactsSource, /active:\s*'Ativo'/);
  assert.match(contactsSource, /lead:\s*'Lead'/);
  assert.match(contactsSource, /inactive:\s*'Inativo'/);
  assert.doesNotMatch(contactsSource, />\{contact\.status\}<\/Badge>/);
});

test('contacts and users tables use compact density', () => {
  assert.match(contactsSource, /density="compact"/);
  assert.match(usersSource, /density="compact"/);
  assert.match(stylesSource, /\.data-table\.density-compact th,\s*\.data-table\.density-compact td[\s\S]*padding:\s*8px 10px/);
});
