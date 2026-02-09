import { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, Trash2, Calendar, Check, X } from 'lucide-react';
import type { RoundData } from '../lib/types';
import { cn, formatTime, formatDate } from '../lib/utils';
import { API_BASE } from '../lib/api';

export function HistoryContent() {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');

  const fetchRounds = useCallback(async () => {
    try {
      setLoading(true);
      const params = dateFilter ? `?date=${dateFilter}` : '';
      const response = await fetch(`${API_BASE}/rounds.php${params}`);
      const data = await response.json();
      setRounds(data);
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este round?')) return;
    
    try {
      await fetch(`${API_BASE}/rounds.php?id=${id}`, { method: 'DELETE' });
      setRounds(rounds.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Error deleting round:', error);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '--';
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const getRoundStats = (round: RoundData) => {
    const cycles = round?.cycles ?? [];
    const totalCycles = cycles.length;
    const avgTime = totalCycles > 0
      ? cycles.reduce((sum, c) => sum + (c?.duration ?? 0), 0) / totalCycles
      : 0;
    const hits = cycles.reduce((sum, c) => sum + (c?.hits ?? 0), 0);
    const misses = cycles.reduce((sum, c) => sum + (c?.misses ?? 0), 0);
    return { totalCycles, avgTime, hits, misses };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro por data */}
      <div className="flex items-center gap-4">
        <Calendar className="w-5 h-5 text-slate-400" />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="text-sm text-slate-400 hover:text-white"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Lista de rounds */}
      {rounds.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum round registrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => {
            const stats = getRoundStats(round);
            const isExpanded = expandedRound === round.id;

            return (
              <div
                key={round.id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/30"
                  onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-white font-medium">
                        {new Date(round.start_time).toLocaleDateString('pt-BR', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-sm text-slate-400">
                        Duração: {formatDuration(round.total_duration)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-400">
                        <span className="text-white font-bold">{stats.totalCycles}</span> ciclos
                      </span>
                      <span className="text-green-400 flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        {stats.hits}
                      </span>
                      <span className="text-red-400 flex items-center gap-1">
                        <X className="w-4 h-4" />
                        {stats.misses}
                      </span>
                      <span className="text-orange-400">
                        {formatTime(stats.avgTime)} méd
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(round.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="border-t border-slate-700 p-4 space-y-4">
                    {/* Observações */}
                    {round.observations && (
                      <div className="p-3 bg-slate-700/30 rounded-lg">
                        <p className="text-sm text-slate-400 mb-1">Observações:</p>
                        <p className="text-white">{round.observations}</p>
                      </div>
                    )}

                    {/* Tabela de ciclos */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-600">
                            <th className="text-left py-2 px-3 text-xs text-slate-400">#</th>
                            <th className="text-left py-2 px-3 text-xs text-slate-400">Tempo</th>
                            <th className="text-left py-2 px-3 text-xs text-slate-400">Intervalo</th>
                            <th className="text-center py-2 px-3 text-xs text-slate-400">Acertos</th>
                            <th className="text-center py-2 px-3 text-xs text-slate-400">Erros</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(round.cycles ?? []).map((cycle) => (
                            <tr key={cycle.id} className="border-b border-slate-700/50">
                              <td className="py-2 px-3 text-slate-400">#{cycle.cycleNumber}</td>
                              <td className="py-2 px-3 text-white font-medium">
                                {formatTime(cycle.duration)}
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                                  {cycle.timeInterval}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center text-green-400">{cycle.hits}</td>
                              <td className="py-2 px-3 text-center text-red-400">{cycle.misses}</td>
                              <td className="py-2 px-3 text-right text-slate-500 text-sm">
                                {formatTime(cycle.timestamp)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumo por intervalo */}
                    <div className="grid grid-cols-4 gap-2">
                      {['0-30s', '30-60s', '60-90s', '90-120s'].map((interval) => {
                        const intervalCycles = (round.cycles ?? []).filter(
                          (c) => c.timeInterval === interval
                        );
                        return (
                          <div
                            key={interval}
                            className="bg-slate-700/30 rounded-lg p-2 text-center"
                          >
                            <p className="text-xs text-slate-400">{interval}</p>
                            <p className="text-lg font-bold text-white">{intervalCycles.length}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
