import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { useChampionshipContext } from '../../hooks/useChampionshipContext';
import { cn } from '../../lib/utils';
import {
  getContextSelectableChampionships,
  getDivisionNavigationItems,
  getSelectedContextId,
} from '../../lib/championshipHierarchy';

export function ChampionshipSelector({ collapsed = false }: { collapsed?: boolean }) {
  const {
    championships,
    flatChampionships,
    selectedChampionship,
    setSelectedChampionshipId,
    loading,
    error,
  } = useChampionshipContext();
  const selectableChampionships = useMemo(
    () => getContextSelectableChampionships(championships),
    [championships],
  );
  const selectedContextId = getSelectedContextId(selectedChampionship, flatChampionships);
  const divisionItems = getDivisionNavigationItems(selectedChampionship, flatChampionships);
  const selectedChild = selectedChampionship?.parent_id ? selectedChampionship : null;

  if (collapsed) {
    return (
      <div
        className="w-full flex justify-center p-2 rounded-lg bg-slate-700/40 text-orange-400"
        title={selectedChampionship?.short_name ?? selectedChampionship?.name ?? 'Campeonato'}
      >
        <Trophy className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-700/80">
      <div className="flex items-center gap-2 mb-1.5">
        <Trophy className="w-4 h-4 text-orange-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Contexto</span>
      </div>
      <select
        value={selectedContextId ?? ''}
        disabled={loading || selectableChampionships.length === 0}
        onChange={e => setSelectedChampionshipId(e.target.value)}
        className={cn(
          'w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-500',
          loading && 'opacity-60'
        )}
      >
        {loading && <option>Carregando...</option>}
        {!loading && selectableChampionships.length === 0 && <option>Nenhum campeonato</option>}
        {!loading && selectableChampionships.map(c => {
          const childCount = c.children?.filter(child => child.scope_type === 'division' || child.scope_type === 'final').length ?? 0;
          const suffix = c.scope_type === 'event_group' && childCount > 0 ? ` · ${childCount} divisoes` : '';
          return (
            <option key={c.id} value={c.id}>
              {c.short_name || c.name}{suffix}
            </option>
          );
        })}
      </select>
      {selectedChild && (
        <p className="mt-1 text-[10px] text-orange-300 truncate">
          Divisao atual: {selectedChild.short_name || selectedChild.name}
        </p>
      )}
      {!selectedChild && divisionItems.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-500 truncate">{divisionItems.length} divisoes/finais disponiveis</p>
      )}
      {selectedChampionship?.event_code && !selectedChild && (
        <p className="mt-1 text-[10px] text-slate-500 truncate">{selectedChampionship.event_code}</p>
      )}
      {error && <p className="mt-1 text-[10px] text-red-400 truncate">{error}</p>}
    </div>
  );
}
