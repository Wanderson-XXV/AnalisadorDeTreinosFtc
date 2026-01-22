"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface EvolutionChartProps {
  data: Array<{
    roundNumber: number;
    date: string;
    avgTime: number;
    cycleCount: number;
    hits: number;
    misses: number;
  }>;
}

export function EvolutionChart({ data }: EvolutionChartProps) {
  const safeData = data ?? [];

  const chartData = useMemo(() => {
    return safeData?.map((item) => ({
      ...item,
      avgTimeSeconds: ((item?.avgTime ?? 0) / 1000).toFixed(2),
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
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="roundNumber"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
            label={{ value: "Round", position: "insideBottom", offset: -5, style: { fontSize: 11, fill: "#94a3b8" } }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
            label={{ value: "Tempo (s)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px", fontSize: 11 }}
            labelStyle={{ color: "#f1f5f9" }}
          />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="avgTimeSeconds"
            name="Tempo Médio"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ fill: "#f97316", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
