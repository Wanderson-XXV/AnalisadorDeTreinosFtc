import test from 'node:test';
import assert from 'node:assert/strict';
import { eventChampionshipIds, formatSeasonLabel } from './teamCareer.ts';
import type { TeamCareerEvent } from './types.ts';

test('formats FTC season as a two-year label', () => {
  assert.equal(formatSeasonLabel('2025'), '2025–2026');
  assert.equal(formatSeasonLabel(null), 'Sem temporada');
});

test('event scope only contains the parent and participating divisions', () => {
  const event = {
    id: 'world', name: 'World', season_label: '2025–2026', registered: true,
    matches_count: 1, scouted_matches_count: 1, media_count: 0,
    divisions: [{ id: 'goodall', name: 'Goodall', scope_type: 'division', registered: true, matches_count: 1, scouted_matches_count: 1, media_count: 0 }],
  } satisfies TeamCareerEvent;
  assert.deepEqual([...eventChampionshipIds(event)], ['world', 'goodall']);
});
