"use client";

import { Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CycleData } from "@/lib/types";

interface CycleListProps {
  cycles: CycleData[];
}

export function CycleList({ cycles }: CycleListProps) {
  const safeCycles = cycles ?? [];

  if (safeCycles?.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum ciclo registrado</p>
        <p className="text-sm">Pressione ESPAÇO para marcar</p>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    const safeMs = ms ?? 0;
    return (safeMs / 1000).toFixed(2) + "s";
  };

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
      {safeCycles?.map((cycle, index) => (
        <div
          key={cycle?.id ?? index}
          className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3 border border-slate-600/50"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-400">#{cycle?.cycleNumber ?? index + 1}</span>
            <span className="text-lg font-bold text-white">{formatDuration(cycle?.duration ?? 0)}</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded",
              "bg-slate-600 text-slate-300"
            )}>
              {cycle?.timeInterval ?? "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-green-400">
              <Check className="w-4 h-4" />
              <span className="font-medium">{cycle?.hits ?? 0}</span>
            </div>
            <div className="flex items-center gap-1 text-red-400">
              <X className="w-4 h-4" />
              <span className="font-medium">{cycle?.misses ?? 0}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
