import { cn } from '../lib/utils';
import type { RoundType } from '../lib/types';
import { AUTO_DURATION, TRANSITION_DURATION, TELEOP_DURATION, FULL_MATCH_DURATION } from '../lib/types';

type MatchPhase = 'auto' | 'transition' | 'teleop' | 'overtime';

interface TimerDisplayProps {
  timeMs: number;
  isRunning: boolean;
  totalMs: number;
  roundType?: RoundType;
  currentPhase?: MatchPhase;
}

export function TimerDisplay({ timeMs, isRunning, totalMs, roundType, currentPhase = 'teleop' }: TimerDisplayProps) {
  const safeTime = timeMs ?? 0;
  
  let displayTime = 0;
  
  if (roundType === 'full_match') {
    if (currentPhase === 'auto') {
      displayTime = AUTO_DURATION - safeTime;
    } else if (currentPhase === 'transition') {
      displayTime = TELEOP_DURATION;
    } else if (currentPhase === 'teleop') {
      const teleopStart = AUTO_DURATION + TRANSITION_DURATION;
      const teleopElapsed = safeTime - teleopStart;
      displayTime = TELEOP_DURATION - teleopElapsed;
    } else {
      displayTime = -(safeTime - FULL_MATCH_DURATION);
    }
  } else {
    displayTime = totalMs - safeTime;
  }
  
  const isOvertime = displayTime < 0;
  const absTime = Math.abs(displayTime);
  
  const minutes = Math.floor(absTime / 60000);
  const seconds = Math.floor((absTime % 60000) / 1000);
  const ms = Math.floor((absTime % 1000) / 10);

 const progress = roundType === 'full_match' 
  ? currentPhase === 'auto' 
    ? Math.min((safeTime / AUTO_DURATION) * 100, 100)
    : currentPhase === 'teleop'
    ? Math.min(((safeTime - AUTO_DURATION - TRANSITION_DURATION) / TELEOP_DURATION) * 100, 100)
    : 100
  : Math.min((safeTime / totalMs) * 100, 100);
  const isNearEnd = displayTime < 10000 && displayTime > 0;

  let intervalTime = 0;
  if (roundType === 'full_match') {
    if (currentPhase === 'auto') {
      intervalTime = safeTime;
    } else if (currentPhase === 'teleop') {
      intervalTime = safeTime - (AUTO_DURATION + TRANSITION_DURATION);
    }
  } else {
    intervalTime = safeTime;
  }

  const intervalSeconds = Math.floor(intervalTime / 1000);
  const intervalDisplay = `${Math.floor(intervalSeconds / 60)}:${(intervalSeconds % 60).toString().padStart(2, '0')}`;

  const phaseIcons = {
    auto: '/autom.png',
    transition: '/transition.png',
    teleop: '/teleop.png',
    overtime: '/teleop.png'
  };

  const phaseLabels = {
    auto: 'AUTÔNOMO',
    transition: 'TRANSIÇÃO',
    teleop: 'TELEOPERADO',
    overtime: 'OVERTIME'
  };

  const phaseColors = {
    auto: 'text-blue-400',
    transition: 'text-yellow-400',
    teleop: 'text-orange-400',
    overtime: 'text-red-500'
  };

  return (
    <div className="text-center">
      {roundType === 'full_match' && (
        <div className="flex items-center justify-center gap-3 mb-4">
          <img 
            src={phaseIcons[currentPhase]} 
            alt={phaseLabels[currentPhase]}
            width={40}
            height={40}
            className="object-contain"
          />
          <span className={cn('text-lg font-bold', phaseColors[currentPhase])}>
            {phaseLabels[currentPhase]}
          </span>
        </div>
      )}

      <div
        className={cn(
          'timer-display text-7xl md:text-8xl font-mono font-bold tracking-tight mb-4',
          isOvertime ? 'text-red-500' : isNearEnd ? 'text-yellow-400' : 'text-white'
        )}
      >
        {isOvertime && '+'}
        {String(minutes).padStart(2, '0')}
        <span className={cn(isRunning && 'animate-pulse')}>:</span>
        {String(seconds).padStart(2, '0')}
        <span className="text-4xl text-slate-400">.{String(ms).padStart(2, '0')}</span>
      </div>

      {currentPhase === 'transition' && (
        <div className="text-yellow-400 text-2xl font-bold mb-4">
          Transição: {Math.ceil((TRANSITION_DURATION - (safeTime - AUTO_DURATION)) / 1000)}s
        </div>
      )}

      <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-6">
        <div
          className={cn(
            'h-full transition-all duration-100',
            isOvertime
              ? 'bg-red-500'
              : isNearEnd
              ? 'bg-yellow-400'
              : currentPhase === 'auto'
              ? 'bg-blue-500'
              : currentPhase === 'transition'
              ? 'bg-yellow-500'
              : 'ftc-gradient'
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="flex justify-center gap-2">
        {roundType === 'teleop_only' ? (
          ['0-30s', '30-60s', '60-90s', '90-120s'].map((label, index) => {
            const currentInterval = safeTime < 30000 ? 0 : safeTime < 60000 ? 1 : safeTime < 90000 ? 2 : 3;
            return (
              <div
                key={label}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                  index === currentInterval && isRunning
                    ? 'ftc-gradient text-white'
                    : index < currentInterval
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-slate-800 text-slate-500'
                )}
              >
                {label}
              </div>
            );
          })
        ) : roundType === 'full_match' && currentPhase === 'teleop' ? (
          ['0-30s', '30-60s', '60-90s', '90-120s'].map((label, index) => {
            const currentInterval = intervalTime < 30000 ? 0 : intervalTime < 60000 ? 1 : intervalTime < 90000 ? 2 : 3;
            return (
              <div
                key={label}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                  index === currentInterval && isRunning
                    ? 'ftc-gradient text-white'
                    : index < currentInterval
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-slate-800 text-slate-500'
                )}
              >
                {label}
              </div>
            );
          })
        ) : null}
      </div>

      {/* <div className="text-slate-400 text-sm mt-2">
        Intervalo: {intervalDisplay}
      </div> */}
    </div>
  );
}