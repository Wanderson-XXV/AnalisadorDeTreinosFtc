import { Calendar, TrendingUp, Target, Clock } from 'lucide-react';
import type { DailyStats } from '../lib/types';
import { formatDuration } from '../lib/utils';

interface DailyStatsTableProps {
  dailyStats: DailyStats[];
}

export function DailyStatsTable({ dailyStats }: DailyStatsTableProps) {
  if (!dailyStats || dailyStats.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Nenhum dado disponível para o período selecionado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-4 px-4 text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Data
              </div>
            </th>
            <th className="text-center py-4 px-4 text-slate-400 font-medium">
              <div className="flex items-center justify-center gap-2">
                <Target className="w-4 h-4" />
                Rounds
              </div>
            </th>
            <th className="text-center py-4 px-4 text-slate-400 font-medium">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ciclos
              </div>
            </th>
            <th className="text-center py-4 px-4 text-slate-400 font-medium">Acertos</th>
            <th className="text-center py-4 px-4 text-slate-400 font-medium">Erros</th>
            <th className="text-center py-4 px-4 text-slate-400 font-medium">Taxa</th>
            <th className="text-center py-4 px-4 text-slate-400 font-medium">
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Tempo Médio
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {dailyStats.map((day) => {
            const accuracy = day.totalHits + day.totalMisses > 0
              ? ((day.totalHits / (day.totalHits + day.totalMisses)) * 100).toFixed(1)
              : '0.0';

            return (
              <tr
                key={day.date}
                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                <td className="py-4 px-4 text-white font-medium">
                  {new Date(day.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="py-4 px-4 text-center text-white font-bold">
                  {day.totalRounds}
                </td>
                <td className="py-4 px-4 text-center text-white font-bold">
                  {day.totalCycles}
                </td>
                <td className="py-4 px-4 text-center text-green-400 font-bold">
                  {day.totalHits}
                </td>
                <td className="py-4 px-4 text-center text-red-400 font-bold">
                  {day.totalMisses}
                </td>
                <td className="py-4 px-4 text-center">
                  <span
                    className={`font-bold ${
                      parseFloat(accuracy) >= 80
                        ? 'text-green-400'
                        : parseFloat(accuracy) >= 60
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {accuracy}%
                  </span>
                </td>
                <td className="py-4 px-4 text-center text-slate-300 font-mono">
                  {formatDuration(day.avgCycleTime)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}