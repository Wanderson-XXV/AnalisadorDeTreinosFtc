import { Activity, Clock, Target, Zap, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import type{ GeneralStats } from '../lib/types';
import { formatTime } from '../lib/utils';

interface StatsCardsProps {
  stats: GeneralStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: 'Total Rounds',
      value: stats?.totalRounds ?? 0,
      icon: Activity,
      color: 'text-blue-400',
      bg: 'from-blue-500/20 to-blue-600/10',
    },
    {
      label: 'Total Ciclos',
      value: stats?.totalCycles ?? 0,
      icon: Zap,
      color: 'text-orange-400',
      bg: 'from-orange-500/20 to-orange-600/10',
    },
    {
      label: 'Tempo Médio',
      value: formatTime(stats?.avgCycleTime ?? 0),
      icon: Clock,
      color: 'text-purple-400',
      bg: 'from-purple-500/20 to-purple-600/10',
    },
    {
      label: 'Total Acertos',
      value: stats?.totalHits ?? 0,
      icon: Target,
      color: 'text-green-400',
      bg: 'from-green-500/20 to-green-600/10',
    },
    {
      label: 'Taxa de Acerto',
      value: `${stats?.hitRate ?? 0}%`,
      icon: Percent,
      color: 'text-cyan-400',
      bg: 'from-cyan-500/20 to-cyan-600/10',
    },
    {
      label: 'Menor Tempo',
      value: formatTime(stats?.minCycleTime ?? 0),
      icon: TrendingDown,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/20 to-emerald-600/10',
    },
    {
      label: 'Personal Best',
      value: stats?.personalBest ?? 0,
      icon: Target,
      color: 'text-rose-400',
      bg: 'from-rose-500/20 to-rose-600/10',
    },
    {
      label: 'Ciclos/Round',
      value: stats?.avgCyclesPerRound ?? 0,
      icon: Activity,
      color: 'text-amber-400',
      bg: 'from-amber-500/20 to-amber-600/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`bg-gradient-to-br ${card.bg} rounded-xl p-4 border border-slate-700/50`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs text-slate-400">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
