import { useState, useEffect, useCallback } from 'react';
import type { Scout } from '../lib/types';
import { API_BASE } from '../lib/api';

const STORAGE_KEY = 'ftc_scout_user';

export function useAuth() {
  const [scout, setScout] = useState<Scout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setScout(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string): Promise<Scout> => {
    const response = await fetch(`${API_BASE}/scouts.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao fazer login');
    }

    const data: Scout = await response.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setScout(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setScout(null);
  }, []);

  return { scout, loading, login, logout };
}