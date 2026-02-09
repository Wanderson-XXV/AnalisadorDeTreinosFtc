import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import type { IntervalStats } from '../../lib/types';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7'];

interface IntervalChartProps {
  data: IntervalStats[];
}

export function IntervalChart({ data }: IntervalChartProps) {
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
      <BarChart data={chartData}>
        <XAxis
          dataKey="interval"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#475569' }}
          tickLine={{ stroke: '#475569' }}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#475569' }}
          tickLine={{ stroke: '#475569' }}
          label={{ value: 'Qtd Ciclos', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#f8fafc' }}
        />
        <Legend wrapperStyle={{ paddingTop: 20 }} />
        <Bar dataKey="count" name="Ciclos" radius={[4, 4, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
