"use client";

import { Activity, Clock, Target, TrendingDown, TrendingUp, Zap } from "lucide-react";

interface StatsCardsProps {
  stats: {
    totalRounds: number;
    totalCycles: number;
    avgCyclesPerRound: number;
    avgCycleTime: number;
    minCycleTime: number;
    maxCycleTime: number;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const safeStats = stats ?? {};

  const formatTime = (ms: number) => {
    const safeMs = ms ?? 0;
    return (safeMs / 1000).toFixed(2) + "s";
  };

  const cards = [
    {
      label: "Total Rounds",
      value: safeStats?.totalRounds ?? 0,
      icon: Activity,
      color: "text-orange-400",
      bg: "from-orange-500/20 to-orange-500/5",
    },
    {
      label: "Total Ciclos",
      value: safeStats?.totalCycles ?? 0,
      icon: Zap,
      color: "text-blue-400",
      bg: "from-blue-500/20 to-blue-500/5",
    },
    {
      label: "Média de Ciclos por Round",
      value: safeStats?.avgCyclesPerRound ?? 0,
      icon: Target,
      color: "text-purple-400",
      bg: "from-purple-500/20 to-purple-500/5",
    },
    {
      label: "Tempo Médio",
      value: formatTime(safeStats?.avgCycleTime ?? 0),
      icon: Clock,
      color: "text-green-400",
      bg: "from-green-500/20 to-green-500/5",
    },
    {
      label: "Menor Tempo de ciclo",
      value: formatTime(safeStats?.minCycleTime ?? 0),
      icon: TrendingDown,
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-emerald-500/5",
    },
    {
      label: "Maior Tempo de ciclo",
      value: formatTime(safeStats?.maxCycleTime ?? 0),
      icon: TrendingUp,
      color: "text-red-400",
      bg: "from-red-500/20 to-red-500/5",
    },
    {
      label: "Total Acertos",
      value: safeStats?.totalHits ?? 0,
      icon: Target,
      color: "text-green-400",
      bg: "from-green-500/20 to-green-500/5",
    },
    {
      label: "Taxa de Acerto",
      value: `${safeStats?.hitRate ?? 0}%`,
      icon: Activity,
      color: "text-yellow-400",
      bg: "from-yellow-500/20 to-yellow-500/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards?.map((card, index) => {
        const Icon = card?.icon;
        return (
          <div
            key={index}
            className={`bg-gradient-to-br ${card?.bg ?? ""} backdrop-blur rounded-xl p-4 border border-slate-700/50`}
          >
            <div className="flex items-center gap-2 mb-2">
              {Icon && <Icon className={`w-4 h-4 ${card?.color ?? ""}`} />}
              <span className="text-xs text-slate-400">{card?.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card?.color ?? ""}`}>{card?.value}</p>
          </div>
        );
      })}
    </div>
  );
}
