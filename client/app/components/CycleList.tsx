
import { Check, X, Clock, Edit2 } from 'lucide-react';
import type { CycleData } from '../lib/types';
import { cn, formatDuration, formatTime } from '../lib/utils';

interface CycleListProps {
  cycles: CycleData[];
  onEdit?: (cycle: CycleData) => void;
}

export function CycleList({ cycles, onEdit }: CycleListProps) {
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
          key={cycle.id}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors",
            cycle.isAutonomous && "border-l-4 border-yellow-400"
          )}
        >
          <div className="flex items-center gap-3 flex-1">
            {/* Número do ciclo */}
            <span className="text-slate-400 font-medium min-w-[3rem]">
              #{cycle.cycleNumber}
              {cycle.isAutonomous && <span className="ml-1 text-yellow-400">🤖</span>}
            </span>

            {/* Intervalo */}
            <span className={cn(
              "text-xs px-2 py-1 rounded font-medium",
              cycle.timeInterval === 'auto' ? 'bg-yellow-500/20 text-yellow-400' :
              cycle.timeInterval === 'transition' ? 'bg-slate-600 text-slate-300' :
              'bg-slate-600 text-slate-300'
            )}>
              {cycle.timeInterval}
            </span>

            {/* Zona */}
            {cycle.zone ? (
              <span className={cn(
                "text-xs px-2 py-1 rounded font-medium",
                cycle.zone === 'near' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
              )}>
                {cycle.zone === 'near' ? '🎯 Perto' : '🚀 Longe'}
              </span>
            ) : (
              <span className="text-xs text-slate-500">-</span>
            )}

            {/* Duração */}
            <span className="text-white font-medium">
              {formatTime(cycle.duration)}
            </span>

            {/* Acertos/Erros */}
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-sm">✓ {cycle.hits}</span>
              <span className="text-red-400 text-sm">✗ {cycle.misses}</span>
            </div>
          </div>

          {/* Botão de editar */}
          {onEdit && (
            <button
              onClick={() => onEdit(cycle)}
              className="p-2 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}