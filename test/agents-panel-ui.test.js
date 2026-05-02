import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const agentsSource = readFileSync(new URL('../src/pages/AgentsPanel.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('agents panel separates agents sectors and tags in tabs', () => {
  assert.doesNotMatch(agentsSource, /components\/shadcn\/tabs/);
  assert.match(agentsSource, /role="tablist"/);
  assert.match(agentsSource, /setActiveTab\("agents"\)/);
  assert.match(agentsSource, /setActiveTab\("sectors"\)/);
  assert.match(agentsSource, /setActiveTab\("tags"\)/);
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
  assert.match(stylesSource, /\.agents-console/);
  assert.match(stylesSource, /\.agents-native-tabs/);
  assert.match(stylesSource, /\.agents-native-tab/);
  assert.match(stylesSource, /\.agents-management-toolbar/);
  assert.match(stylesSource, /\.agents-management-table/);
  assert.match(stylesSource, /\.agents-table-primary/);
});
