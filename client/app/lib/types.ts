// Tipos existentes (treinos) — mantidos integralmente
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

// ============================================================
// TIPOS DE CAMPEONATO (NOVOS)
// ============================================================

export type MatchType = 'qualification' | 'elimination';
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed';
export type LogoPosition = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'contain' | 'cover';

export interface Team {
  id: number;
  team_number: number;
  team_name: string;
  logo_url?: string;
  logo_position: LogoPosition;
  instagram?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamFormData {
  team_number: number;
  team_name: string;
  logo_url?: string;
  logo_position?: LogoPosition;
  instagram?: string;
}

export interface Scout {
  id: string;
  username: string;
  photo_path?: string;
  created_at: string;
  last_active?: string;
}

export interface TeamInMatch {
  number: number;
  name?: string;
}

export interface AllianceData {
  team1: TeamInMatch;
  team2: TeamInMatch;
  scoreAuto: number;
  scoreTeleop: number;
  penalties: number;
  total: number;
}

export interface Match {
  id: string;
  championship_id?: string;
  match_type: MatchType;
  match_number: number;
  display_name: string;
  red_team1_number: number;
  red_team1_name?: string;
  red_team2_number: number;
  red_team2_name?: string;
  blue_team1_number: number;
  blue_team1_name?: string;
  blue_team2_number: number;
  blue_team2_name?: string;
  red_score_auto: number;
  red_score_teleop: number;
  red_penalties: number;
  red_total: number;
  blue_score_auto: number;
  blue_score_teleop: number;
  blue_penalties: number;
  blue_total: number;
  scheduled_time?: string;
  actual_start_time?: string;
  status: MatchStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  scouting_rounds?: ScoutingRound[];
}

export interface ScoutingRound {
  id: string;
  match_id: string;
  team_number: number;
  scout_id?: string;
  scout_username?: string;
  start_time: string;
  end_time?: string;
  total_duration?: number;
  observations?: string;
  robot_issues?: string;
  strategy_notes?: string;
  is_locked: boolean;
  locked_at?: string;
  cycles: ScoutingCycle[];
}

export interface ScoutingCycle {
  id: string;
  scouting_round_id: string;
  cycle_number: number;
  duration: number;
  timestamp: number;
  time_interval: string;
  is_autonomous: boolean;
  hits: number;
  misses: number;
  zone: CycleZone;
  action_type?: string;
  notes?: string;
}

export interface TeamStats {
  team_number: number;
  team_name?: string;
  matches_scouted: number;
  auto_hits: number;
  auto_misses: number;
  avg_auto_cycle_time: number;
  teleop_hits: number;
  teleop_misses: number;
  avg_teleop_cycle_time: number;
  total_hits: number;
  total_misses: number;
  hit_rate: number;
  avg_cycles_per_match: number;
}