export interface TeamProfileScope {
  season?: string | null;
  event?: string | null;
  division?: string | null;
}

export function buildTeamProfilePath(teamNumber: number | string, scope: TeamProfileScope = {}): string {
  const path = `/team/${encodeURIComponent(String(teamNumber).trim())}`;
  const params = new URLSearchParams();
  if (scope.season) params.set('season', scope.season);
  if (scope.event) params.set('event', scope.event);
  if (scope.division) params.set('division', scope.division);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
