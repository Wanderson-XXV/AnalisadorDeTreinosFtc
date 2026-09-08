import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTeamProfilePath } from './teamProfilePath.ts';

test('builds the team profile route from a team number', () => {
  assert.equal(buildTeamProfilePath(3565), '/team/3565');
});

test('trims numeric strings before building the team profile route', () => {
  assert.equal(buildTeamProfilePath(' 12345 '), '/team/12345');
});

test('carries the selected season, event and division into the team profile', () => {
  assert.equal(
    buildTeamProfilePath(772, { season: '2025', event: 'world', division: 'edison' }),
    '/team/772?season=2025&event=world&division=edison',
  );
});
