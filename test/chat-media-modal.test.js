import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const messageBubbleSource = readFileSync(new URL('../src/components/chat/MessageBubble.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('chat image preview opens through an in-app modal trigger', () => {
  assert.match(messageBubbleSource, /function MediaModal/);
  assert.match(messageBubbleSource, /className="message-image-button"/);
  assert.match(messageBubbleSource, /onOpenMedia\?\./);
  assert.doesNotMatch(messageBubbleSource, /className="message-image-link"/);
});

test('chat image preview is size-limited and has modal styles', () => {
  assert.match(stylesSource, /\.bubble\.with-media[\s\S]*width:\s*min\(330px,\s*54%\)/);
  assert.match(stylesSource, /\.message-image[\s\S]*max-height:\s*330px/);
  assert.match(stylesSource, /\.media-modal/);
  assert.match(stylesSource, /\.media-modal-panel img/);
});

test('sticker messages use a smaller bubble and a concise label', () => {
  assert.match(messageBubbleSource, /isStickerMessage\(message\)/);
  assert.match(messageBubbleSource, /Figurinha/);
  assert.match(stylesSource, /\.bubble\.is-sticker[\s\S]*width:\s*min\(180px,\s*42%\)/);
  assert.match(stylesSource, /\.bubble\.is-sticker \.message-image[\s\S]*max-height:\s*156px/);
});

test('chat renders audio, video and document media with dedicated controls', () => {
  assert.match(messageBubbleSource, /getMessageMedia\(message\)/);
  assert.match(messageBubbleSource, /className="message-audio"/);
  assert.match(messageBubbleSource, /className="message-video"/);
  assert.match(messageBubbleSource, /className="message-document"/);
  assert.match(stylesSource, /\.message-audio/);
  assert.match(stylesSource, /\.message-video/);
  assert.match(stylesSource, /\.message-document/);
});

test('audio messages render with WaveSurfer instead of the native audio control', () => {
  assert.ok(packageJson.dependencies['wavesurfer.js']);
  assert.doesNotMatch(`${mainSource}\n${messageBubbleSource}`, /vidstack/i);
  assert.match(messageBubbleSource, /WaveSurfer\.create/);
  assert.match(messageBubbleSource, /function WaveformAudioPlayer/);
  assert.match(messageBubbleSource, /className="message-audio-waveform"/);
  assert.doesNotMatch(messageBubbleSource, /<audio\s+controls/);
});

test('audio bubbles stay compact without media heading or automatic caption', () => {
  assert.doesNotMatch(messageBubbleSource, /media\?\.type === 'audio'[\s\S]*message-media-heading/);
  assert.match(messageBubbleSource, /shouldRenderMediaCaption/);
  assert.match(messageBubbleSource, /media\?\.type !== 'audio'/);
  assert.match(stylesSource, /\.bubble\.media-audio[\s\S]*width:\s*min\(360px,\s*58%\)/);
  assert.match(stylesSource, /\.message-audio[\s\S]*gap:\s*0/);
});
