import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { EvolutionData } from '../../lib/types';

interface EvolutionChartProps {
  data: EvolutionData[];
}

export function EvolutionChart({ data }: EvolutionChartProps) {
  const chartData = useMemo(() => {
    return (data ?? []).map((item) => ({
      ...item,
      avgTimeSeconds: ((item?.avgTime ?? 0) / 1000).toFixed(2),
    }));
  }, [data]);

  if (!chartData?.length) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-500">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <XAxis
          dataKey="roundNumber"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#475569' }}
          tickLine={{ stroke: '#475569' }}
          label={{ value: 'Round', position: 'bottom', fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#475569' }}
          tickLine={{ stroke: '#475569' }}
          label={{ value: 'Tempo (s)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#f8fafc' }}
          itemStyle={{ color: '#f97316' }}
        />
        <Legend wrapperStyle={{ paddingTop: 20 }} />
        <Line
          type="monotone"
          dataKey="avgTimeSeconds"
          name="Tempo Médio"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ fill: '#f97316', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#f97316' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
