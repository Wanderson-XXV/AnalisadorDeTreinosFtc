"use client";

import { useState, useEffect } from "react";
import { Download, TrendingUp, Clock, Target, BarChart3, Calendar } from "lucide-react";
import { StatsCards } from "./stats-cards";
import { CycleTimeChart } from "./charts/cycle-time-chart";
import { IntervalChart } from "./charts/interval-chart";
import { EvolutionChart } from "./charts/evolution-chart";
import { DailyStatsTable } from "./daily-stats-table";

interface GeneralStats {
  totalRounds: number;
  totalCycles: number;
  avgCyclesPerRound: number;
  avgCycleTime: number;
  minCycleTime: number;
  maxCycleTime: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
}

interface IntervalStats {
  interval: string;
  count: number;
  avgTime: number;
  hits: number;
  misses: number;
}

interface DayStats {
  date: string;
  rounds: number;
  totalCycles: number;
  avgCycleTime: number;
}

interface EvolutionData {
  roundNumber: number;
  date: string;
  avgTime: number;
  cycleCount: number;
  hits: number;
  misses: number;
}

type DateRange = "today" | "7days" | "30days" | "year" | "all" | "custom";

interface DashboardContentProps {
  dateRange: DateRange;
  customStartDate?: string;
  customEndDate?: string;
}

export function DashboardContent({ dateRange, customStartDate, customEndDate }: DashboardContentProps) {
  const [stats, setStats] = useState<{
    general: GeneralStats;
    statsByInterval: IntervalStats[];
    dailyStats: DayStats[];
    evolutionData: EvolutionData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [dateRange, customStartDate, customEndDate]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (dateRange !== "all") {
        params.append("range", dateRange);
        
        if (dateRange === "custom" && customStartDate && customEndDate) {
          params.append("startDate", customStartDate);
          params.append("endDate", customEndDate);
        }
      }

      const response = await fetch(`/api/stats?${params.toString()}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      
      if (dateRange !== "all") {
        params.append("range", dateRange);
        
        if (dateRange === "custom" && customStartDate && customEndDate) {
          params.append("startDate", customStartDate);
          params.append("endDate", customEndDate);
        }
      }

      const response = await fetch(`/api/export?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ftc_cycles_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-slate-400">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Erro ao carregar dados</p>
      </div>
    );
  }

  const safeGeneral = stats?.general ?? {};
  const safeStatsByInterval = stats?.statsByInterval ?? [];
  const safeDailyStats = stats?.dailyStats ?? [];
  const safeEvolutionData = stats?.evolutionData ?? [];

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <StatsCards stats={safeGeneral as GeneralStats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-bold text-white">Evolução dos Tempos</h3>
          </div>
          <EvolutionChart data={safeEvolutionData} />
        </div>

        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Performance por Intervalo</h3>
          </div>
          <IntervalChart data={safeStatsByInterval} />
        </div>

        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-bold text-white">Ciclos e Acertos por Round</h3>
          </div>
          <CycleTimeChart data={safeEvolutionData} />
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Estatísticas por Dia</h3>
        </div>
        <DailyStatsTable data={safeDailyStats} />
      </div>
    </div>
  );
}