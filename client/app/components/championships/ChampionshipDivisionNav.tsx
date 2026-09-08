import { Trophy } from 'lucide-react';
import { useChampionshipContext } from '../../hooks/useChampionshipContext';
import { buildChampionshipNavigationItems } from '../../lib/championshipHierarchy';
import { cn } from '../../lib/utils';

export function ChampionshipDivisionNav({
  className,
  includeGeneral = false,
}: {
  className?: string;
  includeGeneral?: boolean;
}) {
  const {
    flatChampionships,
    selectedChampionship,
    setSelectedChampionshipId,
  } = useChampionshipContext();
  const items = buildChampionshipNavigationItems(selectedChampionship, flatChampionships, { includeGeneral });

  if (items.length === 0) return null;

  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {items.map(item => {
        const active = selectedChampionship?.id === item.championship.id;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setSelectedChampionshipId(item.championship.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold whitespace-nowrap transition-colors',
              active
                ? 'bg-orange-500 border-orange-400 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
            )}
          >
            {item.championship.scope_type === 'final' && <Trophy className="w-4 h-4" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
