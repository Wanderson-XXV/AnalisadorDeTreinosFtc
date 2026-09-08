// Tipos existentes (treinos) — mantidos integralmente
import {
  AUTO_DURATION_MS,
  DEFAULT_TRANSITION_DURATION_MS,
  TELEOP_DURATION_MS,
} from './matchTiming';

export type CycleZone = 'near' | 'far' | null;
export type RoundType = 'teleop_only' | 'full_match';
export type RoundStrategy = 'near' | 'hybrid' | 'far' | null;

export const BATTERIES = ['Rag1', 'Asas1', 'Alpha1', 'Tech1', 'Tech2','Tech3','Tech4', 'Benfica'] as const;
export type BatteryName = typeof BATTERIES[number];

export const TELEOP_DURATION = TELEOP_DURATION_MS;
export const AUTO_DURATION = AUTO_DURATION_MS;
export const TRANSITION_DURATION = DEFAULT_TRANSITION_DURATION_MS;
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
  notes?: string | null;
}

export interface RoundData {
  id: string;
  startTime: string;
  endTime: string | null;
  observations: string | null;
  totalDuration: number | null;
  transitionDurationMs?: number | null;
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

export type MatchType = 'qualification' | 'elimination' | 'practice';
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed';
export type AllianceSize = 2 | 3;
export type KeyboardShortcutAction = 'mark_cycle' | 'toggle_zone' | 'confirm_cycle' | 'cancel_modal';
export type KeyboardShortcuts = Record<KeyboardShortcutAction, string>;
export type ChampionshipScopeType = 'standalone' | 'event_group' | 'division' | 'final';
export type LogoPosition =
  | 'top left' | 'top center' | 'top right'
  | 'center left' | 'center' | 'center right'
  | 'bottom left' | 'bottom center' | 'bottom right';

export type MediaCategory = 'full_match' | 'key_moment' | 'other';

export interface Championship {
  id: string;
  parent_id?: string | null;
  name: string;
  short_name?: string | null;
  season?: string | null;
  event_code?: string | null;
  scope_type: ChampionshipScopeType;
  level?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string | null;
  location?: string | null;
  status: 'active' | 'archived' | string;
  sort_order: number;
  alliance_size?: AllianceSize;
  created_at: string;
  updated_at: string;
  children?: Championship[];
}

export interface ComparisonMetrics {
  rounds_count: number;
  cycles_count: number;
  total_hits: number;
  total_misses: number;
  hit_rate: number;
  avg_hits_per_round: number;
  avg_cycles_per_round: number;
  avg_cycle_duration_ms: number;
  avg_auto_hits_per_round: number;
  avg_teleop_hits_per_round: number;
  max_hits_per_round: number;
  consistency: number;
}

export type ComparisonProfileSource = 'training_period' | 'championship_average';

export interface ComparisonProfile {
  id: string;
  source_type: ComparisonProfileSource;
  name: string;
  nickname?: string | null;
  logo_url?: string | null;
  logo_position?: LogoPosition;
  start_date?: string | null;
  end_date?: string | null;
  championship_id?: string | null;
  championship_name?: string | null;
  championship_short_name?: string | null;
  include_children: boolean;
  created_at: string;
  updated_at: string;
  metrics: ComparisonMetrics;
}

export interface ChampionshipTeam {
  id: string;
  championship_id: string;
  team_number: number;
  status: 'active' | 'inactive' | string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  team_name?: string;
  logo_url?: string;
  logo_position?: LogoPosition;
  instagram?: string;
  championship_name?: string;
  championship_short_name?: string;
}

export interface MatchMedia {
  id: string;
  match_id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_type: 'image' | 'video' | 'other';
  file_size: number;
  mime_type: string;
  category: MediaCategory;
  title?: string;
  description?: string;
  tagged_teams?: number[];
  uploaded_by?: string;
  uploaded_at: string;
  thumbnail_path?: string;
  source_type?: 'local' | 'youtube' | 'hls' | 'direct-cdn' | 'external' | string;
  external_provider?: string | null;
  external_url?: string | null;
  external_id?: string | null;
  external_event_id?: string | null;
  external_match_id?: string | null;
  external_clip_id?: string | null;
  video_match_start_ms?: number | null;
  video_duration_ms?: number | null;
  thumbnail_url?: string | null;
}

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
  transition_duration_ms?: number;
  keyboard_shortcuts?: KeyboardShortcuts;
  created_at: string;
    last_active?: string;
    password_configured?: boolean;
}

export interface TeamInMatch {
  number: number;
  name?: string;
}

export interface AllianceData {
  team1: TeamInMatch;
  team2: TeamInMatch;
  team3?: TeamInMatch;
  scoreAuto: number;
  scoreTeleop: number;
  penalties: number;
  total: number;
}

export interface Match {
  id: string;
  championship_id?: string;
  championship_name?: string;
  championship_short_name?: string;
  championship_timezone?: string | null;
  championship_location?: string | null;
  match_type: MatchType;
  match_number: number;
  display_name: string;
  red_team1_number: number;
  red_team1_name?: string;
  red_team2_number: number;
  red_team2_name?: string;
  red_team3_number?: number | null;
  red_team3_name?: string | null;
  blue_team1_number: number;
  blue_team1_name?: string;
  blue_team2_number: number;
  blue_team2_name?: string;
  blue_team3_number?: number | null;
  blue_team3_name?: string | null;
  alliance_size?: AllianceSize;
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
  source_match_id?: string | null;
  source_match_number?: number | null;
  source_system?: string | null;
  status: MatchStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  scouting_rounds?: ScoutingRound[];
  media?: MatchMedia[];
  first_video_thumb?: string;
  has_video?: boolean | number;
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
  transition_duration_ms?: number;
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

export interface ScoutAssignment {
  id: string;
  match_id: string;
  team_number: number;
  scout_id: string;
  scout_username?: string;
  match_display_name?: string;
  match_type?: MatchType;
  match_number?: number;
  red_team1_number?: number;
  red_team1_name?: string;
  red_team2_number?: number;
  red_team2_name?: string;
  red_team3_number?: number | null;
  red_team3_name?: string | null;
  blue_team1_number?: number;
  blue_team1_name?: string;
  blue_team2_number?: number;
  blue_team2_name?: string;
  blue_team3_number?: number | null;
  blue_team3_name?: string | null;
  match_status?: MatchStatus;
  created_at: string;
  updated_at: string;
}

export type TeamParticipationStatus = 'registered' | 'matches' | 'scouted' | 'media';

export interface TeamCareerDivision {
  id: string | null;
  name: string;
  short_name?: string | null;
  scope_type: ChampionshipScopeType | 'standalone';
  registered: boolean;
  matches_count: number;
  scouted_matches_count: number;
  media_count: number;
}

export interface TeamCareerEvent {
  id: string | null;
  name: string;
  short_name?: string | null;
  season?: string | null;
  season_label: string;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string | null;
  registered: boolean;
  matches_count: number;
  scouted_matches_count: number;
  media_count: number;
  divisions: TeamCareerDivision[];
}

export interface TeamCareerSeason {
  season: string | null;
  label: string;
  events: TeamCareerEvent[];
  events_count: number;
  matches_count: number;
  scouted_matches_count: number;
  media_count: number;
}

export interface TeamCareerSummary {
  seasons_count: number;
  events_count: number;
  matches_count: number;
  scouted_matches_count: number;
  media_count: number;
}

export interface TeamProfileData {
  team: (Team & { incomplete?: boolean }) | null;
  matches: Match[];
  media: MatchMedia[];
  seasons: TeamCareerSeason[];
  summary: TeamCareerSummary;
}

export interface TeamDirectoryItem extends Omit<Team, 'id' | 'created_at' | 'updated_at'> {
  id: number | null;
  created_at?: string;
  updated_at?: string;
  incomplete: boolean;
  latest_season?: string | null;
  latest_season_label?: string | null;
  events_count: number;
  matches_count: number;
  scouted_matches_count: number;
  registered: boolean;
}

export type ScoutSlotStatus = 'pending' | 'assigned' | 'in_progress' | 'done';
export type ScoutMatchCoverage = 'unassigned' | 'partial' | 'covered';

export interface ScoutManagementSlot {
  match_id: string;
  team_number: number;
  team_name?: string | null;
  alliance: 'red' | 'blue';
  position: 1 | 2 | 3;
  status: ScoutSlotStatus;
  scout_id?: string | null;
  scout_username?: string | null;
  assignment_id?: string | null;
  round_id?: string | null;
}

export interface ScoutManagementMatch extends Match {
  championship_scope_type?: ChampionshipScopeType;
  slots: ScoutManagementSlot[];
  coverage: ScoutMatchCoverage;
}

export interface ScoutManagementTotals {
  matches: number;
  pending: number;
  assigned: number;
  in_progress: number;
  done: number;
}

export interface ScoutManagementChildSummary {
  championship: Championship;
  totals: ScoutManagementTotals;
}

export interface ScoutWorkloadItem {
  match_id: string;
  match_display_name: string;
  championship_name: string;
  team_number: number;
  team_name?: string | null;
  status: ScoutSlotStatus;
}

export interface ScoutWorkload {
  scout: Pick<Scout, 'id' | 'username' | 'photo_path'>;
  counts: { assigned: number; in_progress: number; done: number; total: number };
  items: ScoutWorkloadItem[];
}

export interface ScoutManagementData {
  context: Championship;
  totals: ScoutManagementTotals;
  children: ScoutManagementChildSummary[];
  matches: {
    items: ScoutManagementMatch[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
  workloads: ScoutWorkload[];
}

export interface ScoutBatchAssignmentResult {
  assigned: number;
  skipped: number;
  duplicates: number;
  conflicts: Array<{ match_id: string; team_number: number; reason: 'scouting_started' | 'already_assigned' }>;
  items: ScoutAssignment[];
}
