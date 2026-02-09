import { cn } from '../lib/utils';

interface TimerDisplayProps {
  timeMs: number;
  isRunning: boolean;
  totalMs: number;
}

export function TimerDisplay({ timeMs, isRunning, totalMs }: TimerDisplayProps) {
  const safeTime = timeMs ?? 0;
  const minutes = Math.floor(safeTime / 60000);
  const seconds = Math.floor((safeTime % 60000) / 1000);
  const ms = Math.floor((safeTime % 1000) / 10);

  const progress = Math.min((safeTime / totalMs) * 100, 100);
  const isOvertime = safeTime > totalMs;
  const isNearEnd = safeTime > totalMs * 0.75 && !isOvertime;

  // Determinar intervalo atual
  const currentInterval = safeTime < 30000 ? 0 : safeTime < 60000 ? 1 : safeTime < 90000 ? 2 : 3;
  const intervals = ['0-30s', '30-60s', '60-90s', '90-120s'];

  return (
    <div className="text-center">
      {/* Timer principal */}
      <div
        className={cn(
          'timer-display text-7xl md:text-8xl font-mono font-bold tracking-tight mb-4',
          isOvertime ? 'text-red-500' : isNearEnd ? 'text-yellow-400' : 'text-white'
        )}
      >
        {String(minutes).padStart(2, '0')}
        <span className={cn(isRunning && 'animate-pulse')}>:</span>
        {String(seconds).padStart(2, '0')}
        <span className="text-4xl text-slate-400">.{String(ms).padStart(2, '0')}</span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-6">
        <div
          className={cn(
            'h-full transition-all duration-100',
            isOvertime
              ? 'bg-red-500'
              : isNearEnd
              ? 'bg-yellow-400'
              : 'ftc-gradient'
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Indicadores de intervalo */}
      <div className="flex justify-center gap-2">
        {intervals.map((label, index) => (
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
        ))}
      </div>
    </div>
  );
}
