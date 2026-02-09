import { useState, useEffect, useCallback } from 'react';
import type { RoundData } from '../lib/types';
import { API_BASE } from '../lib/api';

export function useRounds(dateFilter?: string) {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRounds = useCallback(async () => {
    try {
      setLoading(true);
      const params = dateFilter ? `?date=${dateFilter}` : '';
      const response = await fetch(`${API_BASE}/rounds.php${params}`);
      const data = await response.json();
      setRounds(data);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar rounds');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const createRound = async () => {
    const response = await fetch(`${API_BASE}/rounds.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime: new Date().toISOString() }),
    });
    return response.json();
  };

  const updateRound = async (id: string, data: Partial<RoundData>) => {
    const response = await fetch(`${API_BASE}/rounds.php?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  };

  const deleteRound = async (id: string) => {
    await fetch(`${API_BASE}/rounds.php?id=${id}`, {
      method: 'DELETE',
    });
    setRounds(prev => prev.filter(r => r.id !== id));
  };

  return {
    rounds,
    loading,
    error,
    refetch: fetchRounds,
    createRound,
    updateRound,
    deleteRound,
  };
}
