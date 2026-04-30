import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const agentsSource = readFileSync(new URL('../src/pages/AgentsPanel.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('agents panel separates agents sectors and tags in tabs', () => {
  assert.match(agentsSource, /Tabs/);
  assert.match(agentsSource, /value="agents"/);
  assert.match(agentsSource, /value="sectors"/);
  assert.match(agentsSource, /value="tags"/);
  assert.match(agentsSource, /Agentes/);
  assert.match(agentsSource, /Setores/);
  assert.match(agentsSource, /Tags/);
});

test('agents sectors and tags use modal forms', () => {
  assert.match(agentsSource, /AgentFormModal/);
  assert.match(agentsSource, /SectorFormModal/);
  assert.match(agentsSource, /TagFormModal/);
  assert.match(agentsSource, /setAgentModal/);
  assert.match(agentsSource, /setSectorModal/);
  assert.match(agentsSource, /setTagModal/);
});

test('agents listing exposes compact operational metadata', () => {
  assert.match(stylesSource, /\.agents-tabs-shell/);
  assert.match(stylesSource, /\.agents-tabs/);
  assert.match(stylesSource, /\.agents-tabs-list/);
  assert.match(stylesSource, /\.agents-tab-trigger/);
  assert.match(stylesSource, /\.agent-row/);
  assert.match(stylesSource, /\.agent-meta-grid/);
});
