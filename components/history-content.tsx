"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Target, ChevronDown, ChevronUp, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Cycle {
  id: string;
  cycleNumber: number;
  duration: number;
  hits: number;
  misses: number;
  timestamp: number;
  timeInterval: string;
}

interface Round {
  id: string;
  startTime: string;
  endTime: string | null;
  observations: string | null;
  totalDuration: number | null;
  cycles: Cycle[];
  createdAt: string;
}

export function HistoryContent() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");

  useEffect(() => {
    fetchRounds();
  }, [dateFilter]);

  const fetchRounds = async () => {
    try {
      setLoading(true);
      const url = dateFilter ? `/api/rounds?date=${dateFilter}` : "/api/rounds";
      const response = await fetch(url);
      const data = await response.json();
      setRounds(data ?? []);
    } catch (error) {
      console.error("Error fetching rounds:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este round?")) return;

    try {
      await fetch(`/api/rounds/${id}`, { method: "DELETE" });
      setRounds((rounds ?? []).filter((r) => r?.id !== id));
    } catch (error) {
      console.error("Error deleting round:", error);
    }
  };

  const formatDuration = (ms: number) => {
    const safeMs = ms ?? 0;
    const minutes = Math.floor(safeMs / 60000);
    const seconds = Math.floor((safeMs % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const formatCycleTime = (ms: number) => {
    return ((ms ?? 0) / 1000).toFixed(2) + "s";
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr ?? new Date()).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr ?? "";
    }
  };

  const getRoundStats = (round: Round) => {
    const cycles = round?.cycles ?? [];
    const durations = cycles?.map((c) => c?.duration ?? 0) ?? [];
    return {
      totalCycles: cycles?.length ?? 0,
      avgTime: durations?.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      totalHits: cycles.reduce((sum, c) => sum + (c?.hits ?? 0), 0),
      totalMisses: cycles.reduce((sum, c) => sum + (c?.misses ?? 0), 0),
    };
  };

  const safeRounds = rounds ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700">
        <label className="flex items-center gap-2 text-slate-300">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Filtrar por data:</span>
        </label>
        <input
          type="date"
          value={dateFilter ?? ""}
          onChange={(e) => setDateFilter(e?.target?.value ?? "")}
          className="mt-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="ml-2 text-sm text-orange-400 hover:text-orange-300"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Rounds List */}
      {safeRounds?.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Nenhum round registrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {safeRounds?.map((round) => {
            const stats = getRoundStats(round);
            const isExpanded = expandedRound === round?.id;

            return (
              <div
                key={round?.id}
                className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Round Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => setExpandedRound(isExpanded ? null : (round?.id ?? null))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-blue-500/20">
                        <Clock className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{formatDate(round?.startTime ?? "")}</p>
                        <p className="text-sm text-slate-400">
                          Duração: {formatDuration(round?.totalDuration ?? 0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Quick Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-400">
                          <span className="font-bold">{stats?.totalCycles ?? 0}</span> ciclos
                        </span>
                        <span className="text-green-400">
                          <Check className="w-4 h-4 inline" /> {stats?.totalHits ?? 0}
                        </span>
                        <span className="text-red-400">
                          <X className="w-4 h-4 inline" /> {stats?.totalMisses ?? 0}
                        </span>
                        <span className="text-orange-400">
                          Ø {formatCycleTime(stats?.avgTime ?? 0)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(round?.id ?? "");
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-700 p-4 bg-slate-800/30">
                    {/* Observations */}
                    {round?.observations && (
                      <div className="mb-4 p-3 bg-slate-700/50 rounded-lg">
                        <p className="text-sm text-slate-400 mb-1">Observações:</p>
                        <p className="text-white">{round?.observations}</p>
                      </div>
                    )}

                    {/* Cycles Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-3 text-sm font-medium text-slate-400">#</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-slate-400">Tempo</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-slate-400">Intervalo</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-slate-400">Acertos</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-slate-400">Erros</th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-slate-400">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(round?.cycles ?? [])?.map((cycle) => (
                            <tr
                              key={cycle?.id}
                              className="border-b border-slate-700/50 hover:bg-slate-700/20"
                            >
                              <td className="py-2 px-3 text-white font-medium">#{cycle?.cycleNumber ?? 0}</td>
                              <td className="py-2 px-3 text-center text-orange-400 font-semibold">
                                {formatCycleTime(cycle?.duration ?? 0)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="px-2 py-1 rounded text-xs bg-slate-600 text-slate-300">
                                  {cycle?.timeInterval ?? "N/A"}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center text-green-400 font-semibold">{cycle?.hits ?? 0}</td>
                              <td className="py-2 px-3 text-center text-red-400 font-semibold">{cycle?.misses ?? 0}</td>
                              <td className="py-2 px-3 text-center text-slate-400">
                                {formatCycleTime(cycle?.timestamp ?? 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Interval Summary */}
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {["0-30s", "30-60s", "60-90s", "90-120s"]?.map((interval) => {
                        const intervalCycles = (round?.cycles ?? []).filter((c) => c?.timeInterval === interval);
                        return (
                          <div
                            key={interval}
                            className="bg-slate-700/50 rounded-lg p-3 text-center"
                          >
                            <p className="text-xs text-slate-400">{interval}</p>
                            <p className="text-lg font-bold text-white">{intervalCycles?.length ?? 0}</p>
                            <p className="text-xs text-slate-500">ciclos</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
