export type TimingRoundType = 'teleop_only' | 'full_match';
export type MatchPhase = 'auto' | 'transition' | 'teleop' | 'overtime';

export const AUTO_DURATION_MS = 30_000;
export const TELEOP_DURATION_MS = 120_000;
export const DEFAULT_TRANSITION_DURATION_MS = 15_000;
export const MIN_TRANSITION_DURATION_MS = 0;
export const MAX_TRANSITION_DURATION_MS = 60_000;

export interface MatchTimingInput {
  autoDurationMs?: number;
  transitionDurationMs?: number | null;
  teleopDurationMs?: number;
}

export interface MatchTiming {
  autoDurationMs: number;
  transitionDurationMs: number;
  teleopDurationMs: number;
  teleopStartMs: number;
  fullMatchDurationMs: number;
}

export interface TimedAudioEvent {
  timestamp: number;
  file: string;
  modes: TimingRoundType[];
  description: string;
}

export interface CycleMarkTimingInput {
  currentTimeMs: number;
  lastCycleEndMs: number;
  phase: MatchPhase;
  timing?: MatchTimingInput;
}

export interface CycleMarkTiming {
  timestamp: number;
  duration: number;
}

function wholeMilliseconds(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

export function normalizeTransitionDurationMs(value: number | null | undefined): number {
  const next = wholeMilliseconds(Number(value), DEFAULT_TRANSITION_DURATION_MS);
  return Math.min(MAX_TRANSITION_DURATION_MS, Math.max(MIN_TRANSITION_DURATION_MS, next));
}

export function createMatchTiming(input: MatchTimingInput = {}): MatchTiming {
  const autoDurationMs = wholeMilliseconds(input.autoDurationMs ?? AUTO_DURATION_MS, AUTO_DURATION_MS);
  const transitionDurationMs = normalizeTransitionDurationMs(input.transitionDurationMs);
  const teleopDurationMs = wholeMilliseconds(input.teleopDurationMs ?? TELEOP_DURATION_MS, TELEOP_DURATION_MS);
  const teleopStartMs = autoDurationMs + transitionDurationMs;

  return {
    autoDurationMs,
    transitionDurationMs,
    teleopDurationMs,
    teleopStartMs,
    fullMatchDurationMs: teleopStartMs + teleopDurationMs,
  };
}

export function getFullMatchDurationMs(input: MatchTimingInput = {}): number {
  return createMatchTiming(input).fullMatchDurationMs;
}

export function getMatchPhase(
  timeMs: number,
  roundType: TimingRoundType,
  input: MatchTimingInput = {},
): MatchPhase {
  const timing = createMatchTiming(input);

  if (roundType === 'teleop_only') {
    return timeMs >= timing.teleopDurationMs ? 'overtime' : 'teleop';
  }

  if (timeMs < timing.autoDurationMs) return 'auto';
  if (timeMs < timing.teleopStartMs) return 'transition';
  if (timeMs < timing.fullMatchDurationMs) return 'teleop';
  return 'overtime';
}

export function getCycleTimeInterval(
  timestampMs: number,
  roundType: TimingRoundType = 'teleop_only',
  input: MatchTimingInput = {},
): string {
  const timing = createMatchTiming(input);
  let teleopTimeMs = timestampMs;

  if (roundType === 'full_match') {
    if (timestampMs < timing.autoDurationMs) return 'auto';
    if (timestampMs < timing.teleopStartMs) return 'transition';
    teleopTimeMs = timestampMs - timing.teleopStartMs;
  }

  if (teleopTimeMs < 30_000) return '0-30s';
  if (teleopTimeMs < 60_000) return '30-60s';
  if (teleopTimeMs < 90_000) return '60-90s';
  return '90-120s';
}

export function getCycleMarkTiming({
  currentTimeMs,
  lastCycleEndMs,
  phase,
  timing: input = {},
}: CycleMarkTimingInput): CycleMarkTiming {
  const timing = createMatchTiming(input);
  const timestamp = phase === 'transition'
    ? Math.max(0, timing.autoDurationMs - 1_000)
    : currentTimeMs;
  const effectiveLastCycleEndMs = phase === 'teleop'
    ? Math.max(lastCycleEndMs, timing.teleopStartMs)
    : lastCycleEndMs;

  return {
    timestamp,
    duration: Math.max(0, timestamp - effectiveLastCycleEndMs),
  };
}

function soundFile(basePath: string, name: string): string {
  return `${basePath}/sounds/${name}`;
}

export function getAudioEventsForRound(
  roundType: TimingRoundType,
  input: MatchTimingInput = {},
  basePath = '',
): TimedAudioEvent[] {
  if (roundType === 'teleop_only') {
    return [
      {
        timestamp: 97_000,
        file: soundFile(basePath, 'endgame.mpeg'),
        modes: ['teleop_only'],
        description: 'endgame',
      },
      {
        timestamp: 109_000,
        file: soundFile(basePath, '10secsClashRoyale.mp3'),
        modes: ['teleop_only'],
        description: '10s',
      },
      {
        timestamp: 115_000,
        file: soundFile(basePath, 'fim_round.mpeg'),
        modes: ['teleop_only'],
        description: 'Fim do teleop only',
      },
    ];
  }

  const timing = createMatchTiming(input);

  return [
    {
      timestamp: Math.max(0, timing.autoDurationMs - 1_000),
      file: soundFile(basePath, 'fim_autonomo.mpeg'),
      modes: ['full_match'],
      description: 'PickControllers',
    },
    {
      timestamp: Math.max(timing.autoDurationMs, timing.teleopStartMs - 4_500),
      file: soundFile(basePath, 'inicio_teleop.mpeg'),
      modes: ['full_match'],
      description: 'inicio teleop',
    },
    {
      timestamp: timing.teleopStartMs + 90_000,
      file: soundFile(basePath, 'endgame.mpeg'),
      modes: ['full_match'],
      description: 'endgame',
    },
    {
      timestamp: Math.max(timing.teleopStartMs, timing.fullMatchDurationMs - 11_000),
      file: soundFile(basePath, '10secsClashRoyale.mp3'),
      modes: ['full_match'],
      description: '10s',
    },
    {
      timestamp: Math.max(timing.teleopStartMs, timing.fullMatchDurationMs - 5_000),
      file: soundFile(basePath, 'fim_round.mpeg'),
      modes: ['full_match'],
      description: 'Fim da partida completa',
    },
  ];
}
