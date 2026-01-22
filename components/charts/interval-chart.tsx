"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

interface IntervalChartProps {
  data: Array<{
    interval: string;
    count: number;
    avgTime: number;
    hits: number;
    misses: number;
  }>;
}

const COLORS = ["#60B5FF", "#FF9149", "#80D8C3", "#FF90BB"];

export function IntervalChart({ data }: IntervalChartProps) {
  const safeData = data ?? [];

  const chartData = useMemo(() => {
    return safeData?.map((item) => ({
      ...item,
      avgTimeSeconds: Number(((item?.avgTime ?? 0) / 1000).toFixed(2)),
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
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="interval"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#475569" }}
            label={{ value: "Tempo Médio (s)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px", fontSize: 11 }}
            labelStyle={{ color: "#f1f5f9" }}
          />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="avgTimeSeconds" name="Tempo Médio" radius={[4, 4, 0, 0]}>
            {chartData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS?.length] ?? "#60B5FF"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}