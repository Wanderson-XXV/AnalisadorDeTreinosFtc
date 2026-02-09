import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { EvolutionData } from '../../lib/types';

interface CycleTimeChartProps {
  data: EvolutionData[];
}

export function CycleTimeChart({ data }: CycleTimeChartProps) {
  const chartData = useMemo(() => {
    return (data ?? []).map((item) => {
      const total = (item?.hits ?? 0) + (item?.misses ?? 0);
      return {
        ...item,
        hitRate: total > 0 ? Math.round(((item?.hits ?? 0) / total) * 100) : 0,
      };
    });
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
      <ComposedChart data={chartData}>
        <XAxis
          dataKey="roundNumber"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#475569' }}
          tickLine={{ stroke: '#475569' }}
          label={{ value: 'Round', position: 'bottom', fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#475569' }}
          tickLine={{ stroke: '#475569' }}
          label={{ value: 'Quantidade', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#475569' }}
          tickLine={{ stroke: '#475569' }}
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
        <Bar yAxisId="left" dataKey="cycleCount" name="Ciclos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="hits" name="Acertos" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="left" dataKey="misses" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="hitRate"
          name="Taxa Acerto (%)"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ fill: '#f97316' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
