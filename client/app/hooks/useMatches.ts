import { useState, useEffect, useCallback } from 'react';
import type

 { Match } from '../lib/types';
import { fetchApi } from '../lib/api';

export function useMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<Match[]>('/matches.php');
      setMatches(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createMatch = useCallback(async (body: Omit<Match, 'id' | 'display_name' | 'status' | 'created_at' | 'updated_at' | 'red_score_auto' | 'red_score_teleop' | 'red_penalties' | 'red_total' | 'blue_score_auto' | 'blue_score_teleop' | 'blue_penalties' | 'blue_total' | 'scouting_rounds'>) => {
    const created = await fetchApi<Match>('/matches.php', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setMatches(prev => [...prev, created].sort((a, b) => {
      if (a.match_type !== b.match_type) return a.match_type.localeCompare(b.match_type);
      return a.match_number - b.match_number;
    }));
    return created;
  }, []);

  const updateMatch = useCallback(async (body: Partial<Match> & { id: string }) => {
    const updated = await fetchApi<Match>('/matches.php', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    setMatches(prev => prev.map(m => m.id === updated.id ? updated : m));
    return updated;
  }, []);

  const deleteMatch = useCallback(async (id: string) => {
    await fetchApi('/matches.php?id=' + id, { method: 'DELETE' });
    setMatches(prev => prev.filter(m => m.id !== id));
  }, []);

  return { matches, loading, error, reload: load, createMatch, updateMatch, deleteMatch };
}