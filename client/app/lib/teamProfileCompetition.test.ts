import assert from 'node:assert/strict';
import test from 'node:test';

import type { Championship } from './types.ts';
import { getTeamProfileCompetitionLabel } from './teamProfileCompetition.ts';

const now = '2026-07-08T12:00:00Z';

function championship(overrides: Partial<Championship>): Championship {
  return {
    id: 'champ',
    parent_id: null,
    name: 'FIRST World Championship - Ross Division',
    short_name: null,
    season: '2025',
    event_code: null,
    scope_type: 'division',
    level: null,
    starts_at: null,
    ends_at: null,
    timezone: 'America/Sao_Paulo',
    location: null,
    status: 'active',
    sort_order: 0,
    created_at: now,
    updated_at: now,
    children: [],
    ...overrides,
  };
}

test('team profile competition label prefers the short championship name', () => {
  assert.equal(
    getTeamProfileCompetitionLabel(championship({ short_name: 'Ross' })),
    'Ross',
  );
});

test('team profile competition label falls back to the full championship name', () => {
  assert.equal(
    getTeamProfileCompetitionLabel(championship({ short_name: '' })),
    'FIRST World Championship - Ross Division',
  );
});

test('team profile competition label covers an unselected context', () => {
  assert.equal(getTeamProfileCompetitionLabel(null), 'Todas as competições');
});
