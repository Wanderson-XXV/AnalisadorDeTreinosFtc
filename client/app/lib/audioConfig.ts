import { BASE_PATH } from '../config';

export interface AudioEvent {
  timestamp: number;
  file: string;
  modes: ('teleop_only' | 'full_match')[];
  description?: string;
}

const s = (seconds: number) => seconds * 1000;

export const AUDIO_EVENTS: AudioEvent[] = [
  {
    timestamp: s(29),
    file: `${BASE_PATH}/sounds/fim_autonomo.mpeg`,
    modes: ['full_match'],
    description: 'PickControllers'
  },
  {
    timestamp: s(33.5),
    file: `${BASE_PATH}/sounds/inicio_teleop.mpeg`,
    modes: ['full_match'],
    description: 'inicio teleop'
  },
  {
    timestamp: s(135),
    file: `${BASE_PATH}/sounds/endgame.mpeg`,
    modes: ['full_match'],
    description: 'endgame'
  },
  {
    timestamp: s(97),
    file: `${BASE_PATH}/sounds/endgame.mpeg`,
    modes: ['teleop_only'],
    description: 'endgame'
  },
  {
    timestamp: s(147),
    file: `${BASE_PATH}/sounds/10secsClashRoyale.mp3`,
    modes: ['full_match'],
    description: '10s'
  },
  {
    timestamp: s(109),
    file: `${BASE_PATH}/sounds/10secsClashRoyale.mp3`,
    modes: ['teleop_only'],
    description: '10s'
  },
  {
    timestamp: s(154),
    file: `${BASE_PATH}/sounds/fim_round.mpeg`,
    modes: ['full_match'],
    description: 'Fim da partida completa'
  },
  {
    timestamp: s(115),
    file: `${BASE_PATH}/sounds/fim_round.mpeg`,
    modes: ['teleop_only'],
    description: 'Fim do teleop only'
  }
];