import { Clock, Eye, Pencil, Trash2, PlayCircle } from 'lucide-react';
import type { Match } from '../../lib/types';

interface MatchListCardProps {
  match: Match;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const statusConfig = {
  scheduled: { label: 'Agendada', cls: 'text-slate-400 bg-slate-700' },
  in_progress: { label: 'Em andamento', cls: 'text-yellow-400 bg-yellow-900/30' },
  completed: { label: 'Completa', cls: 'text-green-400 bg-green-900/30' },
};

export function MatchListCard({ match, onView, onEdit, onDelete }: MatchListCardProps) {
  const st = statusConfig[match.status] ??

 statusConfig.scheduled;
  const typeLabel = match.match_type === 'qualification' ? 'Qualificatória' : 'Eliminatória';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg font-bold text-white">{match.display_name}</span>
            <span className="text-xs text-slate-400">{typeLabel}</span>
            {match.scheduled_time && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />{match.scheduled_time}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="flex

 items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-slate-300">
                #{match.red_team1_number} {match.red_team1_name && <span className="text-slate-400">{match.red_team1_name}</span>}
                {' + '}
                #{match.red_team2_number} {match.red_team2_name && <span className="text-slate-400">{match.red_team2_name}</span>}
              </span>
              {match.status === 'completed' && (
                <span className="ml-auto text-red-300 font-semibold">{match.red_total}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-slate-300">
                #{match.blue_team1_number} {match.blue_team1_name && <span className="text-slate-400">{match.blue_team1_name}</span>}
                {' + '}
                #{match.blue_team2_number

} {match.blue_team2_name && <span className="text-slate-400">{match.blue_team2_name}</span>}
              </span>
              {match.status === 'completed' && (
                <span className="ml-auto text-blue-300 font-semibold">{match.blue_total}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onView} title="Ver detalhes" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={onEdit} title="Editar" className="p-2 text-slate-400 hover:text-orange-400 hover:bg-slate-700 rounded-lg transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Excluir" className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />


          </button>
        </div>
      </div>
    </div>
  );
}