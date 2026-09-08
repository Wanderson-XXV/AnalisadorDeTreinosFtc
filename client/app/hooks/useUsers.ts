import { useState, useEffect, useCallback } from 'react';
import type { Scout } from '../lib/types';
import { fetchApi } from '../lib/api';

export function useUsers() {
  const [users, setUsers] = useState<Scout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<Scout[]>('/users.php');
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createUser = useCallback(async (username: string) => {
    const created = await fetchApi<Scout>('/users.php', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    setUsers(prev => [...prev, created].sort((a, b) => a.username.localeCompare(b.username)));
    return created;
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    await fetchApi(`/users.php?id=${id}`, { method: 'DELETE' });
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  return { users, loading, error, reload: load, createUser, deleteUser };
}
