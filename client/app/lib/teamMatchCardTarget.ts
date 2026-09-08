import type { Match, ScoutingRound } from './types';
import { findMatchTeam } from './matchTeams.ts';

export interface TeamMatchCardTarget {
  sr: ScoutingRound;
  teamNumber: number;
  teamName?: string | null;
  alliance: 'red' | 'blue';
}

export function getTeamMatchCardTarget(match: Match, teamNumber: number): TeamMatchCardTarget | null {
  const sr = match.scouting_rounds?.find(round => round.team_number === teamNumber);
  if (!sr) return null;

  const slot = findMatchTeam(match, teamNumber);
  return slot ? { sr, teamNumber, teamName: slot.name, alliance: slot.alliance } : null;
}
