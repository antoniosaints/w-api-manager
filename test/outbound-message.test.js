import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMessageNameHeader } from '../server/outbound-message.js';

test('message name header prefixes outbound text when preference is active', () => {
  assert.equal(
    applyMessageNameHeader('Preciso confirmar o pedido.', { name: 'Marina Costa', sendNameHeader: true }),
    '> *_Marina Costa_* \nPreciso confirmar o pedido.'
  );
});

test('message name header leaves outbound text untouched when preference is inactive', () => {
  assert.equal(
    applyMessageNameHeader('Preciso confirmar o pedido.', { name: 'Marina Costa', sendNameHeader: false }),
    'Preciso confirmar o pedido.'
  );
});

test('message name header does not duplicate an existing header', () => {
  assert.equal(
    applyMessageNameHeader('> *_Marina Costa_* \nPreciso confirmar o pedido.', { name: 'Marina Costa', sendNameHeader: true }),
    '> *_Marina Costa_* \nPreciso confirmar o pedido.'
  );
});
