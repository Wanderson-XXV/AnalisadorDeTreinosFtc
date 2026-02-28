// Tipos principais da aplicação

export type CycleZone = 'near' | 'far' | null;
export type RoundType = 'teleop_only' | 'full_match';
export type RoundStrategy = 'near' | 'hybrid' | 'far' | null;

export const BATTERIES = ['Rag1', 'Asas1', 'Alpha1', 'Tech1', 'Tech2','Tech3','Tech4', 'Benfica'] as const;
export type BatteryName = typeof BATTERIES[number];

export const TELEOP_DURATION = 120000;
export const AUTO_DURATION = 30000;
export const TRANSITION_DURATION = 8000;
export const FULL_MATCH_DURATION = AUTO_DURATION + TRANSITION_DURATION + TELEOP_DURATION;

export function calculateStrategy(cycles: CycleData[]): RoundStrategy {
  const validCycles = cycles.filter(c => c.zone !== null);
  if (validCycles.length === 0) return null;
  
  const nearCount = validCycles.filter(c => c.zone === 'near').length;
  const farCount = validCycles.filter(c => c.zone === 'far').length;
  const total = validCycles.length;
  
  const nearPercent = nearCount / total;
  const farPercent = farCount / total;
  
  if (nearPercent >= 0.7) return 'near';
  if (farPercent >= 0.7) return 'far';
  return 'hybrid';
}

export interface CycleData {
  id: string;
  roundId: string;
  cycleNumber: number;
  duration: number;
  hits: number;
  misses: number;
  timestamp: number;
  timeInterval: string;
  zone: CycleZone;
  isAutonomous: boolean;
}

export interface RoundData {
  id: string;
  startTime: string;
  endTime: string | null;
  observations: string | null;
  totalDuration: number | null;
  cycles: CycleData[];
  roundType: RoundType;
  batteryName: string | null;
  batteryVolts: number | null;
  strategy: RoundStrategy;
}

export interface GeneralStats {
  totalRounds: number;
  totalCycles: number;
  avgCyclesPerRound: number;
  avgCycleTime: number;
  minCycleTime: number;
  personalBest: number;
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
  totalHits: number;
  totalMisses: number;
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

