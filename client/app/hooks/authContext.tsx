import { createContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Scout } from '../lib/types';
import { API_BASE } from '../lib/api';

const STORAGE_KEY = 'ftc_scout_user';
type StoredAuth = { scout: Scout; sessionToken: string };

export interface AuthContextType {
  scout: Scout | null;
  sessionToken: string | null;
  loading: boolean;
  login: (username: string, password?: string) => Promise<Scout>;
  updateScoutSettings: (updates: Partial<Pick<Scout, 'transition_duration_ms' | 'keyboard_shortcuts'>>) => Promise<Scout>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [scout, setScout] = useState<Scout | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredAuth;
        if (!parsed.scout || !parsed.sessionToken) throw new Error('Sessao antiga');
        setScout(parsed.scout);
        setSessionToken(parsed.sessionToken);

        fetch(`${API_BASE}/scouts.php?id=${parsed.scout.id}`, { headers: { 'X-Scout-Session': parsed.sessionToken } })
          .then(response => response.ok ? response.json() : null)
          .then((fresh: Scout | null) => {
            if (!fresh) { localStorage.removeItem(STORAGE_KEY); setScout(null); setSessionToken(null); return; }
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ scout: fresh, sessionToken: parsed.sessionToken }));
            setScout(fresh);
          })
          .catch(() => { localStorage.removeItem(STORAGE_KEY); setScout(null); setSessionToken(null); });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password?: string): Promise<Scout> => {
    const response = await fetch(`${API_BASE}/scouts.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao fazer login');
    }

    const data = await response.json() as Scout & { session_token?: string };
    if (!data.session_token) throw new Error('Nao foi possivel criar uma sessao segura.');
    const { session_token: token, ...freshScout } = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scout: freshScout, sessionToken: token }));
    setScout(freshScout);
    setSessionToken(token);
    return freshScout;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setScout(null);
    setSessionToken(null);
  }, []);

  const updateScoutSettings = useCallback(async (
    updates: Partial<Pick<Scout, 'transition_duration_ms' | 'keyboard_shortcuts'>>,
  ): Promise<Scout> => {
    if (!scout || !sessionToken) throw new Error('Sessao expirada. Entre novamente.');

    const response = await fetch(`${API_BASE}/scouts.php?id=${scout.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Scout-Session': sessionToken },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao salvar configuracao');
    }

    const updated: Scout = await response.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scout: updated, sessionToken }));
    setScout(updated);
    return updated;
  }, [scout, sessionToken]);

  return (
    <AuthContext.Provider value={{ scout, sessionToken, loading, login, updateScoutSettings, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
