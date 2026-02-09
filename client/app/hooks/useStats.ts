import { useState, useEffect, useCallback } from 'react';
import type { StatsData } from '../lib/types';
import { API_BASE } from '../lib/api';

interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

export function useStats(dateRange?: DateRange) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate);
      
      const queryString = params.toString();
      const url = `${API_BASE}/stats.php${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar estatísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
