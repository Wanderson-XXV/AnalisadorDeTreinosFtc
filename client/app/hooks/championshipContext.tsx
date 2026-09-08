import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchApi } from '../lib/api';
import type { Championship } from '../lib/types';
import {
  buildChampionshipQueryString,
  flattenChampionships,
  getDefaultChampionship,
} from '../lib/championshipHierarchy';

const STORAGE_KEY = 'ftc_active_championship_id';

interface ChampionshipContextType {
  championships: Championship[];
  flatChampionships: Championship[];
  selectedChampionship: Championship | null;
  selectedChampionshipId: string | null;
  includeChildren: boolean;
  loading: boolean;
  error: string | null;
  queryString: string;
  setSelectedChampionshipId: (id: string) => void;
  reloadChampionships: () => Promise<void>;
}

export const ChampionshipContext = createContext<ChampionshipContextType | undefined>(undefined);

export function ChampionshipProvider({ children }: { children: ReactNode }) {
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [selectedChampionshipId, setSelectedChampionshipIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const flatChampionships = useMemo(() => flattenChampionships(championships), [championships]);

  const selectedChampionship = useMemo(() => (
    flatChampionships.find(c => c.id === selectedChampionshipId) ?? null
  ), [flatChampionships, selectedChampionshipId]);

  const includeChildren = false;

  const queryString = useMemo(() => {
    return buildChampionshipQueryString(selectedChampionshipId, includeChildren);
  }, [includeChildren, selectedChampionshipId]);

  const setSelectedChampionshipId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setSelectedChampionshipIdState(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<Championship[]>('/championships.php');
      setChampionships(data);

      const flat = flattenChampionships(data);
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedExists = saved && flat.some(c => c.id === saved);
      if (!savedExists) {
        const fallback = getDefaultChampionship(data);
        if (fallback) {
          localStorage.setItem(STORAGE_KEY, fallback.id);
          setSelectedChampionshipIdState(fallback.id);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <ChampionshipContext.Provider
      value={{
        championships,
        flatChampionships,
        selectedChampionship,
        selectedChampionshipId,
        includeChildren,
        loading,
        error,
        queryString,
        setSelectedChampionshipId,
        reloadChampionships: load,
      }}
    >
      {children}
    </ChampionshipContext.Provider>
  );
}
