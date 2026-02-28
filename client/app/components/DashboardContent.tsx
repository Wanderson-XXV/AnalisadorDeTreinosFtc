import { useState, useCallback } from 'react';
import { Download, TrendingUp, Clock, Target, Calendar, Filter, BarChart3 } from 'lucide-react';
import { StatsCards } from './StatsCards';
import { CycleTimeChart } from './charts/CycleTimeChart';
import { IntervalChart } from './charts/IntervalChart';
import { EvolutionChart } from './charts/EvolutionChart';
import { DailyStatsTable } from './DailyStatsTable';
import { PeriodFilter } from './PeriodFilter';
import { useStats } from '../hooks/useStats';
import { API_BASE } from '../lib/api';

export function DashboardContent() {
  const [dateRange, setDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null,
  });

  const { stats, loading, error } = useStats(dateRange);

  const handleFilterChange = (startDate: string | null, endDate: string | null) => {
    setDateRange({ startDate, endDate });
  };

  const handleExport = async () => {
    try {
      window.location.href = `${API_BASE}/export.php`;
    } catch (error) {
      console.error('Error exporting:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-12 text-slate-400">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Erro ao carregar dados</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pr-2 pb-2">
      {/* Filtros e Export */}
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-bold text-white">Filtrar por Período</h3>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
        <PeriodFilter onFilterChange={handleFilterChange} />
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats.general} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-bold text-white">Evolução dos Tempos</h3>
          </div>
          <EvolutionChart data={stats.evolutionData} />
        </div>

        {/* Interval Performance */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Performance por Intervalo</h3>
          </div>
          <IntervalChart data={stats.statsByInterval} />
        </div>

        {/* Cycle Count Evolution */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-bold text-white">Ciclos e Acertos por Round</h3>
          </div>
          <CycleTimeChart data={stats.evolutionData} />
        </div>
      </div>

      {/* Daily Stats Table */}
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Estatísticas por Dia</h3>
        </div>
        <DailyStatsTable dailyStats={stats.dailyStats} />
      </div>
    </div>
  );
}
