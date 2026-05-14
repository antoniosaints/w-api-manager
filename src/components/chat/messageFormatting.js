import React from 'react';

const MARKER_TAGS = {
  '*': 'strong',
  _: 'em'
};

export function renderFormattedMessageText(value) {
  const lines = String(value ?? '').split(/\r?\n/);

  return React.createElement(
    'div',
    { className: 'message-text' },
    lines.map((line, index) => renderLine(line, index))
  );
}

function renderLine(line, index) {
  const quote = parseQuoteLine(line);
  const text = quote ? quote.text : line;
  const className = [
    'message-text-line',
    quote ? 'message-text-quote' : '',
    text ? '' : 'message-text-empty'
  ].filter(Boolean).join(' ');

  return React.createElement(
    'span',
    { key: `line-${index}`, className },
    renderInline(text, `line-${index}`)
  );
}

function parseQuoteLine(line) {
  const match = String(line).match(/^>\s?(.*)$/);
  return match ? { text: match[1] } : null;
}

function renderInline(text, keyPrefix) {
  const nodes = parseInlineSegment(String(text), keyPrefix);
  return nodes.length ? nodes : '';
}

function parseInlineSegment(text, keyPrefix) {
  const nodes = [];
  let index = 0;
  let nodeIndex = 0;

  while (index < text.length) {
    const opening = findNextOpeningMarker(text, index);
    if (!opening) {
      pushText(nodes, text.slice(index));
      break;
    }

    const closingIndex = findClosingMarker(text, opening.marker, opening.index + 1);
    if (closingIndex === -1) {
      pushText(nodes, text.slice(index));
      break;
    }

    const innerText = text.slice(opening.index + 1, closingIndex);
    if (!innerText.trim()) {
      pushText(nodes, text.slice(index, closingIndex + 1));
      index = closingIndex + 1;
      continue;
    }

    pushText(nodes, text.slice(index, opening.index));
    const tag = MARKER_TAGS[opening.marker];
    const key = `${keyPrefix}-format-${nodeIndex++}`;
    nodes.push(React.createElement(tag, { key }, parseInlineSegment(innerText, key)));
    index = closingIndex + 1;
  }

  return nodes;
}

function findNextOpeningMarker(text, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    const marker = text[index];
    if (MARKER_TAGS[marker] && isOpeningMarker(text, index, marker)) {
      return { marker, index };
    }
  }

  return null;
}

function findClosingMarker(text, marker, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    if (text[index] === marker && isClosingMarker(text, index, marker)) {
      return index;
    }
  }

  return -1;
}

function isOpeningMarker(text, index, marker) {
  const previous = text[index - 1] || '';
  const next = text[index + 1] || '';
  if (!next || /\s/.test(next) || next === marker) return false;
  return !isWordCharacter(previous);
}

function isClosingMarker(text, index, marker) {
  const previous = text[index - 1] || '';
  const next = text[index + 1] || '';
  if (!previous || /\s/.test(previous) || previous === marker) return false;
  return !isWordCharacter(next);
}

function isWordCharacter(value) {
  return /[\p{L}\p{N}]/u.test(value);
}

function pushText(nodes, value) {
  if (value) nodes.push(value);
}
