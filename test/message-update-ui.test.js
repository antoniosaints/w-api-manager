import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('message updates replace existing local bubbles by id or external id', () => {
  assert.match(mainSource, /mergeMessageUpdate/);
  assert.match(mainSource, /externalId/);
  assert.doesNotMatch(mainSource, /setMessages\(\(current\) => appendUnique\(current, message\)\)/);
});
