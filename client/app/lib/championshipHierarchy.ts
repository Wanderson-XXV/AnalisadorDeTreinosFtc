import type { Championship, ChampionshipTeam, Team } from './types';

export interface ChampionshipTeamSection {
  key: string;
  title: string;
  championship: Championship | null;
  teams: Team[];
  entries: ChampionshipTeam[];
}

export interface ChampionshipNavigationItem {
  key: string;
  label: string;
  kind: 'general' | 'division';
  championship: Championship;
}

function bySortOrderThenName(a: Championship, b: Championship): number {
  const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (order !== 0) return order;
  return (a.short_name || a.name).localeCompare(b.short_name || b.name);
}

function byTeamNumber(a: Team, b: Team): number {
  return a.team_number - b.team_number;
}

export function flattenChampionships(items: Championship[]): Championship[] {
  return items.flatMap(item => [item, ...flattenChampionships(item.children ?? [])]);
}

export function getContextSelectableChampionships(items: Championship[]): Championship[] {
  return [...flattenChampionships(items)]
    .filter(item => !item.parent_id && (item.scope_type === 'standalone' || item.scope_type === 'event_group'))
    .sort(bySortOrderThenName);
}

export function getDefaultChampionship(items: Championship[]): Championship | null {
  const selectable = getContextSelectableChampionships(items);
  return selectable.find(item => item.status === 'active')
    ?? selectable[0]
    ?? flattenChampionships(items).find(item => item.status === 'active')
    ?? flattenChampionships(items)[0]
    ?? null;
}

function getChampionshipMap(flat: Championship[]): Map<string, Championship> {
  return new Map(flat.map(item => [item.id, item]));
}

export function getTopLevelContextChampionship(
  championship: Championship | null,
  flatChampionships: Championship[],
): Championship | null {
  if (!championship) return null;

  const byId = getChampionshipMap(flatChampionships);
  let current = championship;
  while (current.parent_id) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function getSelectedContextId(
  selectedChampionship: Championship | null,
  flatChampionships: Championship[],
): string | null {
  return getTopLevelContextChampionship(selectedChampionship, flatChampionships)?.id ?? null;
}

export function getDivisionNavigationItems(
  selectedChampionship: Championship | null,
  flatChampionships: Championship[],
): Championship[] {
  if (!selectedChampionship) return [];

  const byId = getChampionshipMap(flatChampionships);
  const parent = selectedChampionship.scope_type === 'event_group'
    ? selectedChampionship
    : selectedChampionship.parent_id
      ? byId.get(selectedChampionship.parent_id)
      : null;

  if (!parent || parent.scope_type !== 'event_group') return [];

  return [...(parent.children ?? [])]
    .filter(item => item.scope_type === 'division' || item.scope_type === 'final')
    .sort(bySortOrderThenName);
}

export function buildChampionshipNavigationItems(
  selectedChampionship: Championship | null,
  flatChampionships: Championship[],
  options: { includeGeneral?: boolean } = {},
): ChampionshipNavigationItem[] {
  const divisions = getDivisionNavigationItems(selectedChampionship, flatChampionships);
  if (divisions.length === 0) return [];

  const items: ChampionshipNavigationItem[] = [];
  const parent = getTopLevelContextChampionship(selectedChampionship, flatChampionships);
  if (options.includeGeneral && parent?.scope_type === 'event_group') {
    items.push({
      key: `general-${parent.id}`,
      label: 'Geral',
      kind: 'general',
      championship: parent,
    });
  }

  items.push(...divisions.map(item => ({
    key: item.id,
    label: item.short_name || item.name,
    kind: 'division' as const,
    championship: item,
  })));

  return items;
}

export function buildChampionshipQueryString(
  championshipId: string | null,
  includeChildren = false,
): string {
  if (!championshipId) return '';
  const params = new URLSearchParams({
    championship_id: championshipId,
    include_children: includeChildren ? '1' : '0',
  });
  return params.toString();
}

function resolveTeams(entries: ChampionshipTeam[], teams: Team[]): Team[] {
  const teamsByNumber = new Map(teams.map(item => [item.team_number, item]));
  const seen = new Set<number>();
  const result: Team[] = [];

  for (const entry of entries) {
    if (seen.has(entry.team_number)) continue;
    const team = teamsByNumber.get(entry.team_number);
    if (!team) continue;
    seen.add(entry.team_number);
    result.push(team);
  }

  return result.sort(byTeamNumber);
}

export function buildChampionshipTeamSections(
  entries: ChampionshipTeam[],
  teams: Team[],
  selectedChampionship: Championship | null,
  flatChampionships: Championship[],
): ChampionshipTeamSection[] {
  if (!selectedChampionship) {
    return [{
      key: 'all-teams',
      title: 'Todas as equipes',
      championship: null,
      teams: [...teams].sort(byTeamNumber),
      entries: [],
    }];
  }

  if (selectedChampionship.scope_type === 'event_group') {
    const children = getDivisionNavigationItems(selectedChampionship, flatChampionships);
    const sections = children.flatMap(child => {
      const childEntries = entries.filter(entry => entry.championship_id === child.id);
      if (childEntries.length === 0) return [];
      return [{
        key: child.id,
        title: child.short_name || child.name,
        championship: child,
        teams: resolveTeams(childEntries, teams),
        entries: childEntries,
      }];
    });

    const parentEntries = entries.filter(entry => entry.championship_id === selectedChampionship.id);
    if (parentEntries.length > 0) {
      sections.unshift({
        key: selectedChampionship.id,
        title: `${selectedChampionship.short_name || selectedChampionship.name} sem divisao`,
        championship: selectedChampionship,
        teams: resolveTeams(parentEntries, teams),
        entries: parentEntries,
      });
    }

    return sections;
  }

  return [{
    key: selectedChampionship.id,
    title: selectedChampionship.short_name || selectedChampionship.name,
    championship: selectedChampionship,
    teams: resolveTeams(entries, teams),
    entries,
  }];
}
