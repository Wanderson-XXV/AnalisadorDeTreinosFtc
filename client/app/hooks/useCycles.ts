import { API_BASE } from '../lib/api';
import type { CycleData } from '../lib/types';
import { getTimeInterval } from '../lib/utils';

export function useCycles() {
  const createCycle = async (data: {
    roundId: string;
    cycleNumber: number;
    duration: number;
    hits: number;
    misses: number;
    timestamp: number;
  }): Promise<CycleData> => {
    const response = await fetch(`${API_BASE}/cycles.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        timeInterval: getTimeInterval(data.timestamp),
      }),
    });
    return response.json();
  };

  const updateCycle = async (id: string, data: { hits?: number; misses?: number }) => {
    const response = await fetch(`${API_BASE}/cycles.php?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  };

  return { createCycle, updateCycle };
}
