import type { CycleZone } from '../lib/types';
import { formatShortcutCode } from '../lib/keyboardShortcuts';

interface ZoneSelectorProps {
  zone: CycleZone;
  onChange: (zone: Exclude<CycleZone, null>) => void;
  shortcutCode: string;
}

export function ZoneSelector({ zone, onChange, shortcutCode }: ZoneSelectorProps) {
  return (
    <div className="mx-auto mt-5 max-w-md rounded-xl border border-slate-700 bg-slate-900/55 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-200">Zona de lançamento</span>
        <span className="text-xs text-slate-400">Atalho: <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-orange-300">{formatShortcutCode(shortcutCode)}</kbd></span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={zone === 'near'} data-testid="zone-near" onClick={() => onChange('near')} className={`rounded-lg px-4 py-2.5 font-bold transition-colors ${zone === 'near' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Perto</button>
        <button type="button" aria-pressed={zone === 'far'} data-testid="zone-far" onClick={() => onChange('far')} className={`rounded-lg px-4 py-2.5 font-bold transition-colors ${zone === 'far' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Longe</button>
      </div>
    </div>
  );
}
