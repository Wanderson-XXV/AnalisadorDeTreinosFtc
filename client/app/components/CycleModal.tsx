import { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';

interface CycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (hits: number, misses: number) => void;
  cycleNumber: number;
  cycleDuration: number;
}

export function CycleModal({ isOpen, onClose, onSubmit, cycleNumber, cycleDuration }: CycleModalProps) {
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const hitsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHits(0);
      setMisses(0);
      setTimeout(() => {
        hitsInputRef.current?.focus();
        hitsInputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    onSubmit(hits, misses);
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
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Ciclo #{cycleNumber}</h3>
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
          {/* Acertos */}
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

          {/* Erros */}
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
          Confirmar (Enter)
        </button>
      </div>
    </div>
  );
}
