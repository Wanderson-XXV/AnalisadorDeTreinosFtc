import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_TRANSITION_DURATION_MS,
  createMatchTiming,
  getAudioEventsForRound,
  getCycleMarkTiming,
  getCycleTimeInterval,
  getMatchPhase,
} from './matchTiming.ts';

test('defaults to a 15 second transition between autonomous and teleop', () => {
  const timing = createMatchTiming();

  assert.equal(DEFAULT_TRANSITION_DURATION_MS, 15_000);
  assert.equal(timing.teleopStartMs, 45_000);
  assert.equal(timing.fullMatchDurationMs, 165_000);
  assert.equal(getMatchPhase(44_999, 'full_match', timing), 'transition');
  assert.equal(getMatchPhase(45_000, 'full_match', timing), 'teleop');
});

test('marks a cycle during transition as the final autonomous cycle without negative duration', () => {
  const timing = createMatchTiming({ transitionDurationMs: 15_000 });
  const mark = getCycleMarkTiming({
    currentTimeMs: 35_000,
    lastCycleEndMs: 12_000,
    phase: 'transition',
    timing,
  });

  assert.equal(mark.timestamp, 29_000);
  assert.equal(mark.duration, 17_000);
});

test('marks a teleop cycle from the configured teleop start after the transition', () => {
  const timing = createMatchTiming({ transitionDurationMs: 15_000 });
  const mark = getCycleMarkTiming({
    currentTimeMs: 52_000,
    lastCycleEndMs: timing.teleopStartMs,
    phase: 'teleop',
    timing,
  });

  assert.equal(mark.timestamp, 52_000);
  assert.equal(mark.duration, 7_000);
});

test('never includes the autonomous pause in a teleop cycle duration', () => {
  const timing = createMatchTiming({ transitionDurationMs: 15_000 });
  const mark = getCycleMarkTiming({
    currentTimeMs: 47_291,
    lastCycleEndMs: 29_000,
    phase: 'teleop',
    timing,
  });

  assert.equal(mark.timestamp, 47_291);
  assert.equal(mark.duration, 2_291);
});

test('can calculate the old 8 second transition without changing autonomous or teleop lengths', () => {
  const timing = createMatchTiming({ transitionDurationMs: 8_000 });

  assert.equal(timing.teleopStartMs, 38_000);
  assert.equal(timing.fullMatchDurationMs, 158_000);
  assert.equal(getMatchPhase(37_999, 'full_match', timing), 'transition');
  assert.equal(getMatchPhase(38_000, 'full_match', timing), 'teleop');
});

test('classifies full match cycle intervals from teleop start, not from absolute match time', () => {
  const timing = createMatchTiming({ transitionDurationMs: 15_000 });

  assert.equal(getCycleTimeInterval(29_999, 'full_match', timing), 'auto');
  assert.equal(getCycleTimeInterval(30_000, 'full_match', timing), 'transition');
  assert.equal(getCycleTimeInterval(44_999, 'full_match', timing), 'transition');
  assert.equal(getCycleTimeInterval(45_000, 'full_match', timing), '0-30s');
  assert.equal(getCycleTimeInterval(75_000, 'full_match', timing), '30-60s');
  assert.equal(getCycleTimeInterval(105_000, 'full_match', timing), '60-90s');
  assert.equal(getCycleTimeInterval(135_000, 'full_match', timing), '90-120s');
});

test('moves full match sounds when the transition duration changes', () => {
  const defaultEvents = Object.fromEntries(
    getAudioEventsForRound('full_match', { transitionDurationMs: 15_000 }).map(event => [
      event.description,
      event.timestamp,
    ]),
  );
  const oldEvents = Object.fromEntries(
    getAudioEventsForRound('full_match', { transitionDurationMs: 8_000 }).map(event => [
      event.description,
      event.timestamp,
    ]),
  );

  assert.equal(defaultEvents['inicio teleop'], 40_500);
  assert.equal(defaultEvents.endgame, 135_000);
  assert.equal(defaultEvents['10s'], 154_000);
  assert.equal(defaultEvents['Fim da partida completa'], 160_000);

  assert.equal(oldEvents['inicio teleop'], 33_500);
  assert.equal(oldEvents.endgame, 128_000);
  assert.equal(oldEvents['10s'], 147_000);
  assert.equal(oldEvents['Fim da partida completa'], 153_000);
});
