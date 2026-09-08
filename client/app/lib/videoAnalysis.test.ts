import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeCycleIdAtVideoTime,
  buildMatchAnalysisStats,
  cycleEndTimestamp,
  cycleStartTimestamp,
  effectiveCycleDuration,
  formatVideoOffset,
  parseVideoOffsetInput,
  videoTimeForCycle,
} from './videoAnalysis.ts';
import type { ScoutingCycle } from './types.ts';

test('parses seconds and minute-second video offsets', () => {
  assert.equal(parseVideoOffsetInput('37.25'), 37250);
  assert.equal(parseVideoOffsetInput('00:37.2'), 37200);
  assert.equal(parseVideoOffsetInput('1:02'), 62000);
  assert.equal(parseVideoOffsetInput(''), null);
});

test('parses negative offsets when the video starts after the match', () => {
  assert.equal(parseVideoOffsetInput('-1'), -1000);
  assert.equal(parseVideoOffsetInput('-00:03.5'), -3500);
  assert.equal(parseVideoOffsetInput('-1:02'), -62000);
});

test('rejects invalid video offsets', () => {
  assert.equal(parseVideoOffsetInput('abc'), null);
  assert.equal(parseVideoOffsetInput('1:70'), null);
});

test('formats offsets for compact analysis UI', () => {
  assert.equal(formatVideoOffset(null), '00:00.0');
  assert.equal(formatVideoOffset(37250), '00:37.3');
  assert.equal(formatVideoOffset(-3500), '-00:03.5');
  assert.equal(formatVideoOffset(62000), '01:02.0');
});

test('calculates video time from media offset and cycle timestamp', () => {
  assert.equal(videoTimeForCycle(37250, 15000), 52.25);
  assert.equal(videoTimeForCycle(-3500, 15000), 11.5);
  assert.equal(videoTimeForCycle(null, 15000), 15);
});

const cycles = [
  { id: 'cycle-1', timestamp: 4800, duration: 4800 },
  { id: 'cycle-2', timestamp: 11700, duration: 6900 },
  { id: 'cycle-3', timestamp: 19900, duration: 8300 },
];

test('uses the previous cycle end as the next cycle start', () => {
  assert.equal(cycleStartTimestamp(cycles, 0), 0);
  assert.equal(cycleStartTimestamp(cycles, 1), 4800);
  assert.equal(cycleStartTimestamp(cycles, 2), 11700);
  assert.equal(cycleEndTimestamp(cycles, 2), 19900);
});

test('uses duration for the first cycle when scouting starts after match start', () => {
  const lateCycles = [
    { id: 'teleop-1', timestamp: 50_000, duration: 6_000 },
    { id: 'teleop-2', timestamp: 61_000, duration: 7_000 },
  ];

  assert.equal(cycleStartTimestamp(lateCycles, 0), 44_000);
  assert.equal(cycleStartTimestamp(lateCycles, 1), 54_000);
  assert.equal(activeCycleIdAtVideoTime(lateCycles, 0, 20), null);
  assert.equal(activeCycleIdAtVideoTime(lateCycles, 0, 45), 'teleop-1');
  assert.equal(activeCycleIdAtVideoTime(lateCycles, 0, 52), null);
  assert.equal(activeCycleIdAtVideoTime(lateCycles, 0, 55), 'teleop-2');
});

test('does not create negative cycle windows from inconsistent duration data', () => {
  const badCycles = [
    { id: 'bad-1', timestamp: 1_200, duration: 3_000 },
    { id: 'bad-2', timestamp: 4_200, duration: -1_000 },
  ];

  assert.equal(cycleStartTimestamp(badCycles, 0), 0);
  assert.equal(cycleEndTimestamp(badCycles, 0), 1_200);
  assert.equal(cycleStartTimestamp(badCycles, 1), 5_200);
  assert.equal(cycleEndTimestamp(badCycles, 1), 5_200);
  assert.equal(activeCycleIdAtVideoTime(badCycles, 0, 4.5), null);
});

test('finds the active cycle from video time and media offset', () => {
  assert.equal(activeCycleIdAtVideoTime(cycles, 0, 0.5), 'cycle-1');
  assert.equal(activeCycleIdAtVideoTime(cycles, 0, 5), 'cycle-2');
  assert.equal(activeCycleIdAtVideoTime(cycles, 0, 15), 'cycle-3');
  assert.equal(activeCycleIdAtVideoTime(cycles, -3500, 1.5), 'cycle-2');
  assert.equal(activeCycleIdAtVideoTime(cycles, 0, 22), null);
});

test('removes the configured autonomous pause from the first teleop cycle', () => {
  const pausedCycles = [
    { id: 'auto-7', timestamp: 29_000, duration: 4_089, is_autonomous: true, time_interval: 'auto' },
    { id: 'teleop-8', timestamp: 47_291, duration: 18_291, is_autonomous: false, time_interval: '0-30s' },
    { id: 'teleop-9', timestamp: 51_881, duration: 4_590, is_autonomous: false, time_interval: '0-30s' },
  ];
  const options = { transitionDurationMs: 15_000 };

  assert.equal(cycleStartTimestamp(pausedCycles, 1, options), 45_000);
  assert.equal(effectiveCycleDuration(pausedCycles, 1, options), 2_291);
  assert.equal(activeCycleIdAtVideoTime(pausedCycles, 6_000, 50.9, options), null);
  assert.equal(activeCycleIdAtVideoTime(pausedCycles, 6_000, 51, options), 'teleop-8');
  assert.equal(activeCycleIdAtVideoTime(pausedCycles, 6_000, 53.3, options), 'teleop-9');
});

function makeCycle(overrides: Partial<ScoutingCycle>): ScoutingCycle {
  return {
    id: 'cycle',
    scouting_round_id: 'round-1',
    cycle_number: 1,
    duration: 5_000,
    timestamp: 5_000,
    time_interval: '0-30s',
    is_autonomous: false,
    hits: 0,
    misses: 0,
    zone: null,
    ...overrides,
  };
}

test('summarizes autonomous and teleop cycles separately', () => {
  const stats = buildMatchAnalysisStats([
    makeCycle({
      id: 'auto-1',
      cycle_number: 1,
      is_autonomous: true,
      time_interval: 'auto',
      duration: 7_000,
      timestamp: 12_000,
      hits: 2,
      misses: 1,
    }),
    makeCycle({
      id: 'teleop-1',
      cycle_number: 2,
      time_interval: '0-30s',
      duration: 6_000,
      timestamp: 51_000,
      hits: 3,
      misses: 0,
    }),
    makeCycle({
      id: 'teleop-2',
      cycle_number: 3,
      time_interval: '30-60s',
      duration: 9_000,
      timestamp: 82_000,
      hits: 1,
      misses: 2,
    }),
  ]);

  assert.deepEqual(stats.auto, {
    cycles: 1,
    hits: 2,
    misses: 1,
    avgDuration: 7_000,
    hitRate: 2 / 3,
  });
  assert.deepEqual(stats.teleop, {
    cycles: 2,
    hits: 4,
    misses: 2,
    avgDuration: 7_500,
    hitRate: 4 / 6,
  });
});

test('groups teleop cycles by 30 second intervals', () => {
  const stats = buildMatchAnalysisStats([
    makeCycle({ id: 'auto', is_autonomous: true, time_interval: 'auto', hits: 1 }),
    makeCycle({ id: '0-30', time_interval: '0-30s', duration: 6_000, hits: 3, misses: 0 }),
    makeCycle({ id: '30-60', time_interval: '30-60s', duration: 8_000, hits: 1, misses: 1 }),
    makeCycle({ id: '60-90', time_interval: '60-90s', duration: 10_000, hits: 0, misses: 2 }),
    makeCycle({ id: '90-120', time_interval: '90-120s', duration: 12_000, hits: 2, misses: 0 }),
  ]);

  assert.deepEqual(
    stats.teleopIntervals.map(({ interval, cycles, hits, misses, avgDuration }) => ({
      interval,
      cycles,
      hits,
      misses,
      avgDuration,
    })),
    [
      { interval: '0-30s', cycles: 1, hits: 3, misses: 0, avgDuration: 6_000 },
      { interval: '30-60s', cycles: 1, hits: 1, misses: 1, avgDuration: 8_000 },
      { interval: '60-90s', cycles: 1, hits: 0, misses: 2, avgDuration: 10_000 },
      { interval: '90-120s', cycles: 1, hits: 2, misses: 0, avgDuration: 12_000 },
    ],
  );
});

test('finds fastest and slowest cycles from teleop only', () => {
  const autoFast = makeCycle({
    id: 'auto-fast',
    cycle_number: 1,
    is_autonomous: true,
    time_interval: 'auto',
    duration: 2_000,
  });
  const teleopFast = makeCycle({
    id: 'teleop-fast',
    cycle_number: 2,
    time_interval: '0-30s',
    duration: 5_000,
  });
  const teleopSlow = makeCycle({
    id: 'teleop-slow',
    cycle_number: 3,
    time_interval: '30-60s',
    duration: 11_000,
  });

  const stats = buildMatchAnalysisStats([autoFast, teleopSlow, teleopFast]);

  assert.equal(stats.fastestTeleopCycle?.id, 'teleop-fast');
  assert.equal(stats.slowestTeleopCycle?.id, 'teleop-slow');
});

test('uses timestamp fallback for missing teleop intervals', () => {
  const stats = buildMatchAnalysisStats([
    makeCycle({
      id: 'auto',
      is_autonomous: true,
      time_interval: '',
      timestamp: 20_000,
    }),
    makeCycle({
      id: 'fallback-0-30',
      time_interval: '',
      timestamp: 50_000,
      duration: 6_000,
      hits: 2,
    }),
    makeCycle({
      id: 'fallback-30-60',
      time_interval: '',
      timestamp: 79_000,
      duration: 9_000,
      hits: 1,
    }),
  ], { transitionDurationMs: 15_000 });

  assert.deepEqual(
    stats.teleopIntervals.map(({ interval, cycles, hits }) => ({ interval, cycles, hits })),
    [
      { interval: '0-30s', cycles: 1, hits: 2 },
      { interval: '30-60s', cycles: 1, hits: 1 },
      { interval: '60-90s', cycles: 0, hits: 0 },
      { interval: '90-120s', cycles: 0, hits: 0 },
    ],
  );
});

test('reclassifies stored teleop intervals from full match timestamps', () => {
  const stats = buildMatchAnalysisStats([
    makeCycle({
      id: 'auto',
      is_autonomous: true,
      time_interval: 'auto',
      timestamp: 30_000,
    }),
    makeCycle({
      id: 'early-teleop',
      time_interval: '30-60s',
      timestamp: 50_000,
      duration: 5_000,
      hits: 2,
    }),
  ], { transitionDurationMs: 15_000 });

  assert.deepEqual(
    stats.teleopIntervals.map(({ interval, cycles, hits }) => ({ interval, cycles, hits })),
    [
      { interval: '0-30s', cycles: 1, hits: 2 },
      { interval: '30-60s', cycles: 0, hits: 0 },
      { interval: '60-90s', cycles: 0, hits: 0 },
      { interval: '90-120s', cycles: 0, hits: 0 },
    ],
  );
});
