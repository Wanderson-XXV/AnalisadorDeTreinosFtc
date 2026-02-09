import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Flag, RefreshCw, XCircle } from 'lucide-react';
import { TimerDisplay } from './TimerDisplay';
import { CycleModal } from './CycleModal';
import { CycleList } from './CycleList';
import type { CycleData } from '../lib/types';
import { getTimeInterval } from '../lib/utils';
import { API_BASE } from '../lib/api';

const ROUND_DURATION = 120000; // 2 minutos

export function RoundTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [observations, setObservations] = useState('');
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
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Atalho de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !showModal) {
        e.preventDefault();
        if (isRunning) handleMarkCycle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, showModal, elapsedTime, lastCycleEnd]);

  const handleStart = async () => {
    try {
      const response = await fetch(`${API_BASE}/rounds.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: new Date().toISOString() }),
      });
      const data = await response.json();
      setRoundId(data?.id ?? null);
      setIsRunning(true);
      setElapsedTime(0);
      setLastCycleEnd(0);
      setCycles([]);
      setObservations('');
    } catch (error) {
      console.error('Error starting round:', error);
    }
  };

  const handleMarkCycle = useCallback(() => {
    if (!isRunning) return;
    const currentTime = elapsedTime ?? 0;
    const cycleDuration = currentTime - (lastCycleEnd ?? 0);
    setPendingCycle({ duration: cycleDuration, timestamp: currentTime });
    setShowModal(true);
  }, [isRunning, elapsedTime, lastCycleEnd]);

  const handleCycleSubmit = async (hits: number, misses: number) => {
    if (!pendingCycle || !roundId) return;

    const cycleNumber = (cycles?.length ?? 0) + 1;
    const newCycle: CycleData = {
      cycleNumber,
      duration: pendingCycle.duration,
      hits,
      misses,
      timestamp: pendingCycle.timestamp,
      timeInterval: getTimeInterval(pendingCycle.timestamp),
    };

    try {
      const response = await fetch(`${API_BASE}/cycles.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, ...newCycle }),
      });
      const savedCycle = await response.json();
      setCycles([...cycles, { ...newCycle, id: savedCycle?.id }]);
      setLastCycleEnd(pendingCycle.timestamp);
    } catch (error) {
      console.error('Error saving cycle:', error);
    }

    setPendingCycle(null);
  };

  const handleFinish = async () => {
    if (!roundId) return;
    setIsRunning(false);

    try {
      await fetch(`${API_BASE}/rounds.php?id=${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endTime: new Date().toISOString(),
          observations,
          totalDuration: elapsedTime,
        }),
      });
    } catch (error) {
      console.error('Error finishing round:', error);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedTime(0);
    setCycles([]);
    setRoundId(null);
    setObservations('');
    setLastCycleEnd(0);
  };

  const handleCancel = async () => {
    if (!roundId) return;
    const confirmCancel = window.confirm('Tem certeza que deseja cancelar este round? Os dados não serão salvos.');
    if (!confirmCancel) return;

    setIsRunning(false);
    try {
      await fetch(`${API_BASE}/rounds.php?id=${roundId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error canceling round:', error);
    }
    handleReset();
  };

  const totalHits = cycles.reduce((sum, c) => sum + (c?.hits ?? 0), 0);
  const totalMisses = cycles.reduce((sum, c) => sum + (c?.misses ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Timer Display */}
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 border border-slate-700 ftc-glow">
        <TimerDisplay timeMs={elapsedTime} isRunning={isRunning} totalMs={ROUND_DURATION} />
      </div>

      {/* Botões de Controle */}
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

      {/* Resumo */}
      {roundId && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-white">{cycles.length}</p>
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

      {/* Lista de Ciclos */}
      {roundId && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Ciclos do Round</h3>
          <CycleList cycles={cycles} />
        </div>
      )}

      {/* Observações */}
      {roundId && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Observações</h3>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Anotações sobre este round..."
            className="w-full h-24 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}

      {/* Modal de Ciclo */}
      <CycleModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setPendingCycle(null);
        }}
        onSubmit={handleCycleSubmit}
        cycleNumber={(cycles?.length ?? 0) + 1}
        cycleDuration={pendingCycle?.duration ?? 0}
      />
    </div>
  );
}
