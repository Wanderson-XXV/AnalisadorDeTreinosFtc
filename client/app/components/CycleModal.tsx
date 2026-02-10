import { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import type { CycleZone } from '../lib/types';

interface CycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (hits: number, misses: number, zone: CycleZone) => void;
  cycleNumber: number;
  cycleDuration: number;
  initialHits?: number;
  initialMisses?: number;
  initialZone?: CycleZone;
  isEditing?: boolean;
  isAutonomous?: boolean; 
}
export function CycleModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  cycleNumber, 
  cycleDuration,
  initialHits = 0,
  initialMisses = 0,
  initialZone = 'near',
  isEditing = false,
  isAutonomous = false
}: CycleModalProps) {
const [hits, setHits] = useState(initialHits);
const [misses, setMisses] = useState(initialMisses);
const [zone, setZone] = useState<CycleZone>(initialZone);
const hitsInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isOpen) {
    setHits(initialHits);
    setMisses(initialMisses);
    setZone(initialZone);
    setTimeout(() => {
      hitsInputRef.current?.focus();
      hitsInputRef.current?.select();
    }, 50);
  }
}, [isOpen, initialHits, initialMisses, initialZone]);

const handleSubmit = () => {
  onSubmit(hits, misses, zone);  // ADICIONE zone
  onClose();
};

  const handleHitsChange = (value: string) => {
    const num = parseInt(value, 10);
    setHits(isNaN(num) ? 0 : Math.max(0, num));
  };

  const handleMissesChange = (value: string) => {
    const num = parseInt(value, 10);
    setMisses(isNaN(num) ? 0 : Math.max(0, num));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const formatDuration = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">
              {isAutonomous && <span className="text-yellow-400 mr-2">🤖 [AUTO]</span>}
              {isEditing ? 'Editar' : ''} Ciclo #{cycleNumber}
            </h3>
            <p className="text-sm text-slate-400">Tempo: {formatDuration(cycleDuration)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            tabIndex={-1}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Acertos</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setHits(Math.max(0, hits - 1))}
                className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                tabIndex={-1}
              >
                <Minus className="w-6 h-6" />
              </button>
              <input
                ref={hitsInputRef}
                type="number"
                min="0"
                value={hits}
                onChange={(e) => handleHitsChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-4xl font-bold text-green-400 w-24 text-center bg-slate-700/50 border border-slate-600 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={() => setHits(hits + 1)}
                className="p-3 rounded-xl bg-green-600 hover:bg-green-500 text-white transition-colors"
                tabIndex={-1}
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
<div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Zona de Lançamento</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setZone('near')}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                  zone === 'near'
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                tabIndex={-1}
              >
                Perto
              </button>
              <button
                type="button"
                onClick={() => setZone('far')}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                  zone === 'far'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                tabIndex={-1}
              >
                Longe
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Erros</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMisses(Math.max(0, misses - 1))}
                className="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                tabIndex={-1}
              >
                <Minus className="w-6 h-6" />
              </button>
              <input
                type="number"
                min="0"
                value={misses}
                onChange={(e) => handleMissesChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-4xl font-bold text-red-400 w-24 text-center bg-slate-700/50 border border-slate-600 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={() => setMisses(misses + 1)}
                className="p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors"
                tabIndex={-1}
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4 text-center">
          Digite os valores e use Tab para navegar • Enter para confirmar
        </p>

        <button
          onClick={handleSubmit}
          className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-blue-500 hover:from-orange-400 hover:to-blue-400 text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          <Check className="w-5 h-5" />
          {isEditing ? 'Salvar' : 'Confirmar'} (Enter)
        </button>
      </div>
    </div>
  );
}