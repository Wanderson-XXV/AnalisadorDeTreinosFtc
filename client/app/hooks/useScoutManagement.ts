import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MatchType,
  ScoutAssignment,
  ScoutBatchAssignmentResult,
  ScoutManagementData,
  ScoutMatchCoverage,
} from '../lib/types';
import { fetchApi } from '../lib/api';
import { useChampionshipContext } from './useChampionshipContext';

export interface ScoutManagementFilters {
  page: number;
  pageSize?: number;
  search?: string;
  matchType?: MatchType | 'all';
  coverage?: ScoutMatchCoverage | 'all';
}

export interface ScoutBatchSlotInput {
  match_id: string;
  team_number: number;
}

export function useScoutManagement(filters: ScoutManagementFilters) {
  const { selectedChampionship, loading: contextLoading } = useChampionshipContext();
  const [data, setData] = useState<ScoutManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    if (!selectedChampionship) return '';
    const params = new URLSearchParams({
      championship_id: selectedChampionship.id,
      include_children: selectedChampionship.scope_type === 'event_group' ? '1' : '0',
      page: String(filters.page),
      page_size: String(filters.pageSize ?? 20),
      search: filters.search ?? '',
      match_type: filters.matchType ?? 'all',
      coverage: filters.coverage ?? 'all',
    });
    return params.toString();
  }, [filters.coverage, filters.matchType, filters.page, filters.pageSize, filters.search, selectedChampionship]);

  const load = useCallback(async () => {
    if (!queryString) {
      if (!contextLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchApi<ScoutManagementData>(`/scout_management.php?${queryString}`));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [contextLoading, queryString]);

  useEffect(() => { void load(); }, [load]);

  const assign = useCallback(async (matchId: string, teamNumber: number, scoutId: string) => {
    const result = await fetchApi<ScoutAssignment>('/scout_assignments.php', {
      method: 'POST',
      body: JSON.stringify({ match_id: matchId, team_number: teamNumber, scout_id: scoutId }),
    });
    await load();
    return result;
  }, [load]);

  const assignBatch = useCallback(async (scoutId: string, slots: ScoutBatchSlotInput[]) => {
    const result = await fetchApi<ScoutBatchAssignmentResult>('/scout_assignments.php', {
      method: 'POST',
      body: JSON.stringify({ scout_id: scoutId, slots }),
    });
    await load();
    return result;
  }, [load]);

  const unassign = useCallback(async (matchId: string, teamNumber: number) => {
    await fetchApi(`/scout_assignments.php?match_id=${encodeURIComponent(matchId)}&team_number=${teamNumber}`, {
      method: 'DELETE',
    });
    await load();
  }, [load]);

  return { data, loading: loading || contextLoading, error, reload: load, assign, assignBatch, unassign };
}
