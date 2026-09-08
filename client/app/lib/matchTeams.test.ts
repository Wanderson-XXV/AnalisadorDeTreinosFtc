import assert from 'node:assert/strict';
import test from 'node:test';
import type { Match } from './types.ts';
import { findMatchTeam, getMatchTeamSlots } from './matchTeams.ts';

const match = {
  red_team1_number: 101,
  red_team2_number: 102,
  red_team3_number: 103,
  blue_team1_number: 201,
  blue_team2_number: 202,
  blue_team3_number: 203,
} as Match;

test('lists all six CRI team slots in alliance order', () => {
  assert.deepEqual(getMatchTeamSlots(match).map(slot => slot.number), [101, 102, 103, 201, 202, 203]);
  assert.deepEqual(getMatchTeamSlots(match, 'red').map(slot => slot.position), [1, 2, 3]);
});

test('keeps legacy 2x2 matches at four slots', () => {
  const legacy = { ...match, red_team3_number: null, blue_team3_number: null };
  assert.equal(getMatchTeamSlots(legacy).length, 4);
});

test('finds the alliance and position for the third robot', () => {
  assert.deepEqual(findMatchTeam(match, 203), { alliance: 'blue', position: 3, number: 203, name: null });
});
