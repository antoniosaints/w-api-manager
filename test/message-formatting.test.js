import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

const formatter = await importFormatter();

test('renders WhatsApp bold and italic markers inside message text', () => {
  const html = renderMessageText('Pedido *urgente* com _observacao_');

  assert.match(html, /Pedido /);
  assert.match(html, /<strong>urgente<\/strong>/);
  assert.match(html, /<em>observacao<\/em>/);
});

test('renders combined WhatsApp bold and italic markers', () => {
  const html = renderMessageText('Status *_muito importante_* agora');

  assert.match(html, /<strong><em>muito importante<\/em><\/strong>/);
});

test('renders WhatsApp quote lines with muted marker styling and inline formatting', () => {
  const html = renderMessageText('> *Prazo* _alterado_');

  assert.match(html, /message-text-quote/);
  assert.match(html, /<strong>Prazo<\/strong>/);
  assert.match(html, /<em>alterado<\/em>/);
});

test('keeps unmatched WhatsApp markers as plain escaped text', () => {
  const html = renderMessageText('Valor *pendente <script>alert(1)</script>');

  assert.doesNotMatch(html, /<strong>/);
  assert.match(html, /\*pendente/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

function renderMessageText(value) {
  assert.equal(typeof formatter?.renderFormattedMessageText, 'function', 'formatted message renderer should be available');
  return renderToStaticMarkup(formatter.renderFormattedMessageText(value));
}

async function importFormatter() {
  try {
    return await import('../src/components/chat/messageFormatting.js');
  } catch {
    return null;
  }
}
