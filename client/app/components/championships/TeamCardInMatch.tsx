import { PlayCircle, Eye, User, CheckCircle, Clock, Edit2, RotateCcw } from 'lucide-react';
import type { ScoutingRound, LogoPosition } from '../../lib/types';
import { resolveLogoUrl } from '../../lib/api';

interface TeamCardInMatchProps {
  teamNumber: number;
  teamName?: string | null;
  alliance: 'red' | 'blue';
  scoutingRound?: ScoutingRound;
  assignedUsername?: string;
  onStartScouting: () => void;
  onViewScouting?: () => void;
  onEditScouting?: () => void;
  logoUrl?: string | null;
  logoPosition?: LogoPosition;
}

function TeamLogo({ url, position, teamNumber }: { url: string; position?: LogoPosition; teamNumber: number }) {
  const src = resolveLogoUrl(url);
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700 flex-shrink-0 ring-2 ring-slate-600">
      <img
        src={src}
        alt={`#${teamNumber}`}
        className="w-full h-full"
        style={{ objectFit: 'cover', objectPosition: position ?? 'center' }}
        onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
      />
    </div>
  );
}

export function TeamCardInMatch({
  teamNumber,
  teamName,
  alliance,
  scoutingRound,
  assignedUsername,
  onStartScouting,
  onViewScouting,
  onEditScouting,
  logoUrl,
  logoPosition,
}: TeamCardInMatchProps) {
  const isRed = alliance === 'red';
  const bgClass = isRed ? 'bg-red-900/20 border-red-800/40' : 'bg-blue-900/20 border-blue-800/40';
  const numClass = isRed ? 'text-red-300' : 'text-blue-300';
  const btnClass = isRed
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  const hasData = !!scoutingRound;
  const isLocked = scoutingRound?.is_locked;
  const isDone = hasData && !isLocked;

  const displayUsername = scoutingRound?.scout_username ?? assignedUsername;
  const isAssignedOnly  = !scoutingRound && !!assignedUsername;

  return (
    <div className={`border rounded-lg p-2.5 ${bgClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {logoUrl && <TeamLogo url={logoUrl} position={logoPosition} teamNumber={teamNumber} />}
            <div className="flex-1 min-w-0">
              <span className={`text-lg font-bold ${numClass}`}>#{teamNumber}</span>
              {teamName && (
                <span className="text-sm text-slate-300 truncate ml-2">{teamName}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {displayUsername && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium border ${isAssignedOnly ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700/40' : 'bg-slate-700/60 text-slate-200 border-slate-600/50'}`}>
                <User className="w-3 h-3" />
                {displayUsername}
              </span>
            )}
            {isAssignedOnly && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-indigo-900/30 text-indigo-400 font-semibold border border-indigo-700/30">
                Atribuído
              </span>
            )}
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-yellow-900/30 text-yellow-400 font-semibold border border-yellow-700/40">
                <Clock className="w-3 h-3" />
                Em andamento
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-900/40 text-emerald-400 font-semibold border border-emerald-700/40">
                <CheckCircle className="w-3 h-3" />
                Concluído
              </span>
            )}
            {scoutingRound?.cycles && scoutingRound.cycles.length > 0 && (
              <span className="text-xs text-slate-400">
                {scoutingRound.cycles.length} ciclo{scoutingRound.cycles.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {isDone ? (
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={onViewScouting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Eye className="w-3 h-3" />
                Ver resultado
              </button>
              <button
                onClick={onEditScouting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                Continuar
              </button>
              <button
                onClick={onStartScouting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Refazer
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {isLocked && (
                <span className="text-xs text-yellow-400 px-2 py-0.5 bg-yellow-900/20 border border-yellow-800/30 rounded-md">
                  Em uso
                </span>
              )}
              <button
                onClick={() => {
                  if (isLocked) {
                    if (confirm('Este scout está em uso. Deseja entrar mesmo assim?')) {
                      onEditScouting?.();
                    }
                  } else {
                    onStartScouting();
                  }
                }}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${btnClass}`}
              >
                <PlayCircle className="w-3 h-3" />
                {isLocked ? 'Continuar scout' : 'Iniciar scout'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
