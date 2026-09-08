import { X, Target, Crosshair, Zap, AlertTriangle, FileText, Lightbulb, User, ExternalLink } from 'lucide-react';
import type { ScoutingRound } from '../../lib/types';

interface ScoutingViewModalProps {
  scoutingRound: ScoutingRound;
  teamNumber: number;
  teamName?: string | null;
  alliance: 'red' | 'blue';
  onClose: () => void;
  onViewProfile?: () => void;
}

export function ScoutingViewModal({ scoutingRound, teamNumber, teamName, alliance, onClose, onViewProfile }: ScoutingViewModalProps) {
  const cycles = scoutingRound.cycles ?? [];
  const autoCycles = cycles.filter(c => c.is_autonomous);
  const teleopCycles = cycles.filter(c => !c.is_autonomous);

  const autoHits = autoCycles.reduce((s, c) => s + c.hits, 0);
  const autoMisses = autoCycles.reduce((s, c) => s + c.misses, 0);
  const teleopHits = teleopCycles.reduce((s, c) => s + c.hits, 0);
  const teleopMisses = teleopCycles.reduce((s, c) => s + c.misses, 0);
  const totalHits = autoHits + teleopHits;
  const totalMisses = autoMisses + teleopMisses;
  const totalAttempts = totalHits + totalMisses;
  const hitRate = totalAttempts > 0 ? ((totalHits / totalAttempts) * 100).toFixed(1) : '0.0';

  const isRed = alliance === 'red';
  const accentColor = isRed ? 'text-red-400' : 'text-blue-400';
  const borderColor = isRed ? 'border-red-800/40' : 'border-blue-800/40';

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className={`text-xl font-bold ${accentColor}`}>#{teamNumber}</h2>
            {teamName && <p className="text-sm text-slate-400">{teamName}</p>}
          </div>
          <div className="flex items-center gap-2">
            {onViewProfile && (
              <button
                onClick={onViewProfile}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 border border-orange-500/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver Perfil
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {scoutingRound.scout_username && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <User className="w-4 h-4" />
              <span>Scout: <span className="text-white font-medium">{scoutingRound.scout_username}</span></span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 text-center">
              <Target className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-white">{totalHits}</p>
              <p className="text-xs text-slate-400">Acertos Totais</p>
            </div>
            <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-4 text-center">
              <Crosshair className="w-5 h-5 text-orange-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-white">{hitRate}%</p>
              <p className="text-xs text-slate-400">% de Acerto</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`border ${borderColor} rounded-xl p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold text-white">Autônomo</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Acertos</span>
                  <span className="text-emerald-400 font-medium">{autoHits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Erros</span>
                  <span className="text-red-400 font-medium">{autoMisses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ciclos</span>
                  <span className="text-white font-medium">{autoCycles.length}</span>
                </div>
              </div>
            </div>

            <div className={`border ${borderColor} rounded-xl p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">TeleOp</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Acertos</span>
                  <span className="text-emerald-400 font-medium">{teleopHits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Erros</span>
                  <span className="text-red-400 font-medium">{teleopMisses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ciclos</span>
                  <span className="text-white font-medium">{teleopCycles.length}</span>
                </div>
              </div>
            </div>
          </div>

          {scoutingRound.observations && (
            <div className="bg-slate-700/30 border border-slate-600 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Observações</span>
              </div>
              <p className="text-sm text-slate-300">{scoutingRound.observations}</p>
            </div>
          )}

          {scoutingRound.robot_issues && (
            <div className="bg-red-900/10 border border-red-800/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Problemas do Robô</span>
              </div>
              <p className="text-sm text-slate-300">{scoutingRound.robot_issues}</p>
            </div>
          )}

          {scoutingRound.strategy_notes && (
            <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Notas de Estratégia</span>
              </div>
              <p className="text-sm text-slate-300">{scoutingRound.strategy_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}