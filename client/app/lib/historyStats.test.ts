import assert from 'node:assert/strict';
import test from 'node:test';

import type { RoundData } from './types.ts';
import { buildRoundHistoryStats } from './historyStats.ts';

function makeRound(overrides: Partial<RoundData> = {}): RoundData {
  return {
    id: 'round-1',
    startTime: '2026-07-07T10:00:00Z',
    endTime: null,
    observations: null,
    totalDuration: 165_000,
    transitionDurationMs: 15_000,
    cycles: [],
    roundType: 'full_match',
    batteryName: null,
    batteryVolts: null,
    strategy: null,
    ...overrides,
  };
}

test('summarizes full match hits and misses by period and teleop interval', () => {
  const round = makeRound({
    cycles: [
      {
        id: 'cycle-auto',
        roundId: 'round-1',
        cycleNumber: 1,
        duration: 8_000,
        hits: 2,
        misses: 1,
        timestamp: 12_000,
        timeInterval: 'auto',
        zone: 'near',
        isAutonomous: true,
      },
      {
        id: 'cycle-0-30',
        roundId: 'round-1',
        cycleNumber: 2,
        duration: 6_000,
        hits: 3,
        misses: 0,
        timestamp: 50_000,
        timeInterval: '0-30s',
        zone: 'near',
        isAutonomous: false,
      },
      {
        id: 'cycle-30-60',
        roundId: 'round-1',
        cycleNumber: 3,
        duration: 7_000,
        hits: 1,
        misses: 2,
        timestamp: 82_000,
        timeInterval: '30-60s',
        zone: 'far',
        isAutonomous: false,
      },
      {
        id: 'cycle-60-90',
        roundId: 'round-1',
        cycleNumber: 4,
        duration: 9_000,
        hits: 4,
        misses: 1,
        timestamp: 111_000,
        timeInterval: '60-90s',
        zone: 'far',
        isAutonomous: false,
      },
      {
        id: 'cycle-90-120',
        roundId: 'round-1',
        cycleNumber: 5,
        duration: 10_000,
        hits: 0,
        misses: 3,
        timestamp: 146_000,
        timeInterval: '90-120s',
        zone: null,
        isAutonomous: false,
      },
    ],
  });

  const stats = buildRoundHistoryStats(round);

  assert.deepEqual(stats.periodStats.auto, {
    cycles: 1,
    hits: 2,
    misses: 1,
  });
  assert.deepEqual(stats.periodStats.teleop, {
    cycles: 4,
    hits: 8,
    misses: 6,
  });
  assert.deepEqual(
    stats.intervalStats.map(({ interval, cycles, hits, misses }) => ({
      interval,
      cycles,
      hits,
      misses,
    })),
    [
      { interval: '0-30s', cycles: 1, hits: 3, misses: 0 },
      { interval: '30-60s', cycles: 1, hits: 1, misses: 2 },
      { interval: '60-90s', cycles: 1, hits: 4, misses: 1 },
      { interval: '90-120s', cycles: 1, hits: 0, misses: 3 },
    ],
  );
});
