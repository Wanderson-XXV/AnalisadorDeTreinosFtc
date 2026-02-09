import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Calendar } from 'lucide-react';
import { cn, getDateString } from '../lib/utils';

type PeriodPreset = 'today' | 'yesterday' | '7days' | '14days' | '30days' | 'custom' | 'all';

interface PeriodFilterProps {
  onFilterChange: (startDate: string | null, endDate: string | null) => void;
}

export function PeriodFilter({ onFilterChange }: PeriodFilterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>(
    (searchParams.get('preset') as PeriodPreset) || 'all'
  );
  const [customStartDate, setCustomStartDate] = useState(searchParams.get('startDate') || '');
  const [customEndDate, setCustomEndDate] = useState(searchParams.get('endDate') || '');
  const [showCustom, setShowCustom] = useState(selectedPreset === 'custom');

  const presets: { value: PeriodPreset; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'today', label: 'Hoje' },
    { value: 'yesterday', label: 'Ontem' },
    { value: '7days', label: '7 dias' },
    { value: '14days', label: '14 dias' },
    { value: '30days', label: '30 dias' },
    { value: 'custom', label: 'Período' },
  ];

  const handlePresetClick = (e: React.MouseEvent<HTMLButtonElement>, preset: PeriodPreset) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedPreset(preset);
    
    const today = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    switch (preset) {
      case 'all':
        setShowCustom(false);
        setSearchParams({ preset });
        break;
      case 'today':
        startDate = getDateString(today);
        endDate = getDateString(today);
        setShowCustom(false);
        setSearchParams({ preset, startDate, endDate });
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = getDateString(yesterday);
        endDate = getDateString(yesterday);
        setShowCustom(false);
        setSearchParams({ preset, startDate, endDate });
        break;
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        startDate = getDateString(sevenDaysAgo);
        endDate = getDateString(today);
        setShowCustom(false);
        setSearchParams({ preset, startDate, endDate });
        break;
      case '14days':
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
        startDate = getDateString(fourteenDaysAgo);
        endDate = getDateString(today);
        setShowCustom(false);
        setSearchParams({ preset, startDate, endDate });
        break;
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        startDate = getDateString(thirtyDaysAgo);
        endDate = getDateString(today);
        setShowCustom(false);
        setSearchParams({ preset, startDate, endDate });
        break;
      case 'custom':
        setShowCustom(true);
        const currentStart = searchParams.get('startDate') || '';
        const currentEnd = searchParams.get('endDate') || '';
        setCustomStartDate(currentStart);
        setCustomEndDate(currentEnd);
        setSearchParams({ preset });
        return;
    }

    onFilterChange(startDate, endDate);
  };

  const handleCustomApply = () => {
    if (customStartDate || customEndDate) {
      setSearchParams({ preset: 'custom', startDate: customStartDate, endDate: customEndDate });
      onFilterChange(customStartDate || null, customEndDate || null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={(e) => handlePresetClick(e, preset.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              selectedPreset === preset.value
                ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white'
            )}
          >
            {preset.value === 'custom' && <Calendar className="w-3.5 h-3.5 inline mr-1.5" />}
            {preset.label}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">De:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Até:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            type='button'
            onClick={handleCustomApply}
            className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}