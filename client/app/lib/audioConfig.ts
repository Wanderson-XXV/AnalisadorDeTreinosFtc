import { BASE_PATH } from '../config';
import {
  DEFAULT_TRANSITION_DURATION_MS,
  getAudioEventsForRound as buildAudioEventsForRound,
} from './matchTiming';
import type { MatchTimingInput, TimingRoundType } from './matchTiming';

export interface AudioEvent {
  timestamp: number;
  file: string;
  modes: TimingRoundType[];
  description?: string;
}

export function getAudioEventsForRound(
  roundType: TimingRoundType,
  timing: MatchTimingInput = { transitionDurationMs: DEFAULT_TRANSITION_DURATION_MS },
): AudioEvent[] {
  return buildAudioEventsForRound(roundType, timing, BASE_PATH);
}

export const AUDIO_EVENTS: AudioEvent[] = [
  ...getAudioEventsForRound('full_match'),
  ...getAudioEventsForRound('teleop_only'),
];
