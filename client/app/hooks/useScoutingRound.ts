import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';
import type { ScoutingRound, ScoutingCycle, CycleZone, Match } from '../lib/types';
import {
  DEFAULT_TRANSITION_DURATION_MS,
  getCycleTimeInterval,
} from '../lib/matchTiming';

export interface ScoutingRoundFull extends ScoutingRound {
  match?: Match;
}

export function useScoutingRound(scoutingRoundId: string | null) {
  const [scoutingRound, setScoutingRound] = useState<ScoutingRoundFull | null>(null);
  const [cycles, setCycles] = useState<ScoutingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scoutingRoundId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await fetchApi<ScoutingRoundFull>(`/scouting.php?id=${scoutingRoundId}`);
        if (cancelled) return;
        setScoutingRound(data);
        setCycles(data.cycles || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [scoutingRoundId]);

  const addCycle = useCallback(async (
    cycleNumber: number,
    duration: number,
    timestamp: number,
    hits: number,
    misses: number,
    zone: CycleZone,
    isAutonomous: boolean,
    isFullMatch: boolean,
    transitionDurationMs = DEFAULT_TRANSITION_DURATION_MS,
    notes?: string | null,
  ): Promise<ScoutingCycle | null> => {
    if (!scoutingRoundId) return null;

    try {
      const saved = await fetchApi<ScoutingCycle>('/scouting_cycles.php', {
        method: 'POST',
        body: JSON.stringify({
          scouting_round_id: scoutingRoundId,
          cycle_number: cycleNumber,
          duration,
          timestamp,
          time_interval: getCycleTimeInterval(
            timestamp,
            isFullMatch ? 'full_match' : 'teleop_only',
            { transitionDurationMs },
          ),
          is_autonomous: isAutonomous ? 1 : 0,
          hits,
          misses,
          zone,
          notes: notes || null,
        }),
      });
      setCycles(prev => [...prev, saved]);
      return saved;
    } catch (e: any) {
      console.error('Error saving scouting cycle:', e);
      return null;
    }
  }, [scoutingRoundId]);

  const editCycle = useCallback(async (
    cycleId: string,
    hits: number,
    misses: number,
    zone: CycleZone,
    notes?: string | null,
  ): Promise<void> => {
    try {
      const updated = await fetchApi<ScoutingCycle>(`/scouting_cycles.php?id=${cycleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ hits, misses, zone, notes: notes || null }),
      });
      setCycles(prev => prev.map(c => c.id === cycleId ? updated : c));
    } catch (e: any) {
      console.error('Error updating scouting cycle:', e);
    }
  }, []);

  const finish = useCallback(async (
    totalDuration: number,
    observations?: string,
    robotIssues?: string,
    strategyNotes?: string,
    endTime?: string,
    transitionDurationMs = DEFAULT_TRANSITION_DURATION_MS,
  ): Promise<void> => {
    if (!scoutingRoundId) return;

    try {
      await fetchApi(`/scouting.php?id=${scoutingRoundId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          end_time: endTime ?? new Date().toISOString(),
          total_duration: totalDuration,
          observations: observations || null,
          robot_issues: robotIssues || null,
          strategy_notes: strategyNotes || null,
          transition_duration_ms: transitionDurationMs,
        }),
      });
    } catch (e: any) {
      console.error('Error finishing scouting round:', e);
    }
  }, [scoutingRoundId]);

  const cancel = useCallback(async (): Promise<void> => {
    if (!scoutingRoundId) return;

    try {
      await fetchApi(`/scouting.php?id=${scoutingRoundId}`, {
        method: 'DELETE',
      });
    } catch (e: any) {
      console.error('Error canceling scouting round:', e);
    }
  }, [scoutingRoundId]);

  return {
    scoutingRound,
    cycles,
    loading,
    error,
    addCycle,
    editCycle,
    finish,
    cancel,
  };
}
