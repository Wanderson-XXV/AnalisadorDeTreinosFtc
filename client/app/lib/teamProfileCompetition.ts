import type { Championship } from './types';

export function getTeamProfileCompetitionLabel(championship: Championship | null): string {
  const shortName = championship?.short_name?.trim();
  if (shortName) return shortName;

  const name = championship?.name?.trim();
  if (name) return name;

  return 'Todas as competições';
}
