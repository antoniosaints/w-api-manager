import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('global UI font uses Roboto', () => {
  assert.match(stylesSource, /fonts\.googleapis\.com\/css2\?family=Roboto/);
  assert.match(stylesSource, /font-family:\s*"Roboto"/);
  assert.doesNotMatch(stylesSource, /font-family:\s*Inter/);
});
