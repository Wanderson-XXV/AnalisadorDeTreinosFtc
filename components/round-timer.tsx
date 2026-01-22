"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Square, Flag, RefreshCw, XCircle } from "lucide-react";
import { TimerDisplay } from "./timer-display";
import { CycleModal } from "./cycle-modal";
import { CycleList } from "./cycle-list";
import { CycleData } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUND_DURATION = 120000; // 2 minutes

function getTimeInterval(timestamp: number): string {
  const safeTimestamp = timestamp ?? 0;
  if (safeTimestamp < 30000) return "0-30s";
  if (safeTimestamp < 60000) return "30-60s";
  if (safeTimestamp < 90000) return "60-90s";
  return "90-120s";
}

export function RoundTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingCycle, setPendingCycle] = useState<{ duration: number; timestamp: number } | null>(null);
  const [lastCycleEnd, setLastCycleEnd] = useState(0);
  
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - elapsedTime;
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 10);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !showModal) {
        e.preventDefault();
        if (isRunning) {
          handleMarkCycle();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, showModal, elapsedTime, lastCycleEnd, cycles]);

  const handleStart = async () => {
    try {
      const response = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: new Date().toISOString() }),
      });
      const data = await response.json();
      setRoundId(data?.id ?? null);
      setIsRunning(true);
      setElapsedTime(0);
      setLastCycleEnd(0);
      setCycles([]);
      setObservations("");
    } catch (error) {
      console.error("Error starting round:", error);
    }
  };

  const handleMarkCycle = useCallback(() => {
    if (!isRunning) return;
    
    const currentTime = elapsedTime ?? 0;
    const safeLastCycleEnd = lastCycleEnd ?? 0;
    const cycleDuration = currentTime - safeLastCycleEnd;
    
    setPendingCycle({
      duration: cycleDuration,
      timestamp: currentTime,
    });
    setShowModal(true);
  }, [isRunning, elapsedTime, lastCycleEnd]);

  const handleCycleSubmit = async (hits: number, misses: number) => {
    if (!pendingCycle || !roundId) return;

    const safeCycles = cycles ?? [];
    const cycleNumber = safeCycles?.length + 1;
    const newCycle: CycleData = {
      cycleNumber,
      duration: pendingCycle?.duration ?? 0,
      hits: hits ?? 0,
      misses: misses ?? 0,
      timestamp: pendingCycle?.timestamp ?? 0,
      timeInterval: getTimeInterval(pendingCycle?.timestamp ?? 0),
    };

    try {
      const response = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          ...newCycle,
        }),
      });
      const savedCycle = await response.json();
      setCycles([...safeCycles, { ...newCycle, id: savedCycle?.id }]);
      setLastCycleEnd(pendingCycle?.timestamp ?? 0);
    } catch (error) {
      console.error("Error saving cycle:", error);
    }

    setPendingCycle(null);
  };

  const handleFinish = async () => {
    if (!roundId) return;

    setIsRunning(false);

    try {
      await fetch(`/api/rounds/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endTime: new Date().toISOString(),
          observations: observations ?? "",
          totalDuration: elapsedTime ?? 0,
        }),
      });
    } catch (error) {
      console.error("Error finishing round:", error);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setCycles([]);
    setRoundId(null);
    setObservations("");
    setLastCycleEnd(0);
  };

  const handleCancel = async () => {
    if (!roundId) return;

    const confirmCancel = window.confirm("Tem certeza que deseja cancelar este round? Os dados não serão salvos.");
    if (!confirmCancel) return;

    setIsRunning(false);

    try {
      await fetch(`/api/rounds/${roundId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Error canceling round:", error);
    }

    handleReset();
  };

  const safeCycles = cycles ?? [];
  const totalHits = safeCycles.reduce((sum, c) => sum + (c?.hits ?? 0), 0);
  const totalMisses = safeCycles.reduce((sum, c) => sum + (c?.misses ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Timer Display */}
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 border border-slate-700 ftc-glow">
        <TimerDisplay timeMs={elapsedTime ?? 0} isRunning={isRunning} totalMs={ROUND_DURATION} />
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap justify-center gap-4">
        {!isRunning && !roundId && (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold text-lg transition-all shadow-lg hover:shadow-green-500/25"
          >
            <Play className="w-6 h-6" />
            Iniciar Round
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={handleMarkCycle}
              className="flex items-center gap-2 px-12 py-6 rounded-xl ftc-gradient hover:opacity-90 text-white font-bold text-xl transition-all shadow-lg ftc-glow"
            >
              <Flag className="w-7 h-7" />
              Marcar Ciclo (Espaço)
            </button>
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 px-6 py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all"
            >
              <Square className="w-5 h-5" />
              Finalizar
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-6 py-4 rounded-xl bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white font-bold transition-all"
            >
              <XCircle className="w-5 h-5" />
              Cancelar
            </button>
          </>
        )}

        {!isRunning && roundId && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Novo Round
          </button>
        )}
      </div>

      {/* Stats Summary */}
      {roundId && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-white">{safeCycles?.length ?? 0}</p>
            <p className="text-sm text-slate-400">Ciclos</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-green-400">{totalHits}</p>
            <p className="text-sm text-slate-400">Acertos</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-red-400">{totalMisses}</p>
            <p className="text-sm text-slate-400">Erros</p>
          </div>
        </div>
      )}

      {/* Cycle List */}
      {roundId && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Ciclos do Round</h3>
          <CycleList cycles={safeCycles} />
        </div>
      )}

      {/* Observations */}
      {roundId && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Observações</h3>
          <textarea
            value={observations ?? ""}
            onChange={(e) => setObservations(e?.target?.value ?? "")}
            placeholder="Anotações sobre este round..."
            className="w-full h-24 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}

      {/* Cycle Modal */}
      <CycleModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setPendingCycle(null);
        }}
        onSubmit={handleCycleSubmit}
        cycleNumber={(safeCycles?.length ?? 0) + 1}
        cycleDuration={pendingCycle?.duration ?? 0}
      />
    </div>
  );
}
