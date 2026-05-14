import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLaunchRouteSelection } from '../src/app/runtime-effects.js';

test('launch route without a session is consumed after applying the requested view once', () => {
  const result = resolveLaunchRouteSelection({
    pendingRoute: { view: 'inbox', sessionId: '' },
    conversations: []
  });

  assert.equal(result.view, 'inbox');
  assert.equal(result.sessionId, '');
  assert.equal(result.clearRoute, true);
  assert.equal(result.nextRoute, null);
});

test('launch route waiting for a session does not reapply the view on later conversation updates', () => {
  const first = resolveLaunchRouteSelection({
    pendingRoute: { view: 'inbox', sessionId: 'session-1' },
    conversations: []
  });

  assert.equal(first.view, 'inbox');
  assert.equal(first.sessionId, '');
  assert.equal(first.clearRoute, false);
  assert.deepEqual(first.nextRoute, { view: 'inbox', sessionId: 'session-1', viewApplied: true });

  const second = resolveLaunchRouteSelection({
    pendingRoute: first.nextRoute,
    conversations: [{ id: 'session-2' }]
  });

  assert.equal(second.view, '');
  assert.equal(second.sessionId, '');
  assert.equal(second.clearRoute, false);
  assert.deepEqual(second.nextRoute, { view: 'inbox', sessionId: 'session-1', viewApplied: true });
});

test('launch route selects and clears the pending session when the conversation is available', () => {
  const result = resolveLaunchRouteSelection({
    pendingRoute: { view: 'inbox', sessionId: 'session-1', viewApplied: true },
    conversations: [{ id: 'session-1' }]
  });

  assert.equal(result.view, '');
  assert.equal(result.sessionId, 'session-1');
  assert.equal(result.clearRoute, true);
  assert.equal(result.nextRoute, null);
});
