import type {
  Match, MatchMedia, ScoutingCycle, ScoutingRound, TeamCareerDivision,
  TeamCareerEvent, TeamCareerSeason, TeamProfileData,
} from './types';

export function formatSeasonLabel(season?: string | null): string {
  const value = season?.trim() ?? '';
  return /^\d{4}$/.test(value) ? `${value}–${Number(value) + 1}` : value || 'Sem temporada';
}

export function eventChampionshipIds(event: TeamCareerEvent): Set<string> {
  return new Set([event.id, ...event.divisions.map(item => item.id)].filter((id): id is string => !!id));
}

export function filterTeamProfileData(
  data: TeamProfileData,
  season?: TeamCareerSeason | null,
  event?: TeamCareerEvent | null,
  division?: TeamCareerDivision | null,
): Pick<TeamProfileData, 'matches' | 'media'> {
  const seasonIds = new Set(season?.events.flatMap(item => [...eventChampionshipIds(item)]) ?? []);
  const eventIds = event ? eventChampionshipIds(event) : null;
  const divisionIds = division?.id ? new Set([division.id]) : null;
  const allowed = divisionIds ?? eventIds ?? (season ? seasonIds : null);
  if (!allowed) return { matches: data.matches, media: data.media };
  const matches = data.matches.filter(match => !!match.championship_id && allowed.has(match.championship_id));
  const matchIds = new Set(matches.map(match => match.id));
  return { matches, media: data.media.filter(item => matchIds.has(item.match_id)) };
}

export interface StrategyDetails {
  strategy: 'near' | 'far' | 'hybrid';
  nearPct: number;
  farPct: number;
  hybridPct: number;
}

export function computeStrategyDetails(cycles: ScoutingCycle[]): StrategyDetails | null {
  const valid = cycles.filter(cycle => cycle.zone !== null);
  if (valid.length === 0) return null;
  const nearPct = Math.round((valid.filter(cycle => cycle.zone === 'near').length / valid.length) * 100);
  const farPct = Math.round((valid.filter(cycle => cycle.zone === 'far').length / valid.length) * 100);
  const hybridPct = Math.max(0, 100 - nearPct - farPct);
  return {
    strategy: nearPct >= 70 ? 'near' : farPct >= 70 ? 'far' : 'hybrid',
    nearPct, farPct, hybridPct,
  };
}

export interface TeamPerformance {
  rounds: ScoutingRound[];
  scoutedMatches: Match[];
  highestScore: number;
  avgScore: number;
  maxTeleop: number;
  maxAuto: number;
  avgTeleop: number;
  avgAuto: number;
  avgHitRate: number;
  teleopDetails: StrategyDetails | null;
  autoDetails: StrategyDetails | null;
  chartData: Array<{ name: string; auto: number; teleop: number; total: number }>;
}

export function computeTeamPerformance(matches: Match[], teamNumber: number): TeamPerformance | null {
  const pairs = matches.flatMap(match => {
    const round = match.scouting_rounds?.find(item => item.team_number === teamNumber);
    return round?.cycles?.length ? [{ match, round }] : [];
  });
  if (pairs.length === 0) return null;
  const totals = pairs.map(({ round }) => round.cycles.reduce((sum, cycle) => sum + cycle.hits, 0));
  const autos = pairs.map(({ round }) => round.cycles.filter(cycle => cycle.is_autonomous).reduce((sum, cycle) => sum + cycle.hits, 0));
  const teleops = pairs.map(({ round }) => round.cycles.filter(cycle => !cycle.is_autonomous).reduce((sum, cycle) => sum + cycle.hits, 0));
  const hitRates = pairs.map(({ round }) => {
    const hits = round.cycles.reduce((sum, cycle) => sum + cycle.hits, 0);
    const misses = round.cycles.reduce((sum, cycle) => sum + cycle.misses, 0);
    return hits + misses ? (hits / (hits + misses)) * 100 : 0;
  });
  return {
    rounds: pairs.map(item => item.round),
    scoutedMatches: pairs.map(item => item.match),
    highestScore: Math.max(...totals),
    avgScore: totals.reduce((sum, value) => sum + value, 0) / totals.length,
    maxTeleop: Math.max(...teleops),
    maxAuto: Math.max(...autos),
    avgTeleop: teleops.reduce((sum, value) => sum + value, 0) / teleops.length,
    avgAuto: autos.reduce((sum, value) => sum + value, 0) / autos.length,
    avgHitRate: hitRates.reduce((sum, value) => sum + value, 0) / hitRates.length,
    teleopDetails: computeStrategyDetails(pairs.flatMap(({ round }) => round.cycles.filter(cycle => !cycle.is_autonomous))),
    autoDetails: computeStrategyDetails(pairs.flatMap(({ round }) => round.cycles.filter(cycle => cycle.is_autonomous))),
    chartData: pairs.map(({ match }, index) => ({ name: match.display_name, auto: autos[index], teleop: teleops[index], total: totals[index] })),
  };
}

export function eventStatusLabels(event: TeamCareerEvent): string[] {
  return [
    event.registered ? 'Inscrita' : null,
    event.matches_count ? 'Com partidas' : null,
    event.scouted_matches_count ? 'Com scout' : null,
    event.media_count ? 'Com mídia' : null,
  ].filter((value): value is string => !!value);
}

export function eventPerformance(event: TeamCareerEvent, data: TeamProfileData, teamNumber: number) {
  const { matches } = filterTeamProfileData(data, null, event);
  return computeTeamPerformance(matches, teamNumber);
}
