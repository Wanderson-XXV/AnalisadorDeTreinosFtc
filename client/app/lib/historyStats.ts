import type { CycleData, RoundData } from './types';

export const HISTORY_TELEOP_INTERVALS = ['0-30s', '30-60s', '60-90s', '90-120s'] as const;

export type HistoryTeleopInterval = typeof HISTORY_TELEOP_INTERVALS[number];

export interface HistoryCountBucket {
  cycles: number;
  hits: number;
  misses: number;
}

export interface HistoryIntervalStats extends HistoryCountBucket {
  interval: HistoryTeleopInterval;
}

export interface RoundHistoryStats {
  totalCycles: number;
  avgTime: number;
  hits: number;
  misses: number;
  nearCycles: number;
  farCycles: number;
  autoCycles: number;
  periodStats: {
    auto: HistoryCountBucket;
    teleop: HistoryCountBucket;
  };
  intervalStats: HistoryIntervalStats[];
}

function createBucket(): HistoryCountBucket {
  return {
    cycles: 0,
    hits: 0,
    misses: 0,
  };
}

function addCycleToBucket(bucket: HistoryCountBucket, cycle: CycleData): void {
  bucket.cycles += 1;
  bucket.hits += cycle.hits ?? 0;
  bucket.misses += cycle.misses ?? 0;
}

function isTeleopInterval(interval: string): interval is HistoryTeleopInterval {
  return HISTORY_TELEOP_INTERVALS.includes(interval as HistoryTeleopInterval);
}

function isAutonomousCycle(cycle: CycleData): boolean {
  return cycle.isAutonomous || cycle.timeInterval === 'auto';
}

function isTeleopPeriodCycle(round: RoundData, cycle: CycleData): boolean {
  if (isAutonomousCycle(cycle)) return false;
  if (round.roundType !== 'full_match') return true;
  return isTeleopInterval(cycle.timeInterval);
}

export function buildRoundHistoryStats(round: RoundData): RoundHistoryStats {
  const cycles = round.cycles ?? [];
  const periodStats = {
    auto: createBucket(),
    teleop: createBucket(),
  };
  const intervalStats = HISTORY_TELEOP_INTERVALS.map((interval) => ({
    interval,
    ...createBucket(),
  }));
  const intervalStatsByName = new Map(
    intervalStats.map((stats) => [stats.interval, stats]),
  );

  let totalDuration = 0;
  let hits = 0;
  let misses = 0;
  let nearCycles = 0;
  let farCycles = 0;
  let autoCycles = 0;

  for (const cycle of cycles) {
    totalDuration += cycle.duration ?? 0;
    hits += cycle.hits ?? 0;
    misses += cycle.misses ?? 0;

    if (cycle.zone === 'near') nearCycles += 1;
    if (cycle.zone === 'far') farCycles += 1;

    if (isAutonomousCycle(cycle)) {
      autoCycles += 1;
      addCycleToBucket(periodStats.auto, cycle);
    } else if (isTeleopPeriodCycle(round, cycle)) {
      addCycleToBucket(periodStats.teleop, cycle);
    }

    if (isTeleopInterval(cycle.timeInterval)) {
      addCycleToBucket(intervalStatsByName.get(cycle.timeInterval)!, cycle);
    }
  }

  return {
    totalCycles: cycles.length,
    avgTime: cycles.length > 0 ? totalDuration / cycles.length : 0,
    hits,
    misses,
    nearCycles,
    farCycles,
    autoCycles,
    periodStats,
    intervalStats,
  };
}
