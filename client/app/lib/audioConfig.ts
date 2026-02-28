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
    file: '/sounds/fim_autonomo.mpeg',
    modes: ['full_match'],
    description: 'PickControllers'
  },
  {
    timestamp: s(33.5),
    file: '/sounds/inicio_teleop.mpeg',
    modes: ['full_match'],
    description: 'inicio teleop'
  },
  {
    timestamp: s(125),
    file: '/sounds/endgame.mpeg',
    modes: ['full_match'],
    description: 'endgame'
  },
  {
    timestamp: s(87),
    file: '/sounds/endgame.mpeg',
    modes: ['teleop_only'],
    description: 'endgame'
  },
  {
    timestamp: s(147),
    file: '/sounds/10secsClashRoyale.mp3',
    modes: ['full_match'],
    description: '10s'
  },
  {
    timestamp: s(109),
    file: '/sounds/10secsClashRoyale.mp3',
    modes: ['teleop_only'],
    description: '10s'
  },
  {
    timestamp: s(154),
    file: '/sounds/fim_round.mpeg',
    modes: ['full_match'],
    description: 'Fim da partida completa'
  },
  {
    timestamp: s(116),
    file: '/sounds/fim_round.mpeg',
    modes: ['teleop_only'],
    description: 'Fim do teleop only'
  }
];