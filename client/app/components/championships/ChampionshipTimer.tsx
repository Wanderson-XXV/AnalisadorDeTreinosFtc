import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Film, Play, Square, Flag, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { TimerDisplay } from '../TimerDisplay';
import { CycleModal } from '../CycleModal';
import { CycleList } from '../CycleList';
import { TransitionDurationControl } from '../TransitionDurationControl';
import { ZoneSelector } from '../ZoneSelector';
import { useScoutingRound } from '../../hooks/useScoutingRound';
import { useSoundSettings } from '../../hooks/useSoundSettings';
import { useMedia } from '../../hooks/useMedia';
import { getAudioEventsForRound } from '../../lib/audioConfig';
import { API_BASE, fetchApi, resolveMediaUrl } from '../../lib/api';
import {
  TELEOP_DURATION,
  AUTO_DURATION,
} from '../../lib/types';
import { createMatchTiming, getCycleMarkTiming, getCycleTimeInterval, getMatchPhase } from '../../lib/matchTiming';
import type { CycleData, CycleZone, ScoutingCycle } from '../../lib/types';
import { useTransitionDurationSetting } from '../../hooks/useTransitionDurationSetting';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { formatShortcutCode, isTextEntryTarget } from '../../lib/keyboardShortcuts';
import { findMatchTeam } from '../../lib/matchTeams';

type MatchPhase = 'auto' | 'transition' | 'teleop' | 'overtime';

interface ChampionshipTimerProps {
  scoutingRoundId: string;
}

function isYoutube(path: string) {
  return path.includes('youtube.com') || path.includes('youtu.be');
}

function getYoutubeId(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : '';
}

function ScoutVideoPanel({ matchId }: { matchId: string | null }) {
  const { media, loading, error } = useMedia(matchId);
  const video = media.find(m => m.category === 'full_match' && m.file_type === 'video')
    ?? media.find(m => m.file_type === 'video')
    ?? null;

  return (
    <aside className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
        <Film className="h-4 w-4 text-orange-400" />
        Video da partida
      </div>

      {loading && (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-900 text-sm text-slate-500">
          Carregando video...
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {!loading && !error && !video && (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-500">
          Nenhum video cadastrado para esta partida.
        </div>
      )}
      {!loading && video && (isYoutube(video.file_path) ? (
        <iframe
          src={`https://www.youtube.com/embed/${getYoutubeId(video.file_path)}?enablejsapi=1`}
          className="aspect-video w-full rounded-xl bg-black"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          src={resolveMediaUrl(video.file_path)}
          controls
          preload="metadata"
          className="aspect-video w-full rounded-xl bg-black"
        />
      ))}

      <p className="mt-3 text-xs text-slate-500">
        Use como referencia visual durante o scout. O ajuste fino de sincronizacao fica na analise da partida.
      </p>
    </aside>
  );
}

function scoutingCycleToCycleData(sc: ScoutingCycle): CycleData {
  return {
    id: sc.id,
    roundId: sc.scouting_round_id,
    cycleNumber: sc.cycle_number,
    duration: sc.duration,
    hits: sc.hits,
    misses: sc.misses,
    timestamp: sc.timestamp,
    timeInterval: sc.time_interval,
    zone: sc.zone,
    isAutonomous: !!sc.is_autonomous,
    notes: sc.notes,
  };
}

export function ChampionshipTimer({ scoutingRoundId }: ChampionshipTimerProps) {
  const navigate = useNavigate();
  const { scoutingRound, cycles: savedCycles, loading, error, addCycle, editCycle, finish, cancel } =
    useScoutingRound(scoutingRoundId);

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [localCycles, setLocalCycles] = useState<CycleData[]>([]);
  const [observations, setObservations] = useState('');
  const [robotIssues, setRobotIssues] = useState('');
  const [strategyNotes, setStrategyNotes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [pendingCycle, setPendingCycle] = useState<{ duration: number; timestamp: number } | null>(null);
  const [editingCycle, setEditingCycle] = useState<CycleData | null>(null);
  const [lastCycleEnd, setLastCycleEnd] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<MatchPhase>('auto');
  const [lastSelectedZone, setLastSelectedZone] = useState<CycleZone>('near');
  const keyboardShortcuts = useKeyboardShortcuts();
  const [hasStarted, setHasStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showScoutVideo, setShowScoutVideo] = useState(false);

  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const playedTimestamps = useRef<Set<number>>(new Set());
  const finishedRef = useRef(false);
  const scoutingRoundIdRef = useRef(scoutingRoundId);

  const { soundEnabled } = useSoundSettings();
  const { transitionDurationMs, setTransitionDurationMs } = useTransitionDurationSetting();

  const roundType = 'full_match' as const;
  const timing = useMemo(() => createMatchTiming({ transitionDurationMs }), [transitionDurationMs]);
  const audioEvents = useMemo(
    () => getAudioEventsForRound(roundType, timing),
    [roundType, timing],
  );

  useEffect(() => {
    scoutingRoundIdRef.current = scoutingRoundId;
  }, [scoutingRoundId]);

  useEffect(() => {
    return () => {
      if (!finishedRef.current && scoutingRoundIdRef.current) {
        navigator.sendBeacon(
          `${API_BASE}/scouting.php?id=${scoutingRoundIdRef.current}&action=unlock`
        );
      }
    };
  }, []);

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
    if (savedCycles.length > 0 && localCycles.length === 0 && !hasStarted) {
      setLocalCycles(savedCycles.map(scoutingCycleToCycleData));
    }
  }, [savedCycles, localCycles.length, hasStarted]);

  useEffect(() => {
    if (!scoutingRound) return;
    if (scoutingRound.observations) setObservations(scoutingRound.observations);
    if (scoutingRound.robot_issues) setRobotIssues(scoutingRound.robot_issues);
    if (scoutingRound.strategy_notes) setStrategyNotes(scoutingRound.strategy_notes);
    if (!scoutingRound.is_locked && scoutingRound.end_time) {
      setHasStarted(true);
      setFinished(true);
      finishedRef.current = true;
    }
  }, [scoutingRound]);

  const getPhaseFromTime = (time: number): MatchPhase => {
    return getMatchPhase(time, roundType, timing);
  };

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - elapsedTime;
      intervalRef.current = setInterval(() => {
        const newElapsed = Date.now() - startTimeRef.current;
        setElapsedTime(newElapsed);

        const newPhase = getPhaseFromTime(newElapsed);
        if (newPhase !== currentPhase) {
          setCurrentPhase(newPhase);
          if (newPhase === 'teleop') {
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
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, currentPhase, soundEnabled, audioEvents, timing]);

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
  }, [isRunning, showModal, handleMarkCycle, keyboardShortcuts]);

  const handleStart = () => {
    if (scoutingRound?.match && !scoutingRound.match.actual_start_time) {
      void fetchApi('/matches.php', {
        method: 'PUT',
        body: JSON.stringify({
          id: scoutingRound.match.id,
          actual_start_time: new Date().toISOString(),
        }),
      }).catch(e => console.error('Error saving actual start time:', e));
    }

    setIsRunning(true);
    setHasStarted(true);
    setElapsedTime(0);
    setLastCycleEnd(0);
    setLocalCycles([]);
    setCurrentPhase('auto');
  };

  const handleCycleSubmit = async (hits: number, misses: number, zone: CycleZone, notes?: string) => {
    setLastSelectedZone(zone);

    if (editingCycle) {
      await editCycle(editingCycle.id, hits, misses, zone, notes);
      setLocalCycles(prev => prev.map(c => c.id === editingCycle.id ? { ...c, hits, misses, zone, notes: notes || null } : c));
      setEditingCycle(null);
    } else if (pendingCycle) {
      const cycleNumber = localCycles.length + 1;
      const isAutonomous = pendingCycle.timestamp < AUTO_DURATION;

      const saved = await addCycle(
        cycleNumber,
        pendingCycle.duration,
        pendingCycle.timestamp,
        hits,
        misses,
        zone,
        isAutonomous,
        true,
        transitionDurationMs,
        notes,
      );

      if (saved) {
        const newCycle: CycleData = {
          id: saved.id,
          roundId: saved.scouting_round_id,
          cycleNumber,
          duration: pendingCycle.duration,
          hits,
          misses,
          timestamp: pendingCycle.timestamp,
          timeInterval: getCycleTimeInterval(pendingCycle.timestamp, roundType, timing),
          zone,
          isAutonomous,
          notes: saved.notes,
        };
        setLocalCycles(prev => [...prev, newCycle]);
        setLastCycleEnd(pendingCycle.timestamp);
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
    setIsRunning(false);
    setFinished(true);
    finishedRef.current = true;
    await finish(elapsedTime, observations, robotIssues, strategyNotes, undefined, transitionDurationMs);
  };

  const handleCancel = async () => {
    if (!confirm('Cancelar scouting? Os dados serão perdidos.')) return;
    setIsRunning(false);
    finishedRef.current = true;
    await cancel();
    navigate('/championships');
  };

  const handleBack = async () => {
    if (isRunning) return;
    if (hasStarted && !finished) {
      if (!confirm('Sair sem finalizar? O scouting será cancelado.')) return;
      finishedRef.current = true;
      await cancel();
    } else if (!hasStarted) {
      finishedRef.current = true;
      await cancel();
    }
    navigate('/championships');
  };

  const totalHits = localCycles.reduce((sum, c) => sum + (c.hits ?? 0), 0);
  const totalMisses = localCycles.reduce((sum, c) => sum + (c.misses ?? 0), 0);
  const autoHits = localCycles.filter(c => c.isAutonomous).reduce((sum, c) => sum + (c.hits ?? 0), 0);
  const autoMisses = localCycles.filter(c => c.isAutonomous).reduce((sum, c) => sum + (c.misses ?? 0), 0);
  const teleopHits = localCycles.filter(c => !c.isAutonomous).reduce((sum, c) => sum + (c.hits ?? 0), 0);
  const teleopMisses = localCycles.filter(c => !c.isAutonomous).reduce((sum, c) => sum + (c.misses ?? 0), 0);

  if (loading) {
    return <div className="text-center py-20 text-slate-400">Carregando scouting...</div>;
  }

  if (error || !scoutingRound) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error || 'Scouting não encontrado'}</p>
        <button onClick={handleBack} className="text-orange-400 hover:underline">Voltar</button>
      </div>
    );
  }

  const match = scoutingRound.match;
  const teamNumber = scoutingRound.team_number;

  const currentTeam = match ? findMatchTeam(match, teamNumber) : undefined;
  const isRed = currentTeam?.alliance === 'red';
  const allianceBg = isRed ? 'bg-red-900/20 border-red-800/40' : 'bg-blue-900/20 border-blue-800/40';
  const allianceText = isRed ? 'text-red-400' : 'text-blue-400';

  const teamName = currentTeam?.name;

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-4 border ${allianceBg}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={!isRunning ? handleBack : undefined}
              className={`p-2 rounded-lg transition-colors ${!isRunning ? 'hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer' : 'text-slate-600 cursor-default'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold ${allianceText}`}>#{teamNumber}</span>
                {teamName && <span className="text-sm text-slate-300">{teamName}</span>}
              </div>
              {match && (
                <p className="text-xs text-slate-400">
                  {match.display_name} &middot; Aliança {isRed ? 'Vermelha' : 'Azul'}
                </p>
              )}
            </div>
          </div>
          {scoutingRound.scout_username && (
            <span className="text-xs text-slate-500">Scout: {scoutingRound.scout_username}</span>
          )}
        </div>
      </div>

      {!hasStarted && !finished && (
        <TransitionDurationControl
          valueMs={transitionDurationMs}
          onChange={setTransitionDurationMs}
          disabled={isRunning}
        />
      )}

      {!hasStarted && !finished && (
        <button
          type="button"
          onClick={() => setShowScoutVideo(v => !v)}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors sm:w-auto ${
            showScoutVideo
              ? 'border-orange-500/50 bg-orange-500/15 text-orange-300'
              : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-white'
          }`}
        >
          <Film className="h-4 w-4" />
          {showScoutVideo ? 'Ocultar video no scout' : 'Mostrar video no scout'}
        </button>
      )}

      <section className={showScoutVideo ? 'grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]' : ''}>
        {showScoutVideo && <ScoutVideoPanel matchId={match?.id ?? null} />}

        <div className="space-y-6">
      <div className={`bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 ftc-glow ${showScoutVideo ? 'p-5' : 'p-8'}`}>
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
        {!hasStarted && !finished && (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold text-lg transition-all shadow-lg hover:shadow-green-500/25"
          >
            <Play className="w-6 h-6" />
            Iniciar Scouting
          </button>
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

        {finished && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-6 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Partidas
          </button>
        )}
      </div>
        </div>

      </section>

      {(hasStarted || localCycles.length > 0) && (
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

      {(hasStarted || localCycles.length > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <p className="text-3xl font-bold text-white">{localCycles.length}</p>
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

      {(hasStarted || localCycles.length > 0) && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">Ciclos do Scouting</h3>
          <CycleList cycles={localCycles} onEdit={handleEditCycle} />
        </div>
      )}

      {(hasStarted || localCycles.length > 0) && (
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Observações</h3>
            <textarea
              ref={textareaRef}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Anotações gerais sobre o desempenho..."
              className="w-full h-20 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Problemas do Robô</label>
            <textarea
              value={robotIssues}
              onChange={e => setRobotIssues(e.target.value)}
              placeholder="Desconexões, travamentos, problemas mecânicos..."
              className="w-full h-16 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notas de Estratégia</label>
            <textarea
              value={strategyNotes}
              onChange={e => setStrategyNotes(e.target.value)}
              placeholder="Estratégia observada, pontos fortes/fracos..."
              className="w-full h-16 bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          {finished && (
            <button
              onClick={() => finish(
                scoutingRound.total_duration ?? elapsedTime,
                observations,
                robotIssues,
                strategyNotes,
                scoutingRound.end_time ?? undefined,
                transitionDurationMs,
              )}
              className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors"
            >
              Salvar Notas
            </button>
          )}
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
        cycleNumber={editingCycle?.cycleNumber ?? localCycles.length + 1}
        cycleDuration={editingCycle?.duration ?? pendingCycle?.duration ?? 0}
        initialHits={editingCycle?.hits}
        initialMisses={editingCycle?.misses}
        initialZone={editingCycle?.zone ?? lastSelectedZone}
        onZoneChange={setLastSelectedZone}
        initialNotes={editingCycle?.notes}
        isEditing={!!editingCycle}
        isAutonomous={editingCycle?.isAutonomous ?? ((pendingCycle?.timestamp ?? 0) < AUTO_DURATION)}
      />
    </div>
  );
}
