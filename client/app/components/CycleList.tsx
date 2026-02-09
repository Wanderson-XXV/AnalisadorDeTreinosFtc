import { Check, X, Clock } from 'lucide-react';
import type { CycleData } from '../lib/types';
import { cn, formatDuration } from '../lib/utils';

interface CycleListProps {
  cycles: CycleData[];
}

export function CycleList({ cycles }: CycleListProps) {
  const safeCycles = cycles ?? [];

  if (safeCycles.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum ciclo registrado</p>
        <p className="text-sm">Pressione ESPAÇO para marcar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
      {safeCycles.map((cycle, index) => (
        <div
          key={cycle.id ?? index}
          className={cn(
            'flex items-center justify-between p-3 rounded-lg',
            'bg-slate-700/30 border border-slate-600/50',
            'hover:bg-slate-700/50 transition-colors'
          )}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-slate-400 w-8">#{cycle.cycleNumber}</span>
            <span className="text-lg font-bold text-white">{formatDuration(cycle.duration)}</span>
            <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
              {cycle.timeInterval}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-green-400">
              <Check className="w-4 h-4" />
              <span className="font-medium">{cycle.hits}</span>
            </div>
            <div className="flex items-center gap-1 text-red-400">
              <X className="w-4 h-4" />
              <span className="font-medium">{cycle.misses}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
