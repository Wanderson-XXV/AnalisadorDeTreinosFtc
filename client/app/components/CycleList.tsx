import { Clock, Edit2, FileText } from 'lucide-react';
import type { CycleData } from '../lib/types';
import { cn, formatTime } from '../lib/utils';

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
        <p className="text-sm">Pressione ESPACO para marcar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
      {safeCycles.map(cycle => (
        <div
          key={cycle.id}
          className={cn(
            'flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors',
            cycle.isAutonomous && 'border-l-4 border-yellow-400',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-slate-400 font-medium min-w-[3rem]">
                #{cycle.cycleNumber}
                {cycle.isAutonomous && <span className="ml-1 text-yellow-400">AUTO</span>}
              </span>

              <span
                className={cn(
                  'text-xs px-2 py-1 rounded font-medium',
                  cycle.timeInterval === 'auto'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-slate-600 text-slate-300',
                )}
              >
                {cycle.timeInterval}
              </span>

              {cycle.zone ? (
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded font-medium',
                    cycle.zone === 'near' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400',
                  )}
                >
                  {cycle.zone === 'near' ? 'Perto' : 'Longe'}
                </span>
              ) : (
                <span className="text-xs text-slate-500">-</span>
              )}

              <span className="text-white font-medium">{formatTime(cycle.duration)}</span>

              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm">OK {cycle.hits}</span>
                <span className="text-red-400 text-sm">Erro {cycle.misses}</span>
              </div>
            </div>

            {cycle.notes && (
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-300">
                <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
                <p className="whitespace-pre-wrap break-words">{cycle.notes}</p>
              </div>
            )}
          </div>

          {onEdit && (
            <button
              onClick={() => onEdit(cycle)}
              className="p-2 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
              title="Editar ciclo"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
