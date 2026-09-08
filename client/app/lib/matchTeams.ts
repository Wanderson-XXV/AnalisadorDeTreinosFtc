import type { Match } from './types';

export type MatchAlliance = 'red' | 'blue';

export interface MatchTeamSlot {
  alliance: MatchAlliance;
  position: 1 | 2 | 3;
  number: number;
  name?: string | null;
}

export function getMatchTeamSlots(match: Match, alliance?: MatchAlliance): MatchTeamSlot[] {
  const alliances: MatchAlliance[] = alliance ? [alliance] : ['red', 'blue'];
  const slots: MatchTeamSlot[] = [];
  for (const color of alliances) {
    for (const position of [1, 2, 3] as const) {
      const number = match[`${color}_team${position}_number` as keyof Match];
      if (typeof number !== 'number' || number <= 0) continue;
      const name = match[`${color}_team${position}_name` as keyof Match];
      slots.push({
        alliance: color,
        position,
        number,
        name: typeof name === 'string' ? name : null,
      });
    }
  }
  return slots;
}

export function findMatchTeam(match: Match, teamNumber: number): MatchTeamSlot | undefined {
  return getMatchTeamSlots(match).find(slot => slot.number === teamNumber);
}

export function matchIncludesTeam(match: Match, teamNumber: number): boolean {
  return !!findMatchTeam(match, teamNumber);
}
