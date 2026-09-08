import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_TRANSITION_DURATION_MS,
  normalizeTransitionDurationMs,
} from '../lib/matchTiming';
import { useAuth } from './useAuth';

function storageKey(scoutId?: string): string {
  return scoutId ? `ftc_transition_duration_ms_${scoutId}` : 'ftc_transition_duration_ms';
}

function readStoredTransitionDurationMs(key: string): number | null {
  const stored = localStorage.getItem(key);
  if (stored === null) return null;
  return normalizeTransitionDurationMs(Number(stored));
}

export function useTransitionDurationSetting() {
  const { scout, updateScoutSettings } = useAuth();
  const key = useMemo(() => storageKey(scout?.id), [scout?.id]);
  const [transitionDurationMs, setTransitionDurationMsState] = useState(DEFAULT_TRANSITION_DURATION_MS);

  useEffect(() => {
    const saved = readStoredTransitionDurationMs(key);
    const accountValue = scout?.transition_duration_ms ?? null;
    const next = normalizeTransitionDurationMs(accountValue ?? saved ?? DEFAULT_TRANSITION_DURATION_MS);
    setTransitionDurationMsState(next);
    localStorage.setItem(key, String(next));
  }, [key, scout?.transition_duration_ms]);

  const setTransitionDurationMs = useCallback((value: number) => {
    const next = normalizeTransitionDurationMs(value);
    setTransitionDurationMsState(next);
    localStorage.setItem(key, String(next));

    if (scout) {
      updateScoutSettings({ transition_duration_ms: next }).catch(error => {
        console.error('Error saving transition duration:', error);
      });
    }
  }, [key, scout, updateScoutSettings]);

  return { transitionDurationMs, setTransitionDurationMs };
}
