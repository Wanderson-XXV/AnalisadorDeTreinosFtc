export interface CycleData {
  id?: string;
  cycleNumber: number;
  duration: number;
  hits: number;
  misses: number;
  timestamp: number;
  timeInterval: string;
}

export interface RoundData {
  id: string;
  startTime: Date;
  endTime: Date | null;
  observations: string | null;
  totalDuration: number | null;
  cycles: CycleData[];
  createdAt: Date;
}

export interface RoundStats {
  totalCycles: number;
  avgCycleTime: number;
  minCycleTime: number;
  maxCycleTime: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  cyclesByInterval: Record<string, number>;
}

export interface DayStats {
  date: string;
  rounds: number;
  totalCycles: number;
  avgCycleTime: number;
}
