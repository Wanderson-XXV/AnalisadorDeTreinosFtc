"use client";

import { Calendar } from "lucide-react";

interface DailyStatsTableProps {
  data: Array<{
    date: string;
    rounds: number;
    totalCycles: number;
    avgCycleTime: number;
  }>;
}

export function DailyStatsTable({ data }: DailyStatsTableProps) {
  const safeData = data ?? [];

  if (safeData?.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum dado disponível</p>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const safeMs = ms ?? 0;
    return (safeMs / 1000).toFixed(2) + "s";
  };

  const formatDate = (dateStr: string) => {
    const safeDateStr = dateStr ?? "";
    try {
      const date = new Date(safeDateStr + "T00:00:00");
      return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    } catch {
      return safeDateStr;
    }
  };

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
          {safeData?.map((row, index) => (
            <tr
              key={row?.date ?? index}
              className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
            >
              <td className="py-3 px-4 text-white font-medium">{formatDate(row?.date ?? "")}</td>
              <td className="py-3 px-4 text-center text-orange-400 font-semibold">{row?.rounds ?? 0}</td>
              <td className="py-3 px-4 text-center text-blue-400 font-semibold">{row?.totalCycles ?? 0}</td>
              <td className="py-3 px-4 text-center text-green-400 font-semibold">{formatTime(row?.avgCycleTime ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
