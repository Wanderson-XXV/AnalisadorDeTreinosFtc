import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLIPFARM_EXAMPLE_EVENT_CODE,
  CLIPFARM_EXAMPLE_EVENT_URL,
  getClipFarmExampleInputs,
} from './clipFarmHelp.ts';

test('provides a ClipFarm event URL example that can be pasted in the card', () => {
  assert.match(CLIPFARM_EXAMPLE_EVENT_URL, /^https:\/\/www\.clipfarm\.watch\/en\/events\/[a-z0-9]+$/);
});

test('provides the matching external event code example', () => {
  assert.equal(CLIPFARM_EXAMPLE_EVENT_CODE, 'FTCCMP1ROSS');
});

test('returns example inputs in the same shape used by the UI', () => {
  assert.deepEqual(getClipFarmExampleInputs(), {
    eventUrl: CLIPFARM_EXAMPLE_EVENT_URL,
    eventCode: CLIPFARM_EXAMPLE_EVENT_CODE,
  });
});
