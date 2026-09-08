import { Clock3 } from 'lucide-react';
import { normalizeTransitionDurationMs } from '../lib/matchTiming';
import { cn } from '../lib/utils';

interface TransitionDurationControlProps {
  valueMs: number;
  onChange: (valueMs: number) => void;
  disabled?: boolean;
}

const PRESETS = [
  { label: '15s', valueMs: 15_000 },
  { label: '8s', valueMs: 8_000 },
] as const;

export function TransitionDurationControl({
  valueMs,
  onChange,
  disabled = false,
}: TransitionDurationControlProps) {
  const seconds = Math.round(valueMs / 1000);

  const handleSecondsChange = (value: string) => {
    if (value === '') return;
    onChange(normalizeTransitionDurationMs(Number(value) * 1000));
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <Clock3 className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-semibold">Pausa Auto - Teleop</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(preset => {
            const selected = valueMs === preset.valueMs;
            return (
              <button
                key={preset.valueMs}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset.valueMs)}
                className={cn(
                  'h-9 min-w-14 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  selected
                    ? 'border-yellow-400 bg-yellow-400/20 text-yellow-200'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white',
                )}
              >
                {preset.label}
              </button>
            );
          })}

          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-slate-300">
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              disabled={disabled}
              value={seconds}
              onChange={event => handleSecondsChange(event.target.value)}
              className="w-12 bg-transparent text-right font-semibold text-white outline-none disabled:cursor-not-allowed"
            />
            <span>s</span>
          </label>
        </div>
      </div>
    </div>
  );
}
