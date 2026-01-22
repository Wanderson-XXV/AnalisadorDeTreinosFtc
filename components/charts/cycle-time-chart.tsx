"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface CycleTimeChartProps {
  data: Array<{
    roundNumber: number;
    date: string;
    avgTime: number;
    cycleCount: number;
    hits: number;
    misses: number;
  }>;
}

export function CycleTimeChart({ data }: CycleTimeChartProps) {
  const safeData = data ?? [];

  const chartData = useMemo(() => {
    return safeData?.map((item) => ({
      roundNumber: item?.roundNumber ?? 0,
      date: item?.date ?? "",
      cycleCount: item?.cycleCount ?? 0,
      hits: item?.hits ?? 0,
      misses: item?.misses ?? 0,
      hitRate: (item?.hits ?? 0) + (item?.misses ?? 0) > 0
        ? Math.round(((item?.hits ?? 0) / ((item?.hits ?? 0) + (item?.misses ?? 0))) * 100)
        : 0,
    })) ?? [];
  }, [safeData]);

  if (chartData?.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="roundNumber"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
            label={{ value: "Round", position: "insideBottom", offset: -5, style: { fontSize: 11, fill: "#94a3b8" } }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
            label={{ value: "Quantidade", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px", fontSize: 11 }}
            labelStyle={{ color: "#f1f5f9" }}
          />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="cycleCount" name="Ciclos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="hits" name="Acertos" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="misses" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="hitRate" name="Taxa Acerto %" stroke="#fbbf24" strokeWidth={2} dot={{ fill: "#fbbf24", r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
