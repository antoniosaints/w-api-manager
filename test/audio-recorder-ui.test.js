import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatWindowSource = readFileSync(new URL('../src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('composer exposes microphone recording controls for outbound audio', () => {
  assert.match(chatWindowSource, /MediaRecorder/);
  assert.match(chatWindowSource, /recordingState/);
  assert.match(chatWindowSource, /startAudioRecording/);
  assert.match(chatWindowSource, /stopAudioRecording/);
  assert.match(chatWindowSource, /cancelAudioRecording/);
  assert.match(chatWindowSource, /Mic/);
  assert.match(chatWindowSource, /Square/);
});

test('audio recorder has compact composer states', () => {
  assert.match(stylesSource, /\.record-button/);
  assert.match(stylesSource, /\.recording-preview/);
  assert.match(stylesSource, /\.recording-timer/);
});
