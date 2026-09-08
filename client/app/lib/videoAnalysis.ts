import { createMatchTiming, getCycleTimeInterval } from './matchTiming.ts';
import type { ScoutingCycle } from './types.ts';

export const ANALYSIS_TELEOP_INTERVALS = ['0-30s', '30-60s', '60-90s', '90-120s'] as const;

export type AnalysisTeleopInterval = typeof ANALYSIS_TELEOP_INTERVALS[number];

export interface AnalysisPeriodStats {
  cycles: number;
  hits: number;
  misses: number;
  avgDuration: number;
  hitRate: number;
}

export interface AnalysisIntervalStats extends AnalysisPeriodStats {
  interval: AnalysisTeleopInterval;
}

export interface MatchAnalysisStats {
  auto: AnalysisPeriodStats;
  teleop: AnalysisPeriodStats;
  teleopIntervals: AnalysisIntervalStats[];
  fastestTeleopCycle: ScoutingCycle | null;
  slowestTeleopCycle: ScoutingCycle | null;
}

export function parseVideoOffsetInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const unsigned = trimmed.startsWith('-') || trimmed.startsWith('+')
    ? trimmed.slice(1).trim()
    : trimmed;
  if (!unsigned) return null;

  if (unsigned.includes(':')) {
    const parts = unsigned.split(':');
    if (parts.length !== 2) return null;
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1].replace(',', '.'));
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (minutes < 0 || seconds < 0 || seconds >= 60) return null;
    return sign * Math.round(((minutes * 60) + seconds) * 1000);
  }

  const seconds = Number(unsigned.replace(',', '.'));
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return sign * Math.round(seconds * 1000);
}

export function formatVideoOffset(value: number | null | undefined): string {
  const rawMs = Math.round(value ?? 0);
  const sign = rawMs < 0 ? '-' : '';
  const totalMs = Math.abs(rawMs);
  const totalSeconds = totalMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - (minutes * 60);
  return `${sign}${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}

export function videoTimeForCycle(
  videoMatchStartMs: number | null | undefined,
  cycleTimestampMs: number | null | undefined,
): number {
  return ((videoMatchStartMs ?? 0) + (cycleTimestampMs ?? 0)) / 1000;
}

export interface CycleTimingLike {
  id: string;
  timestamp: number;
  duration?: number | null;
  is_autonomous?: boolean | number | null;
  time_interval?: string | null;
}

export interface CycleTimelineOptions {
  transitionDurationMs?: number | null;
}

function isAutonomousTimingCycle(cycle: CycleTimingLike | undefined): boolean {
  return !!cycle && (!!cycle.is_autonomous || cycle.time_interval === 'auto');
}

export function cycleEndTimestamp(cycles: CycleTimingLike[], index: number): number {
  const cycle = cycles[index];
  if (!cycle) return 0;

  return Math.max(cycleStartTimestamp(cycles, index), cycle.timestamp ?? 0);
}

export function cycleStartTimestamp(
  cycles: CycleTimingLike[],
  index: number,
  options: CycleTimelineOptions = {},
): number {
  const cycle = cycles[index];
  if (!cycle) return 0;

  const cycleEnd = cycle.timestamp ?? 0;
  const durationStart = cycleEnd - (cycle.duration ?? 0);
  const previousEnd = index > 0 ? cycles[index - 1]?.timestamp ?? 0 : 0;

  const hasAutonomousPeriod = cycles.some(isAutonomousTimingCycle);
  const phaseStart = hasAutonomousPeriod && !isAutonomousTimingCycle(cycle)
    ? createMatchTiming({ transitionDurationMs: options.transitionDurationMs }).teleopStartMs
    : 0;

  return Math.max(0, previousEnd, durationStart, phaseStart);
}

export function effectiveCycleDuration(
  cycles: CycleTimingLike[],
  index: number,
  options: CycleTimelineOptions = {},
): number {
  const cycle = cycles[index];
  if (!cycle) return 0;

  const isFirstTeleopCycle = !isAutonomousTimingCycle(cycle)
    && cycles.slice(0, index).some(isAutonomousTimingCycle)
    && !cycles.slice(0, index).some(previous => !isAutonomousTimingCycle(previous));

  if (isFirstTeleopCycle) {
    const timing = createMatchTiming({ transitionDurationMs: options.transitionDurationMs });
    const storedStart = cycle.timestamp - Math.max(0, cycle.duration ?? 0);
    if (storedStart < timing.teleopStartMs && cycle.timestamp >= timing.teleopStartMs) {
      return cycle.timestamp - timing.teleopStartMs;
    }
  }

  return Math.max(0, cycle.duration ?? 0);
}

export function activeCycleIdAtVideoTime(
  cycles: CycleTimingLike[],
  videoMatchStartMs: number | null | undefined,
  videoCurrentSeconds: number,
  options: CycleTimelineOptions = {},
): string | null {
  const roundTimestampMs = (videoCurrentSeconds * 1000) - (videoMatchStartMs ?? 0);
  if (roundTimestampMs < 0) return null;

  for (let index = 0; index < cycles.length; index += 1) {
    const start = cycleStartTimestamp(cycles, index, options);
    const end = cycleEndTimestamp(cycles, index);
    if (roundTimestampMs >= start && roundTimestampMs < end) {
      return cycles[index].id;
    }
  }

  return null;
}

function emptyPeriodStats(): AnalysisPeriodStats {
  return {
    cycles: 0,
    hits: 0,
    misses: 0,
    avgDuration: 0,
    hitRate: 0,
  };
}

function addCycle(stats: AnalysisPeriodStats, cycle: ScoutingCycle): number {
  stats.cycles += 1;
  stats.hits += cycle.hits ?? 0;
  stats.misses += cycle.misses ?? 0;
  return cycle.duration ?? 0;
}

function finalizeStats(stats: AnalysisPeriodStats, totalDuration: number): void {
  const attempts = stats.hits + stats.misses;
  stats.avgDuration = stats.cycles > 0 ? totalDuration / stats.cycles : 0;
  stats.hitRate = attempts > 0 ? stats.hits / attempts : 0;
}

function isTeleopInterval(value: string | null | undefined): value is AnalysisTeleopInterval {
  return ANALYSIS_TELEOP_INTERVALS.includes(value as AnalysisTeleopInterval);
}

function isAutonomousCycle(cycle: ScoutingCycle): boolean {
  return cycle.is_autonomous || cycle.time_interval === 'auto';
}

function resolveTeleopInterval(
  cycle: ScoutingCycle,
  hasAutonomousPeriod: boolean,
  transitionDurationMs?: number | null,
): AnalysisTeleopInterval | null {
  if (cycle.time_interval === 'auto' || cycle.time_interval === 'transition') return null;

  const fallback = getCycleTimeInterval(
    cycle.timestamp ?? 0,
    hasAutonomousPeriod ? 'full_match' : 'teleop_only',
    { transitionDurationMs },
  );
  if (isTeleopInterval(fallback)) return fallback;
  if (isTeleopInterval(cycle.time_interval)) return cycle.time_interval;
  return null;
}

export function buildMatchAnalysisStats(
  cycles: ScoutingCycle[],
  options: { transitionDurationMs?: number | null } = {},
): MatchAnalysisStats {
  const auto = emptyPeriodStats();
  const teleop = emptyPeriodStats();
  const intervals = ANALYSIS_TELEOP_INTERVALS.map(interval => ({
    interval,
    ...emptyPeriodStats(),
  }));
  const intervalByName = new Map(intervals.map(intervalStats => [intervalStats.interval, intervalStats]));
  const hasAutonomousPeriod = cycles.some(cycle => isAutonomousCycle(cycle));

  let autoDuration = 0;
  let teleopDuration = 0;
  const intervalDurations = new Map<AnalysisTeleopInterval, number>(
    ANALYSIS_TELEOP_INTERVALS.map(interval => [interval, 0]),
  );
  let fastestTeleopCycle: ScoutingCycle | null = null;
  let slowestTeleopCycle: ScoutingCycle | null = null;

  for (let index = 0; index < cycles.length; index += 1) {
    const cycle = cycles[index];
    const normalizedCycle = {
      ...cycle,
      duration: effectiveCycleDuration(cycles, index, options),
    };
    if (isAutonomousCycle(cycle)) {
      autoDuration += addCycle(auto, normalizedCycle);
      continue;
    }

    const interval = resolveTeleopInterval(cycle, hasAutonomousPeriod, options.transitionDurationMs);
    if (!interval) continue;

    teleopDuration += addCycle(teleop, normalizedCycle);
    intervalDurations.set(interval, (intervalDurations.get(interval) ?? 0) + addCycle(intervalByName.get(interval)!, normalizedCycle));

    if (!fastestTeleopCycle || normalizedCycle.duration < (fastestTeleopCycle.duration ?? 0)) {
      fastestTeleopCycle = normalizedCycle;
    }
    if (!slowestTeleopCycle || normalizedCycle.duration > (slowestTeleopCycle.duration ?? 0)) {
      slowestTeleopCycle = normalizedCycle;
    }
  }

  finalizeStats(auto, autoDuration);
  finalizeStats(teleop, teleopDuration);
  for (const intervalStats of intervals) {
    finalizeStats(intervalStats, intervalDurations.get(intervalStats.interval) ?? 0);
  }

  return {
    auto,
    teleop,
    teleopIntervals: intervals,
    fastestTeleopCycle,
    slowestTeleopCycle,
  };
}
