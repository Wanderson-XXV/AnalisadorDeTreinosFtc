import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Filter, Hash, Instagram, ListPlus, Pencil, Plus, Search, ShieldAlert, Trash2, Users, X } from 'lucide-react';
import { Link } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { TeamForm } from '../components/teams/TeamForm';
import { BulkTeamImport } from '../components/championships/BulkTeamImport';
import { useSidebar } from '../hooks/useSidebar';
import { useTeams } from '../hooks/useTeams';
import { useChampionshipContext } from '../hooks/useChampionshipContext';
import { fetchApi, resolveLogoUrl } from '../lib/api';
import { getContextSelectableChampionships, getTopLevelContextChampionship } from '../lib/championshipHierarchy';
import { buildTeamProfilePath } from '../lib/teamProfilePath';
import type { TeamProfileScope } from '../lib/teamProfilePath';
import { cn } from '../lib/utils';
import type { Team, TeamDirectoryItem } from '../lib/types';

function DirectoryRow({ item, profileScope, onEdit, onDelete }: {
  item: TeamDirectoryItem;
  profileScope: TeamProfileScope;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_minmax(0,1fr)_minmax(13rem,auto)_auto] items-center gap-3 sm:gap-5 border-b border-slate-800 px-1 py-4 transition-colors hover:bg-slate-900/55">
      <Link to={buildTeamProfilePath(item.team_number, profileScope)} className="absolute inset-0 z-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/60" aria-label={`Abrir perfil da equipe ${item.team_number} neste recorte`} />
      <div className="h-11 w-11 overflow-hidden rounded-lg bg-slate-800 flex items-center justify-center">
        {item.logo_url ? <img src={resolveLogoUrl(item.logo_url)} alt="" className="h-full w-full object-contain" /> : <Hash className="h-5 w-5 text-slate-600" />}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-orange-400">#{item.team_number}</span>
          <span className="truncate font-semibold text-white">{item.team_name}</span>
          {item.incomplete && <span className="hidden rounded-full border border-amber-800/60 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300 sm:inline">Cadastro incompleto</span>}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
          {item.instagram && <span className="flex items-center gap-1"><Instagram className="h-3 w-3" />{item.instagram}</span>}
          {item.latest_season_label && <span>{item.latest_season_label}</span>}
          {item.incomplete && <span className="text-amber-400 sm:hidden">Cadastro incompleto</span>}
        </div>
      </div>
      <div className="hidden items-center gap-5 text-right sm:flex">
        <div><strong className="block text-sm text-slate-200">{item.events_count}</strong><span className="text-[11px] text-slate-500">eventos</span></div>
        <div><strong className="block text-sm text-slate-200">{item.matches_count}</strong><span className="text-[11px] text-slate-500">partidas</span></div>
        <div><strong className="block text-sm text-slate-200">{item.scouted_matches_count}</strong><span className="text-[11px] text-slate-500">scouts</span></div>
      </div>
      <div className="relative z-20 flex items-center gap-1">
        {!item.incomplete && <>
          <button onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-orange-400" title="Editar equipe"><Pencil className="h-4 w-4" /></button>
          <button onClick={onDelete} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-400" title="Excluir equipe"><Trash2 className="h-4 w-4" /></button>
        </>}
        <ArrowRight className="ml-1 h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-orange-400" />
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const { isCollapsed } = useSidebar();
  const { reload: reloadBaseTeams, createTeam, updateTeam, deleteTeam } = useTeams();
  const { championships, flatChampionships, selectedChampionship, selectedChampionshipId, loading: championshipLoading } = useChampionshipContext();
  const [items, setItems] = useState<TeamDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [season, setSeason] = useState('');
  const [eventId, setEventId] = useState(() => selectedChampionshipId ?? '');
  const [hasScout, setHasScout] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const appliedContextRef = useRef<string | null>(null);

  const events = useMemo(() => getContextSelectableChampionships(championships), [championships]);
  const seasons = useMemo(() => [...new Set(events.map(item => item.season).filter((value): value is string => !!value))].sort().reverse(), [events]);
  const selectedFilterChampionship = useMemo(() => flatChampionships.find(item => item.id === eventId) ?? null, [eventId, flatChampionships]);

  useEffect(() => {
    if (!selectedChampionshipId || !selectedChampionship || appliedContextRef.current === selectedChampionshipId) return;
    appliedContextRef.current = selectedChampionshipId;
    setSeason(selectedChampionship.season ?? '');
    setEventId(selectedChampionshipId);
  }, [selectedChampionship, selectedChampionshipId]);

  const load = useCallback(async () => {
    if (championshipLoading) return;
    setLoading(true); setError(null);
    const params = new URLSearchParams({ view: 'directory' });
    if (season) params.set('season', season);
    if (eventId) params.set('championship_id', eventId);
    if (hasScout) params.set('has_scout', '1');
    try { setItems(await fetchApi<TeamDirectoryItem[]>(`/teams.php?${params}`)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [championshipLoading, eventId, hasScout, season]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return items;
    return items.filter(item => String(item.team_number).includes(value) || item.team_name.toLowerCase().includes(value) || (item.instagram ?? '').toLowerCase().includes(value));
  }, [items, search]);

  const profileScope = useMemo<TeamProfileScope>(() => {
    if (!selectedFilterChampionship) return season ? { season } : {};
    const root = getTopLevelContextChampionship(selectedFilterChampionship, flatChampionships);
    return {
      season: root?.season ?? selectedFilterChampionship.season ?? season,
      event: root?.id ?? selectedFilterChampionship.id,
      division: selectedFilterChampionship.parent_id ? selectedFilterChampionship.id : null,
    };
  }, [flatChampionships, season, selectedFilterChampionship]);

  const save = async (data: any) => {
    if (editTeam) await updateTeam({ ...data, id: editTeam.id });
    else await createTeam(data);
    await reloadBaseTeams(); await load();
  };
  const remove = async (item: TeamDirectoryItem) => {
    if (!item.id || !confirm(`Excluir equipe #${item.team_number} ${item.team_name}?`)) return;
    await deleteTeam(item.id); await load();
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn('flex-1 overflow-x-hidden px-4 pb-10 pt-20 transition-all sm:px-6 lg:px-8 lg:pt-8', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <div className="mx-auto max-w-6xl">
          <header className="mb-7 flex flex-col gap-5 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="flex items-center gap-3"><Users className="h-7 w-7 text-orange-500" /><h1 className="text-3xl font-bold text-white">Equipes</h1></div><p className="mt-2 text-sm text-slate-400">Diretório permanente e histórico competitivo.</p></div>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:text-white"><ListPlus className="h-4 w-4" />Importar</button>
              <button onClick={() => { setEditTeam(null); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-white hover:bg-orange-600"><Plus className="h-4 w-4" />Nova equipe</button>
            </div>
          </header>

          <section className="mb-6 space-y-3" aria-label="Filtros do diretório">
            <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_minmax(14rem,1fr)_auto]">
              <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar número, nome ou Instagram" className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500" /></label>
              <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><select aria-label="Filtrar por temporada" value={season} onChange={event => { const next = event.target.value; setSeason(next); if (next && selectedFilterChampionship?.season !== next) setEventId(''); }} className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-orange-500"><option value="">Todas as temporadas</option>{seasons.map(value => <option key={value} value={value}>{value}–{Number(value) + 1}</option>)}</select></label>
              <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><select aria-label="Filtrar por torneio ou divisão" value={eventId} onChange={event => { const nextId = event.target.value; const next = flatChampionships.find(item => item.id === nextId); setEventId(nextId); if (next?.season) setSeason(next.season); }} className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-orange-500"><option value="">Todos os torneios</option>{events.filter(item => !season || item.season === season).map(item => item.children?.length ? <optgroup key={item.id} label={item.short_name || item.name}><option value={item.id}>{item.short_name || item.name} · Todas as divisões</option>{item.children.map(child => <option key={child.id} value={child.id}>— {child.short_name || child.name}</option>)}</optgroup> : <option key={item.id} value={item.id}>{item.short_name || item.name}</option>)}</select></label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"><input type="checkbox" checked={hasScout} onChange={event => setHasScout(event.target.checked)} className="accent-orange-500" />Com scout</label>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
              {season && <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">Temporada {season}–{Number(season) + 1}<button onClick={() => setSeason('')} className="text-slate-500 hover:text-white" aria-label="Remover filtro de temporada"><X className="h-3.5 w-3.5" /></button></span>}
              {selectedFilterChampionship && <span className="inline-flex items-center gap-2 rounded-full border border-orange-800/70 bg-orange-950/25 px-3 py-1 text-xs font-semibold text-orange-300">{selectedFilterChampionship.short_name || selectedFilterChampionship.name}<button onClick={() => setEventId('')} className="text-orange-500 hover:text-white" aria-label="Remover filtro de torneio"><X className="h-3.5 w-3.5" /></button></span>}
              {hasScout && <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">Com scout<button onClick={() => setHasScout(false)} className="text-slate-500 hover:text-white" aria-label="Remover filtro de scout"><X className="h-3.5 w-3.5" /></button></span>}
              {selectedChampionshipId && eventId !== selectedChampionshipId && <button onClick={() => { setSeason(selectedChampionship?.season ?? ''); setEventId(selectedChampionshipId); }} className="text-xs font-semibold text-orange-400 hover:text-orange-300">Usar campeonato ativo: {selectedChampionship?.short_name || selectedChampionship?.name}</button>}
            </div>
          </section>

          <div className="flex items-center justify-between border-y border-slate-800 py-3 text-sm"><span className="font-semibold text-slate-300">{loading ? 'Carregando…' : `${filtered.length} equipe${filtered.length === 1 ? '' : 's'}`}</span>{(season || eventId || hasScout) && <button onClick={() => { setSeason(''); setEventId(''); setHasScout(false); }} className="text-xs text-slate-500 hover:text-white">Limpar filtros</button>}</div>
          {error && <div className="my-5 rounded-lg border border-red-800 bg-red-950/30 p-4 text-red-300">{error}</div>}
          {!loading && !error && filtered.length === 0 && <div className="py-20 text-center"><ShieldAlert className="mx-auto mb-3 h-9 w-9 text-slate-700" /><p className="text-slate-400">Nenhuma equipe encontrada neste recorte.</p></div>}
          {!loading && !error && <div className="motion-safe:animate-[fadeIn_.2s_ease-out]">{filtered.map(item => <DirectoryRow key={item.team_number} item={item} profileScope={profileScope} onEdit={() => { setEditTeam(item as Team); setShowForm(true); }} onDelete={() => void remove(item)} />)}</div>}
        </div>
      </main>
      {showForm && <TeamForm team={editTeam} onSave={save} onClose={() => { setShowForm(false); setEditTeam(null); }} />}
      {showBulkImport && <BulkTeamImport onDone={() => { void reloadBaseTeams(); void load(); }} onClose={() => setShowBulkImport(false)} />}
    </div>
  );
}
