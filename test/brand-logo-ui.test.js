import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const loginSource = readFileSync(new URL('../src/pages/LoginScreen.jsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('system logo is available as a public asset and browser icon', () => {
  assert.equal(existsSync(new URL('../public/ura-logo.png', import.meta.url)), true);
  assert.match(indexSource, /<link rel="icon" type="image\/png" href="\/ura-logo\.png" \/>/);
});

test('login and sidebar use the URA logo instead of generic brand icons', () => {
  assert.match(loginSource, /<img className="auth-logo" src="\/ura-logo\.png" alt="Logo URA" \/>/);
  assert.match(loginSource, /<h1>URA Atendimento<\/h1>/);
  assert.doesNotMatch(loginSource, /PlugZap/);

  assert.match(shellSource, /<img className="brand-logo" src="\/ura-logo\.png" alt="Logo URA" \/>/);
  assert.match(shellSource, /<strong>URA Atendimento<\/strong>/);
  assert.doesNotMatch(shellSource, /LucideMessageCircleDashed/);
});

test('logo treatments have stable dimensions in app chrome and login', () => {
  assert.match(stylesSource, /\.brand-logo\s*\{/);
  assert.match(stylesSource, /\.auth-logo\s*\{/);
  assert.match(stylesSource, /object-fit:\s*contain/);
  assert.match(stylesSource, /box-shadow:\s*var\(--shadow-soft\)/);
});
