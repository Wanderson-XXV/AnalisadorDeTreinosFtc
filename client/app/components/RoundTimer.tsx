import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Play, Square, Flag, RefreshCw, XCircle } from 'lucide-react';
import { TimerDisplay } from './TimerDisplay';
import { CycleModal } from './CycleModal';
import { CycleList } from './CycleList';
import { TransitionDurationControl } from './TransitionDurationControl';
import { ZoneSelector } from './ZoneSelector';
import type { CycleData, CycleZone, RoundType } from '../lib/types';
import { getAudioEventsForRound } from '../lib/audioConfig';
import { 
  BATTERIES, 
  TELEOP_DURATION, 
  AUTO_DURATION,
  calculateStrategy 
} from '../lib/types';
import { createMatchTiming, getCycleMarkTiming, getCycleTimeInterval, getMatchPhase } from '../lib/matchTiming';
import { API_BASE } from '../lib/api';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { useTransitionDurationSetting } from '../hooks/useTransitionDurationSetting';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { formatShortcutCode, isTextEntryTarget } from '../lib/keyboardShortcuts';
type MatchPhase = 'auto' | 'transition' | 'teleop' | 'overtime';

export function RoundTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [observations, setObservations] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [pendingCycle, setPendingCycle] = useState<{ duration: number; timestamp: number } | null>(null);
  const [lastCycleEnd, setLastCycleEnd] = useState(0);
  const [editingCycle, setEditingCycle] = useState<CycleData | null>(null);
  const [currentPhase, setCurrentPhase] = useState<MatchPhase>('teleop');

  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playedTimestamps = useRef<Set<number>>(new Set());
  
  const [roundType, setRoundType] = useState<RoundType>('teleop_only');
  const [batteryName, setBatteryName] = useState<string | null>(null);
  const [batteryVolts, setBatteryVolts] = useState<number | null>(null);
  const { transitionDurationMs, setTransitionDurationMs } = useTransitionDurationSetting();
  const timing = useMemo(() => createMatchTiming({ transitionDurationMs }), [transitionDurationMs]);
  const audioEvents = useMemo(
    () => getAudioEventsForRound(roundType, timing),
    [roundType, timing],
  );
  
  const { soundEnabled } = useSoundSettings();
  const [lastSelectedZone, setLastSelectedZone] = useState<CycleZone>('near');
  const keyboardShortcuts = useKeyboardShortcuts();
  useEffect(() => {
    if (!isRunning && !roundId) {
      setCurrentPhase(roundType === 'full_match' ? 'auto' : 'teleop');
    }
  }, [roundType, isRunning, roundId]);
  

  const getPhaseFromTime = (time: number): MatchPhase => {
    return getMatchPhase(time, roundType, timing);
  };

useEffect(() => {
  audioEvents.forEach(event => {
    const audio = new Audio(event.file);
    audioCache.current.set(event.file, audio);
  });
}, [audioEvents]);

useEffect(() => {
  if (!isRunning) {
    playedTimestamps.current.clear();
  }
}, [isRunning]);

useEffect(() => {
  if (isRunning) {
    startTimeRef.current = Date.now() - elapsedTime;
    intervalRef.current = setInterval(() => {
      const newElapsed = Date.now() - startTimeRef.current;
      setElapsedTime(newElapsed);
      
      const newPhase = getPhaseFromTime(newElapsed);
      if (newPhase !== currentPhase) {
        setCurrentPhase(newPhase);
        if (newPhase === 'teleop' && roundType === 'full_match') {
          setLastCycleEnd(timing.teleopStartMs);
        }
      }
      
      if (soundEnabled) {
        audioEvents.forEach(event => {
          if (event.modes.includes(roundType) && !playedTimestamps.current.has(event.timestamp)) {
            const tolerance = 100;
            if (Math.abs(newElapsed - event.timestamp) <= tolerance) {
              audioCache.current.get(event.file)?.play().catch(() => {});
              playedTimestamps.current.add(event.timestamp);
            }
          }
        });
      }
    }, 10);
  } else {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [isRunning, currentPhase, roundType, soundEnabled, audioEvents, timing]);
  
const handleMarkCycle = useCallback(() => {
  if (!isRunning) return;
  const currentTime = elapsedTime ?? 0;
  const mark = getCycleMarkTiming({
    currentTimeMs: currentTime,
    lastCycleEndMs: lastCycleEnd ?? 0,
    phase: currentPhase,
    timing,
  });
  
  setPendingCycle({ duration: mark.duration, timestamp: mark.timestamp });
  setEditingCycle(null);
  setShowModal(true);
}, [isRunning, elapsedTime, lastCycleEnd, currentPhase, timing]);

// if (isRunning) handleMarkCycle();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextEntryTarget(e.target)) return;
      if (e.code === keyboardShortcuts.toggle_zone) {
        e.preventDefault();
        setLastSelectedZone(current => current === 'far' ? 'near' : 'far');
        return;
      }
      if (e.code === keyboardShortcuts.mark_cycle && !showModal) {
        e.preventDefault();
        if (isRunning) handleMarkCycle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, showModal, elapsedTime, lastCycleEnd, currentPhase, keyboardShortcuts]);

    const handleStart = async () => { 
    try {
      const response = await fetch(`${API_BASE}/rounds.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startTime: new Date().toISOString(),
          roundType,
          transitionDurationMs,
          batteryName,
          batteryVolts
        }),
      });
      const data = await response.json();
      setRoundId(data?.id ?? null);
      setIsRunning(true);
      setElapsedTime(0);
      setLastCycleEnd(0);
      setCycles([]);
      setObservations('');
      setCurrentPhase(roundType === 'full_match' ? 'auto' : 'teleop');
    } catch (error) {
      console.error('Error starting round:', error);
    }
  };

    const handleCycleSubmit = async (hits: number, misses: number, zone: CycleZone, notes?: string) => {
      if (!roundId) return;
      
      setLastSelectedZone(zone);

      if (editingCycle) {
        const updatedCycle = { ...editingCycle, hits, misses, zone, notes: notes || null };
        try {
          await fetch(`${API_BASE}/cycles.php?id=${editingCycle.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hits, misses, zone, notes: notes || null }),
          });
          setCycles(cycles.map(c => c.id === editingCycle.id ? updatedCycle : c));
        } catch (error) {
          console.error('Error updating cycle:', error);
        }
        setEditingCycle(null);
      } else if (pendingCycle) {
      const cycleNumber = (cycles?.length ?? 0) + 1;
      const isAutonomous = roundType === 'full_match' && pendingCycle.timestamp < AUTO_DURATION;

      try {
        const response = await fetch(`${API_BASE}/cycles.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            roundId, 
            cycleNumber,
            duration: pendingCycle.duration,
            hits,
            misses,
            timestamp: pendingCycle.timestamp,
            timeInterval: getCycleTimeInterval(pendingCycle.timestamp, roundType, timing),
            zone,
            isAutonomous,
            isFullMatch: roundType === 'full_match',
            transitionDurationMs,
            notes: notes || null,
          }),
        });
        const savedCycle = await response.json();
        
        const newCycle: CycleData = {
          id: savedCycle?.id,
          roundId: roundId!,
          cycleNumber,
          duration: pendingCycle.duration,
          hits,
          misses,
          timestamp: pendingCycle.timestamp,
          timeInterval: getCycleTimeInterval(pendingCycle.timestamp, roundType, timing),
          zone,
          isAutonomous,
          notes: notes || null,
        };
        
        setCycles([...cycles, newCycle]);
        setLastCycleEnd(pendingCycle.timestamp);
      } catch (error) {
        console.error('Error saving cycle:', error);
      }
      setPendingCycle(null);
    }
    setShowModal(false);
  };

  const handleEditCycle = (cycle: CycleData) => {
    setEditingCycle(cycle);
    setShowModal(true);
  };

  const handleFinish = async () => {
    if (!roundId) return;
    setIsRunning(false);

    const strategy = calculateStrategy(cycles);

    try {
      await fetch(`${API_BASE}/rounds.php?id=${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endTime: new Date().toISOString(),
          observations,
          totalDuration: elapsedTime,
          transitionDurationMs,
          strategy
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
    setCurrentPhase('teleop');
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
  
  const autoHits = cycles.filter(c => c.isAutonomous).reduce((sum, c) => sum + (c?.hits ?? 0), 0);
  const autoMisses = cycles.filter(c => c.isAutonomous).reduce((sum, c) => sum + (c?.misses ?? 0), 0);
  const teleopHits = cycles.filter(c => !c.isAutonomous).reduce((sum, c) => sum + (c?.hits ?? 0), 0);
  const teleopMisses = cycles.filter(c => !c.isAutonomous).reduce((sum, c) => sum + (c?.misses ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 border border-slate-700 ftc-glow">
        <TimerDisplay 
          timeMs={elapsedTime} 
          isRunning={isRunning} 
          totalMs={TELEOP_DURATION}
          roundType={roundType}
          currentPhase={currentPhase}
          transitionDurationMs={transitionDurationMs}
        />
        <ZoneSelector zone={lastSelectedZone} onChange={setLastSelectedZone} shortcutCode={keyboardShortcuts.toggle_zone} />
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {!isRunning && !roundId && (
          <>
            <div className="w-full bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 mb-4">
              <h3 className="text-lg font-bold text-white mb-4">Configuração do Round</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Round</label>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setRoundType('teleop_only')}
                      className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                        roundType === 'teleop_only' 
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' 
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Só Teleop (2:00)
                    </button>
                    <button 
                      onClick={() => setRoundType('full_match')}
                      className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                        roundType === 'full_match' 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' 
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Completo (2:30)
                    </button>
                  </div>
                </div>

                {roundType === 'full_match' && (
                  <TransitionDurationControl
                    valueMs={transitionDurationMs}
                    onChange={setTransitionDurationMs}
                    disabled={isRunning}
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Bateria</label>
                    <select 
                      value={batteryName || ''} 
                      onChange={(e) => setBatteryName(e.target.value || null)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Selecionar...</option>
                      {BATTERIES.map(bat => (
                        <option key={bat} value={bat}>{bat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Voltagem</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      placeholder="Ex: 12.6"
                      value={batteryVolts || ''}
                      onChange={(e) => setBatteryVolts(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>
         
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold text-lg transition-all shadow-lg hover:shadow-green-500/25"
            >
              <Play className="w-6 h-6" />
              Iniciar Round
            </button>
          </>
        )}

        {isRunning && (
          <>
            <button
              onClick={handleMarkCycle}
              className="flex items-center gap-2 px-6 sm:px-12 py-4 sm:py-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg sm:text-xl transition-all shadow-lg hover:shadow-orange-500/25"
            >
              <Flag className="w-6 h-6 sm:w-7 sm:h-7" />
              <span className="whitespace-nowrap">Marcar Ciclo ({formatShortcutCode(keyboardShortcuts.mark_cycle)})</span>
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

      {roundId && roundType === 'full_match' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h4 className="text-sm font-semibold text-blue-400 mb-3">Autônomo</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{autoHits}</p>
                <p className="text-xs text-slate-400">Acertos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{autoMisses}</p>
                <p className="text-xs text-slate-400">Erros</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h4 className="text-sm font-semibold text-orange-400 mb-3">Teleoperado</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{teleopHits}</p>
                <p className="text-xs text-slate-400">Acertos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{teleopMisses}</p>
                <p className="text-xs text-slate-400">Erros</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {roundId && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-white">{cycles.length}</p>
            <p className="text-sm text-slate-400">Ciclos</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-green-400">{totalHits}</p>
            <p className="text-sm text-slate-400">Acertos Totais</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-red-400">{totalMisses}</p>
            <p className="text-sm text-slate-400">Erros Totais</p>
          </div>
        </div>
      )}

      {roundId && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Ciclos do Round</h3>
          <CycleList cycles={cycles} onEdit={handleEditCycle} />
        </div>
      )}

      {roundId && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Observações</h3>
          <textarea
            ref={textareaRef}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Anotações sobre este round..."
            className="w-full h-24 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}

      <CycleModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setPendingCycle(null);
          setEditingCycle(null);
        }}
        onSubmit={handleCycleSubmit}
        cycleNumber={editingCycle?.cycleNumber ?? (cycles?.length ?? 0) + 1}
        cycleDuration={editingCycle?.duration ?? pendingCycle?.duration ?? 0}
        initialHits={editingCycle?.hits}
        initialMisses={editingCycle?.misses}
        initialZone={editingCycle?.zone ?? lastSelectedZone}
        onZoneChange={setLastSelectedZone}
        isEditing={!!editingCycle}
        isAutonomous={roundType === 'full_match' && (editingCycle?.isAutonomous ?? ((pendingCycle?.timestamp ?? 0) < AUTO_DURATION))}
      />
    </div>
  );
}
