import { useState, useEffect, useCallback } from 'react';
import type { Team, TeamFormData } from '../lib/types';
import { fetchApi } from '../lib/api';

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<Team[]>('/teams.php');
      setTeams(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createTeam = useCallback(async (body: TeamFormData) => {
    const created = await fetchApi<Team>('/teams.php', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setTeams(prev => [...prev, created].sort((a, b) => a.team_number - b.team_number));
    return created;
  }, []);

  const updateTeam = useCallback(async (body: Partial<TeamFormData> & { id: number }) => {
    const updated = await fetchApi<Team>('/teams.php', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    setTeams(prev => prev.map(t => t.id === updated.id ? updated : t));
    return updated;
  }, []);

  const deleteTeam = useCallback(async (id: number) => {
    await fetchApi('/teams.php?id=' + id, { method: 'DELETE' });
    setTeams(prev => prev.filter(t => t.id !== id));
  }, []);

  const searchTeams = useCallback(async (query: string): Promise<Team[]> => {
    if (!query.trim()) return teams;
    return fetchApi<Team[]>(`/teams.php?search=${encodeURIComponent(query)}`);
  }, [teams]);

  return { teams, loading, error, reload: load, createTeam, updateTeam, deleteTeam, searchTeams };
}