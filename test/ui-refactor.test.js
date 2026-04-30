import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8');
const uiIndexSource = readFileSync(new URL('../src/components/ui/index.js', import.meta.url), 'utf8');

test('app exposes contacts navigation and page wiring', () => {
  assert.match(mainSource, /'contacts'/);
  assert.match(mainSource, /Contatos/);
  assert.match(mainSource, /ContactsPanel/);
});

test('management tables expose delete actions and chat switch loading state', () => {
  assert.match(mainSource, /chatLoading/);
  assert.match(mainSource, /Carregando mensagens/);
  assert.match(mainSource, /onDeleteContact/);
  assert.match(mainSource, /onDeleteUser/);
});

test('reusable UI component files exist for the form system', () => {
  const files = [
    '../src/components/ui/Button.jsx',
    '../src/components/ui/Input.jsx',
    '../src/components/ui/Select.jsx',
    '../src/components/ui/Checkbox.jsx',
    '../src/components/ui/Switch.jsx',
    '../src/components/ui/Badge.jsx',
    '../src/components/ui/Toggle.jsx',
    '../src/components/ui/Modal.jsx',
    '../src/components/ui/Table.jsx',
    '../src/components/ui/Pagination.jsx',
    '../src/components/ui/SearchField.jsx',
    '../src/components/ui/FormField.jsx',
    '../src/components/ui/Card.jsx',
    '../src/components/shadcn/card.jsx'
  ];

  for (const file of files) {
    assert.equal(existsSync(new URL(file, import.meta.url)), true, `${file} should exist`);
  }
});

test('main module is reduced by moving UI, shell or page code into modules', () => {
  const lines = mainSource.split('\n').length;
  assert.ok(lines < 1500, `main.jsx should be below 1500 lines after refactor, got ${lines}`);
});

test('non-chat app chrome and dashboard controls are shadcn-backed', () => {
  assert.match(uiIndexSource, /export \{ Card \} from '\.\/Card\.jsx'/);
  assert.match(mainSource, /Card,\s*SearchField,\s*Select/);
  assert.doesNotMatch(mainSource, /<select value=\{periodFilter\}/);
  assert.doesNotMatch(mainSource, /<label className="search-box">[\s\S]*Buscar historico/);
  assert.match(shellSource, /import \{ Button \} from '\.\/ui\/index\.js'/);
  assert.doesNotMatch(shellSource, /<button className="theme-button"/);
  assert.doesNotMatch(shellSource, /<button className=\{connected \? 'status-pill connected' : 'status-pill'\}/);
});
