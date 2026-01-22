"use client";

import { cn } from "@/lib/utils";

interface TimerDisplayProps {
  timeMs: number;
  isRunning: boolean;
  totalMs?: number;
}

export function TimerDisplay({ timeMs, isRunning, totalMs = 120000 }: TimerDisplayProps) {
  const safeTimeMs = timeMs ?? 0;
  const safeTotalMs = totalMs ?? 120000;
  
  const minutes = Math.floor(safeTimeMs / 60000);
  const seconds = Math.floor((safeTimeMs % 60000) / 1000);
  const ms = Math.floor((safeTimeMs % 1000) / 10);
  
  const progress = (safeTimeMs / safeTotalMs) * 100;
  const isNearEnd = safeTimeMs >= safeTotalMs * 0.75;
  const isOvertime = safeTimeMs >= safeTotalMs;

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "timer-display text-7xl md:text-8xl font-bold tracking-tight transition-colors duration-300",
          isOvertime ? "text-red-500" : isNearEnd ? "text-yellow-400" : "text-white"
        )}
      >
        <span>{String(minutes).padStart(2, "0")}</span>
        <span className={cn("mx-1", isRunning && "animate-pulse")}>:</span>
        <span>{String(seconds).padStart(2, "0")}</span>
        <span className="text-4xl text-slate-500">.{String(ms).padStart(2, "0")}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md mt-6 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-100 rounded-full",
            isOvertime
              ? "bg-red-500"
              : isNearEnd
              ? "bg-yellow-400"
              : "bg-gradient-to-r from-orange-500 to-blue-500"
          )}
          style={{ width: `${Math.min(progress ?? 0, 100)}%` }}
        />
      </div>

      {/* Time interval indicator */}
      <div className="flex gap-1 mt-3">
        {["0-30s", "30-60s", "60-90s", "90-120s"]?.map((interval, idx) => {
          const intervalStart = idx * 30000;
          const isActive = safeTimeMs >= intervalStart && safeTimeMs < intervalStart + 30000;
          const isPast = safeTimeMs >= intervalStart + 30000;
          return (
            <div
              key={interval}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-all",
                isActive
                  ? "bg-orange-500 text-white"
                  : isPast
                  ? "bg-slate-600 text-slate-300"
                  : "bg-slate-700 text-slate-500"
              )}
            >
              {interval}
            </div>
          );
        })}
      </div>
    </div>
  );
}
