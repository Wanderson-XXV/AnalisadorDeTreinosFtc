import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  Layers3,
  RefreshCw,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ChampionshipDivisionNav } from '../components/championships/ChampionshipDivisionNav';
import { useSidebar } from '../hooks/useSidebar';
import { useChampionshipContext } from '../hooks/useChampionshipContext';
import { useScoutManagement } from '../hooks/useScoutManagement';
import { cn } from '../lib/utils';
import type {
  Championship,
  MatchType,
  ScoutManagementChildSummary,
  ScoutManagementMatch,
  ScoutManagementSlot,
  ScoutManagementTotals,
  ScoutMatchCoverage,
  ScoutSlotStatus,
  ScoutWorkload,
} from '../lib/types';

type Tab = 'matches' | 'scouts';
type BatchSlot = { match_id: string; team_number: number };

const statusConfig: Record<ScoutSlotStatus, { label: string; icon: typeof Circle; cls: string }> = {
  pending: { label: 'Pendente', icon: Circle, cls: 'text-slate-400' },
  assigned: { label: 'Atribuído', icon: Clock3, cls: 'text-blue-400' },
  in_progress: { label: 'Em andamento', icon: Clock3, cls: 'text-amber-400' },
  done: { label: 'Concluído', icon: CheckCircle2, cls: 'text-emerald-400' },
};

function slotKey(slot: Pick<ScoutManagementSlot, 'match_id' | 'team_number'>): string {
  return `${slot.match_id}|${slot.team_number}`;
}

function ScopeTotals({ totals }: { totals: ScoutManagementTotals }) {
  const items = [
    { label: 'Partidas', value: totals.matches, cls: 'text-white' },
    { label: 'Pendentes', value: totals.pending, cls: 'text-slate-200' },
    { label: 'Atribuídos', value: totals.assigned, cls: 'text-blue-400' },
    { label: 'Em andamento', value: totals.in_progress, cls: 'text-amber-400' },
    { label: 'Concluídos', value: totals.done, cls: 'text-emerald-400' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 border-y border-slate-700/80 divide-x divide-slate-700/70">
      {items.map(item => (
        <div key={item.label} className="px-3 py-3 sm:py-4 last:col-span-2 sm:last:col-span-1">
          <p className={cn('text-xl font-bold tabular-nums', item.cls)}>{item.value}</p>
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function ParentScopeRow({
  summary,
  onOpen,
}: {
  summary: ScoutManagementChildSummary;
  onOpen: (championship: Championship) => void;
}) {
  const { championship, totals } = summary;
  const completed = totals.done + totals.in_progress;
  const slotTotal = totals.pending + totals.assigned + completed;
  const coverage = slotTotal > 0 ? Math.round(((totals.assigned + completed) / slotTotal) * 100) : 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(championship)}
      className="group w-full grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(180px,1fr)_repeat(4,minmax(72px,auto))_auto] items-center gap-3 px-4 py-4 border-b border-slate-700/70 text-left hover:bg-slate-800/65 transition-colors last:border-b-0"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {championship.scope_type === 'final' ? <Trophy className="w-4 h-4 text-orange-400" /> : <Layers3 className="w-4 h-4 text-slate-500" />}
          <span className="font-semibold text-white truncate">{championship.short_name || championship.name}</span>
          {championship.scope_type === 'final' && <span className="text-[10px] uppercase tracking-wider text-orange-300">Final</span>}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden max-w-sm">
          <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${coverage}%` }} />
        </div>
      </div>
      <div className="hidden sm:block text-right"><b className="text-white">{totals.matches}</b><span className="block text-[10px] text-slate-500">partidas</span></div>
      <div className="hidden sm:block text-right"><b className="text-slate-300">{totals.pending}</b><span className="block text-[10px] text-slate-500">pendentes</span></div>
      <div className="hidden sm:block text-right"><b className="text-blue-400">{totals.assigned}</b><span className="block text-[10px] text-slate-500">atribuídos</span></div>
      <div className="hidden sm:block text-right"><b className="text-emerald-400">{completed}</b><span className="block text-[10px] text-slate-500">feitos</span></div>
      <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-orange-300">
        <span className="sm:hidden">{totals.matches} partidas</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}

function SlotRow({
  slot,
  scouts,
  selected,
  saving,
  onToggle,
  onAssign,
  onUnassign,
}: {
  slot: ScoutManagementSlot;
  scouts: Array<{ id: string; username: string }>;
  selected: boolean;
  saving: boolean;
  onToggle: () => void;
  onAssign: (scoutId: string) => void;
  onUnassign: () => void;
}) {
  const cfg = statusConfig[slot.status];
  const Icon = cfg.icon;
  const finished = slot.status === 'done' || slot.status === 'in_progress';
  return (
    <div className={cn(
      'grid grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_minmax(150px,1fr)_110px_150px] items-center gap-2 px-3 py-2.5 border-t border-slate-700/60 first:border-t-0 transition-colors',
      selected && 'bg-orange-500/10',
    )}>
      <button
        type="button"
        disabled={slot.status !== 'pending'}
        onClick={onToggle}
        aria-label={`Selecionar equipe ${slot.team_number}`}
        className={cn(
          'w-5 h-5 rounded border flex items-center justify-center transition-colors',
          selected ? 'bg-orange-500 border-orange-400 text-white' : 'border-slate-600 text-transparent hover:border-orange-400',
          slot.status !== 'pending' && 'opacity-20 cursor-not-allowed',
        )}
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <div className="min-w-0 flex items-center gap-2">
        <span className={cn('w-1.5 h-7 rounded-full', slot.alliance === 'red' ? 'bg-red-500' : 'bg-blue-500')} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">#{slot.team_number} <span className="font-normal text-slate-400">{slot.team_name}</span></p>
          <p className="text-[10px] uppercase tracking-wider text-slate-600">{slot.alliance === 'red' ? 'Vermelha' : 'Azul'} · posição {slot.position}</p>
        </div>
      </div>
      <div className={cn('hidden sm:flex items-center gap-1.5 text-xs', cfg.cls)}>
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </div>
      {finished ? (
        <span className="text-xs text-right text-slate-400 truncate">{slot.scout_username || 'Sem identificação'}</span>
      ) : (
        <div className="relative">
          <select
            disabled={saving}
            value={slot.scout_id ?? ''}
            onChange={event => event.target.value ? onAssign(event.target.value) : onUnassign()}
            className="appearance-none w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg pl-2.5 pr-7 py-2 focus:outline-none focus:border-orange-500 disabled:opacity-50"
          >
            <option value="">Sem scout</option>
            {scouts.map(scout => <option key={scout.id} value={scout.id}>{scout.username}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  scouts,
  selectedKeys,
  savingKey,
  onToggleSlot,
  onAssign,
  onUnassign,
}: {
  match: ScoutManagementMatch;
  scouts: Array<{ id: string; username: string }>;
  selectedKeys: Set<string>;
  savingKey: string | null;
  onToggleSlot: (slot: ScoutManagementSlot) => void;
  onAssign: (slot: ScoutManagementSlot, scoutId: string) => void;
  onUnassign: (slot: ScoutManagementSlot) => void;
}) {
  const covered = match.slots.filter(slot => slot.status !== 'pending').length;
  return (
    <article className="border-b border-slate-700/80 last:border-b-0">
      <header className="flex items-center justify-between gap-4 px-3 py-3 bg-slate-800/45">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-white">{match.display_name}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {match.match_type === 'qualification' ? 'Qualificação' : match.match_type === 'elimination' ? 'Eliminatória' : 'Treino'}
          </span>
        </div>
        <span className={cn('text-xs tabular-nums', covered === 4 ? 'text-emerald-400' : 'text-slate-400')}>{covered}/4 cobertas</span>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-slate-700/60">
        <div>{match.slots.filter(slot => slot.alliance === 'red').map(slot => (
          <SlotRow key={slotKey(slot)} slot={slot} scouts={scouts} selected={selectedKeys.has(slotKey(slot))} saving={savingKey === slotKey(slot)} onToggle={() => onToggleSlot(slot)} onAssign={id => onAssign(slot, id)} onUnassign={() => onUnassign(slot)} />
        ))}</div>
        <div>{match.slots.filter(slot => slot.alliance === 'blue').map(slot => (
          <SlotRow key={slotKey(slot)} slot={slot} scouts={scouts} selected={selectedKeys.has(slotKey(slot))} saving={savingKey === slotKey(slot)} onToggle={() => onToggleSlot(slot)} onAssign={id => onAssign(slot, id)} onUnassign={() => onUnassign(slot)} />
        ))}</div>
      </div>
    </article>
  );
}

function WorkloadRow({ workload }: { workload: ScoutWorkload }) {
  const [open, setOpen] = useState(false);
  const hasItems = workload.items.length > 0;
  return (
    <div className="border-b border-slate-700/70 last:border-b-0">
      <button type="button" onClick={() => hasItems && setOpen(value => !value)} className="w-full grid grid-cols-[1fr_repeat(3,54px)_24px] sm:grid-cols-[1fr_repeat(4,90px)_24px] items-center gap-2 px-4 py-3.5 text-left hover:bg-slate-800/60 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">{workload.scout.username.charAt(0).toUpperCase()}</div>
          <span className="font-semibold text-white truncate">{workload.scout.username}</span>
        </div>
        <span className="hidden sm:block text-center text-sm font-semibold text-white">{workload.counts.total}</span>
        <span className="text-center text-sm font-semibold text-blue-400">{workload.counts.assigned}</span>
        <span className="text-center text-sm font-semibold text-amber-400">{workload.counts.in_progress}</span>
        <span className="text-center text-sm font-semibold text-emerald-400">{workload.counts.done}</span>
        <ChevronDown className={cn('w-4 h-4 text-slate-500 transition-transform', open && 'rotate-180', !hasItems && 'opacity-20')} />
      </button>
      {open && (
        <div className="bg-slate-900/45 px-4 py-2 divide-y divide-slate-800">
          {workload.items.map(item => {
            const cfg = statusConfig[item.status];
            const Icon = cfg.icon;
            return (
              <div key={`${item.match_id}-${item.team_number}`} className="flex items-center gap-2 py-2 text-xs">
                <Icon className={cn('w-3.5 h-3.5', cfg.cls)} />
                <span className="text-slate-500">{item.championship_name}</span>
                <span className="font-semibold text-white">{item.match_display_name}</span>
                <span className="text-slate-400 truncate">#{item.team_number}{item.team_name ? ` · ${item.team_name}` : ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BatchConfirmModal({
  count,
  matchCount,
  scoutName,
  saving,
  onClose,
  onConfirm,
}: {
  count: number;
  matchCount: number;
  scoutName: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-orange-400 font-semibold">Revisar atribuição</p>
            <h3 className="text-xl font-bold text-white mt-1">{count} posições para {scoutName}</h3>
            <p className="text-sm text-slate-400 mt-2">O lote cobre {matchCount} partida{matchCount === 1 ? '' : 's'}. Posições já atribuídas ou iniciadas serão preservadas.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button type="button" disabled={saving} onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-400 text-white disabled:opacity-50">{saving ? 'Atribuindo...' : 'Confirmar lote'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ScoutManagementPage() {
  const { isCollapsed } = useSidebar();
  const { selectedChampionship, setSelectedChampionshipId } = useChampionshipContext();
  const [tab, setTab] = useState<Tab>('matches');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [matchType, setMatchType] = useState<MatchType | 'all'>('all');
  const [coverage, setCoverage] = useState<ScoutMatchCoverage | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selectedSlots, setSelectedSlots] = useState<BatchSlot[]>([]);
  const [batchScoutId, setBatchScoutId] = useState('');
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, loading, error, reload, assign, assignBatch, unassign } = useScoutManagement({
    page,
    pageSize: 20,
    search: deferredSearch,
    matchType,
    coverage,
  });

  useEffect(() => {
    setPage(1);
    setSelectedSlots([]);
    setNotice(null);
  }, [selectedChampionship?.id]);
  useEffect(() => { setPage(1); }, [deferredSearch, matchType, coverage]);

  const scouts = useMemo(() => data?.workloads.map(item => item.scout) ?? [], [data?.workloads]);
  const selectedKeys = useMemo(() => new Set(selectedSlots.map(slotKey)), [selectedSlots]);
  const pendingPageSlots = useMemo(() => data?.matches.items.flatMap(match => match.slots.filter(slot => slot.status === 'pending')) ?? [], [data?.matches.items]);
  const allPagePendingSelected = pendingPageSlots.length > 0 && pendingPageSlots.every(slot => selectedKeys.has(slotKey(slot)));
  const selectedMatchCount = useMemo(() => new Set(selectedSlots.map(slot => slot.match_id)).size, [selectedSlots]);
  const batchScout = scouts.find(scout => scout.id === batchScoutId);
  const isParent = data?.context.scope_type === 'event_group';

  const toggleSlot = (slot: ScoutManagementSlot) => {
    if (slot.status !== 'pending') return;
    const key = slotKey(slot);
    setSelectedSlots(current => current.some(item => slotKey(item) === key)
      ? current.filter(item => slotKey(item) !== key)
      : [...current, { match_id: slot.match_id, team_number: slot.team_number }]);
  };

  const togglePagePending = () => {
    const pageKeys = new Set(pendingPageSlots.map(slotKey));
    if (allPagePendingSelected) {
      setSelectedSlots(current => current.filter(slot => !pageKeys.has(slotKey(slot))));
      return;
    }
    setSelectedSlots(current => {
      const byKey = new Map(current.map(slot => [slotKey(slot), slot]));
      pendingPageSlots.forEach(slot => byKey.set(slotKey(slot), { match_id: slot.match_id, team_number: slot.team_number }));
      return [...byKey.values()];
    });
  };

  const handleAssign = async (slot: ScoutManagementSlot, scoutId: string) => {
    setSavingKey(slotKey(slot));
    setNotice(null);
    try { await assign(slot.match_id, slot.team_number, scoutId); }
    catch (e: any) { setNotice(e.message); }
    finally { setSavingKey(null); }
  };

  const handleUnassign = async (slot: ScoutManagementSlot) => {
    if (!slot.scout_id) return;
    setSavingKey(slotKey(slot));
    setNotice(null);
    try { await unassign(slot.match_id, slot.team_number); }
    catch (e: any) { setNotice(e.message); }
    finally { setSavingKey(null); }
  };

  const handleBatchConfirm = async () => {
    if (!batchScoutId || selectedSlots.length === 0) return;
    setSavingBatch(true);
    setNotice(null);
    try {
      const result = await assignBatch(batchScoutId, selectedSlots);
      setNotice(`${result.assigned} posições atribuídas${result.skipped ? `; ${result.skipped} preservadas por conflito` : ''}.`);
      setSelectedSlots([]);
      setShowBatchConfirm(false);
    } catch (e: any) {
      setNotice(e.message);
      setShowBatchConfirm(false);
    } finally {
      setSavingBatch(false);
    }
  };

  return (
      <div className="min-h-screen flex">
        <Sidebar />
        <main className={cn('flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
          <div className="max-w-6xl mx-auto pb-24">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-7 h-7 text-orange-500" />
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Gerenciamento de Scouts</h1>
                </div>
                <p className="text-sm text-slate-400 mt-1">Selecione o evento, abra uma divisão e distribua as posições.</p>
              </div>
              <button type="button" onClick={reload} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 self-start sm:self-auto">
                <RefreshCw className="w-4 h-4" /> Atualizar
              </button>
            </header>

            {data && (
              <section className="mb-5 bg-slate-900/35 border border-slate-700/80 rounded-2xl overflow-hidden">
                <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Escopo atual</p>
                    <div className="flex items-center gap-2 mt-1">
                      {data.context.scope_type === 'final' ? <Trophy className="w-4 h-4 text-orange-400" /> : <Layers3 className="w-4 h-4 text-slate-400" />}
                      <h2 className="font-semibold text-white truncate">{data.context.short_name || data.context.name}</h2>
                      <span className="text-xs text-slate-500">{data.context.event_code}</span>
                    </div>
                  </div>
                  {data.context.scope_type === 'event_group' && <span className="text-xs text-slate-400">Escolha uma divisão ou final abaixo</span>}
                </div>
                <ScopeTotals totals={data.totals} />
              </section>
            )}

            <ChampionshipDivisionNav className="mb-5" />

            {loading && !data && (
              <div className="text-center py-24"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-slate-400">Carregando scouts...</p></div>
            )}
            {error && <div className="flex items-center gap-3 p-4 bg-red-950/30 border border-red-900/60 rounded-xl text-sm text-red-300 mb-5"><AlertCircle className="w-5 h-5" />{error}</div>}
            {notice && <div className="flex items-center justify-between gap-3 p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 mb-5"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X className="w-4 h-4 text-slate-500" /></button></div>}

            {!loading && data && isParent && (
              <section className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-900/25">
                <div className="px-4 py-3 border-b border-slate-700/80">
                  <h3 className="font-semibold text-white">Divisões e final</h3>
                  <p className="text-xs text-slate-500 mt-0.5">As partidas permanecem separadas por escopo.</p>
                </div>
                {data.children.length > 0
                  ? data.children.map(summary => <ParentScopeRow key={summary.championship.id} summary={summary} onOpen={championship => setSelectedChampionshipId(championship.id)} />)
                  : <div className="py-16 text-center text-slate-500">Nenhuma divisão ou final cadastrada.</div>}
              </section>
            )}

            {data && !isParent && (
              <>
                <div className="grid grid-cols-2 bg-slate-800/60 rounded-xl p-1 mb-5">
                  <button type="button" onClick={() => setTab('matches')} className={cn('flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors', tab === 'matches' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white')}><ClipboardList className="w-4 h-4" />Partidas</button>
                  <button type="button" onClick={() => setTab('scouts')} className={cn('flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors', tab === 'scouts' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white')}><Users className="w-4 h-4" />Scouts por pessoa</button>
                </div>

                {tab === 'matches' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_170px] gap-2 mb-3">
                      <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar Q/M, equipe ou número" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" /></label>
                      <select value={matchType} onChange={event => setMatchType(event.target.value as MatchType | 'all')} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"><option value="all">Todos os tipos</option><option value="qualification">Qualificações</option><option value="elimination">Eliminatórias</option><option value="practice">Treinos</option></select>
                      <select value={coverage} onChange={event => setCoverage(event.target.value as ScoutMatchCoverage | 'all')} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"><option value="all">Toda cobertura</option><option value="unassigned">Sem atribuições</option><option value="partial">Cobertura parcial</option><option value="covered">Todas cobertas</option></select>
                    </div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <button type="button" disabled={pendingPageSlots.length === 0} onClick={togglePagePending} className="text-xs font-semibold text-orange-300 hover:text-orange-200 disabled:text-slate-600">{allPagePendingSelected ? 'Desmarcar pendentes da página' : 'Selecionar pendentes da página'}</button>
                      <span className="text-xs text-slate-500">{data.matches.total_items} partidas</span>
                    </div>

                    <section className={cn('border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-900/25 transition-opacity', loading && 'opacity-55')}>
                      {data.matches.items.length > 0 ? data.matches.items.map(match => (
                        <MatchRow key={match.id} match={match} scouts={scouts} selectedKeys={selectedKeys} savingKey={savingKey} onToggleSlot={toggleSlot} onAssign={handleAssign} onUnassign={handleUnassign} />
                      )) : <div className="py-20 text-center"><Search className="w-8 h-8 text-slate-700 mx-auto mb-3" /><p className="text-slate-400">Nenhuma partida encontrada neste filtro.</p></div>}
                    </section>

                    {data.matches.total_pages > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <button type="button" disabled={data.matches.page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-xs text-slate-400">Página <b className="text-white">{data.matches.page}</b> de {data.matches.total_pages}</span>
                        <button type="button" disabled={data.matches.page >= data.matches.total_pages} onClick={() => setPage(value => value + 1)} className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    )}
                  </>
                )}

                {tab === 'scouts' && (
                  <section className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-900/25">
                    <div className="grid grid-cols-[1fr_repeat(3,54px)_24px] sm:grid-cols-[1fr_repeat(4,90px)_24px] gap-2 px-4 py-2.5 border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-500"><span>Scout</span><span className="hidden sm:block text-center">Total</span><span className="text-center">Aguard.</span><span className="text-center">Andam.</span><span className="text-center">Feitos</span><span /></div>
                    {data.workloads.map(workload => <WorkloadRow key={workload.scout.id} workload={workload} />)}
                  </section>
                )}
              </>
            )}
          </div>

          {selectedSlots.length > 0 && !isParent && (
            <div className={cn('fixed bottom-4 z-40 left-4 right-4 lg:right-8', isCollapsed ? 'lg:left-24' : 'lg:left-72')}>
              <div className="max-w-4xl mx-auto bg-slate-900 border border-orange-500/50 rounded-2xl shadow-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1"><p className="font-semibold text-white">{selectedSlots.length} posições selecionadas</p><p className="text-xs text-slate-500">{selectedMatchCount} partidas · apenas pendências serão alteradas</p></div>
                <select value={batchScoutId} onChange={event => setBatchScoutId(event.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"><option value="">Escolha o scout</option>{scouts.map(scout => <option key={scout.id} value={scout.id}>{scout.username}</option>)}</select>
                <button type="button" disabled={!batchScoutId} onClick={() => setShowBatchConfirm(true)} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold disabled:opacity-40">Revisar lote</button>
                <button type="button" onClick={() => setSelectedSlots([])} className="p-2 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {showBatchConfirm && batchScout && (
            <BatchConfirmModal count={selectedSlots.length} matchCount={selectedMatchCount} scoutName={batchScout.username} saving={savingBatch} onClose={() => setShowBatchConfirm(false)} onConfirm={handleBatchConfirm} />
          )}
        </main>
      </div>
  );
}
