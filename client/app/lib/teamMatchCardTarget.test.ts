import { strict as assert } from 'node:assert';
import test from 'node:test';
import { getTeamMatchCardTarget } from './teamMatchCardTarget.ts';
import type { Match } from './types.ts';

const match = {
  id: 'match-1',
  championship_id: 'champ-1',
  match_number: 7,
  match_type: 'qualification',
  display_name: 'Q7',
  red_team1_number: 111,
  red_team1_name: 'Red One',
  red_team2_number: 222,
  red_team2_name: 'Red Two',
  blue_team1_number: 333,
  blue_team1_name: 'Blue One',
  blue_team2_number: 444,
  blue_team2_name: 'Blue Two',
  red_score_auto: 0,
  red_score_teleop: 0,
  red_penalties: 0,
  red_total: 12,
  blue_score_auto: 0,
  blue_score_teleop: 0,
  blue_penalties: 0,
  blue_total: 18,
  status: 'completed',
  created_at: '',
  updated_at: '',
  scouting_rounds: [
    {
      id: 'sr-blue',
      match_id: 'match-1',
      team_number: 333,
      scout_id: 'scout-1',
      scout_username: 'Ana',
      start_time: '',
      is_locked: false,
      cycles: [],
    },
  ],
} satisfies Match;

test('finds the team scouting target for a match card in a team profile', () => {
  assert.deepEqual(getTeamMatchCardTarget(match, 333), {
    sr: match.scouting_rounds?.[0],
    teamNumber: 333,
    teamName: 'Blue One',
    alliance: 'blue',
  });
});

test('returns null when the team has no scouting round in the match', () => {
  assert.equal(getTeamMatchCardTarget(match, 111), null);
});
