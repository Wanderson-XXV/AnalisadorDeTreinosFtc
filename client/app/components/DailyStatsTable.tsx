import { Calendar } from 'lucide-react';
import type { DayStats } from '../lib/types';
import { formatTime, formatDate } from '../lib/utils';

interface DailyStatsTableProps {
  data: DayStats[];
}

export function DailyStatsTable({ data }: DailyStatsTableProps) {
  const safeData = data ?? [];

  if (safeData.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum dado disponível</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Data</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Rounds</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Ciclos</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Tempo Médio</th>
          </tr>
        </thead>
        <tbody>
          {safeData.map((day) => (
            <tr key={day.date} className="border-b border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-3 px-4 text-white">{formatDate(day.date)}</td>
              <td className="py-3 px-4 text-center text-slate-300">{day.rounds}</td>
              <td className="py-3 px-4 text-center text-slate-300">{day.totalCycles}</td>
              <td className="py-3 px-4 text-center text-orange-400 font-medium">
                {formatTime(day.avgCycleTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
