import assert from 'node:assert/strict';
import test from 'node:test';

import type { Championship, ChampionshipTeam, Team } from './types.ts';
import {
  buildChampionshipQueryString,
  buildChampionshipNavigationItems,
  buildChampionshipTeamSections,
  flattenChampionships,
  getContextSelectableChampionships,
  getDefaultChampionship,
  getDivisionNavigationItems,
  getSelectedContextId,
} from './championshipHierarchy.ts';

const now = '2026-07-08T12:00:00Z';

function championship(overrides: Partial<Championship>): Championship {
  return {
    id: 'champ',
    parent_id: null,
    name: 'Championship',
    short_name: null,
    season: '2025',
    event_code: null,
    scope_type: 'standalone',
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

function team(overrides: Partial<Team>): Team {
  return {
    id: 1,
    team_number: 1,
    team_name: 'Team',
    logo_position: 'center',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function membership(overrides: Partial<ChampionshipTeam>): ChampionshipTeam {
  return {
    id: 'entry',
    championship_id: 'champ',
    team_number: 1,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

const franklin = championship({
  id: 'franklin',
  parent_id: 'world',
  name: 'Franklin Division',
  short_name: 'Franklin',
  scope_type: 'division',
  sort_order: 2,
});

const edison = championship({
  id: 'edison',
  parent_id: 'world',
  name: 'Edison Division',
  short_name: 'Edison',
  scope_type: 'division',
  sort_order: 1,
});

const finals = championship({
  id: 'finals',
  parent_id: 'world',
  name: 'Finals Division',
  short_name: 'Finals',
  scope_type: 'final',
  sort_order: 0,
});

const world = championship({
  id: 'world',
  name: '2026 FIRST World Championship',
  short_name: 'Worlds',
  scope_type: 'event_group',
  sort_order: 5,
  children: [franklin, edison, finals],
});

const brasil = championship({
  id: 'brcmp',
  name: 'Nacional Brasil 2026',
  short_name: 'BRCMP',
  scope_type: 'standalone',
  sort_order: 1,
});

const tree = [world, brasil];

test('context selector exposes only top-level selectable contexts', () => {
  const options = getContextSelectableChampionships(tree);

  assert.deepEqual(options.map(option => option.id), ['brcmp', 'world']);
});

test('default context prefers a top-level active context over a child division', () => {
  const selected = getDefaultChampionship([world]);

  assert.equal(selected?.id, 'world');
});

test('selected child keeps parent visible in context selector and uses sibling division buttons', () => {
  const flat = flattenChampionships(tree);
  const selected = flat.find(item => item.id === 'franklin')!;

  assert.equal(getSelectedContextId(selected, flat), 'world');
  assert.deepEqual(
    getDivisionNavigationItems(selected, flat).map(item => item.id),
    ['finals', 'edison', 'franklin'],
  );
});

test('teams navigation can include a general parent option before division buttons', () => {
  const flat = flattenChampionships(tree);
  const selected = flat.find(item => item.id === 'franklin')!;

  const items = buildChampionshipNavigationItems(selected, flat, { includeGeneral: true });

  assert.deepEqual(
    items.map(item => ({
      id: item.championship.id,
      label: item.label,
      kind: item.kind,
    })),
    [
      { id: 'world', label: 'Geral', kind: 'general' },
      { id: 'finals', label: 'Finals', kind: 'division' },
      { id: 'edison', label: 'Edison', kind: 'division' },
      { id: 'franklin', label: 'Franklin', kind: 'division' },
    ],
  );
});

test('parent event match queries do not aggregate child divisions by default', () => {
  assert.equal(
    buildChampionshipQueryString('world'),
    'championship_id=world&include_children=0',
  );
});

test('parent event team sections group memberships by child division order', () => {
  const flat = flattenChampionships(tree);
  const teams = [
    team({ id: 10, team_number: 100, team_name: 'Alpha' }),
    team({ id: 20, team_number: 200, team_name: 'Beta' }),
    team({ id: 30, team_number: 300, team_name: 'Gamma' }),
  ];
  const memberships = [
    membership({ id: 'beta-entry', championship_id: 'franklin', team_number: 200 }),
    membership({ id: 'alpha-entry', championship_id: 'edison', team_number: 100 }),
    membership({ id: 'gamma-entry', championship_id: 'franklin', team_number: 300 }),
  ];

  const sections = buildChampionshipTeamSections(memberships, teams, world, flat);

  assert.deepEqual(
    sections.map(section => ({
      title: section.title,
      count: section.teams.length,
      teamNumbers: section.teams.map(item => item.team_number),
    })),
    [
      { title: 'Edison', count: 1, teamNumbers: [100] },
      { title: 'Franklin', count: 2, teamNumbers: [200, 300] },
    ],
  );
}
);
