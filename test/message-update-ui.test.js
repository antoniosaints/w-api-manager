import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

test('message updates replace existing local bubbles by id or external id', () => {
  assert.match(mainSource, /mergeMessageUpdate/);
  assert.match(mainSource, /externalId/);
  assert.doesNotMatch(mainSource, /setMessages\(\(current\) => appendUnique\(current, message\)\)/);
});

test('dev server proxies uploaded media paths used by chat previews', () => {
  assert.match(viteConfig, /['"]\/uploads['"]/);
});
