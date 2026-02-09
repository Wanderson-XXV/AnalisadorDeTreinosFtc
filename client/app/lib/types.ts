// Tipos principais da aplicação

export interface CycleData {
  id?: string;
  cycleNumber: number;
  duration: number; // em milissegundos
  hits: number;
  misses: number;
  timestamp: number; // ms desde início do round
  timeInterval: string; // "0-30s", "30-60s", etc.
}

export interface RoundData {
  id: string;
  start_time: string;
  end_time?: string;
  observations?: string;
  total_duration?: number;
  cycles: CycleData[];
  created_at?: string;
}

export interface GeneralStats {
  totalRounds: number;
  totalCycles: number;
  avgCyclesPerRound: number;
  avgCycleTime: number;
  minCycleTime: number;
  maxCycleTime: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
}

export interface IntervalStats {
  interval: string;
  count: number;
  avgTime: number;
  hits: number;
  misses: number;
}

export interface DayStats {
  date: string;
  rounds: number;
  totalCycles: number;
  avgCycleTime: number;
}

export interface EvolutionData {
  roundNumber: number;
  date: string;
  avgTime: number;
  cycleCount: number;
  hits: number;
  misses: number;
}

export interface StatsData {
  general: GeneralStats;
  statsByInterval: IntervalStats[];
  dailyStats: DayStats[];
  evolutionData: EvolutionData[];
}
