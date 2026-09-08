import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronRight, Clock3, Hash, MapPin, Trophy } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { TeamPerformancePanel } from '../components/team-profile/TeamPerformancePanel';
import { useSidebar } from '../hooks/useSidebar';
import { fetchApi, resolveLogoUrl } from '../lib/api';
import { computeTeamPerformance, eventStatusLabels, filterTeamProfileData } from '../lib/teamCareer';
import { cn } from '../lib/utils';
import type { TeamCareerEvent, TeamCareerSeason, TeamProfileData } from '../lib/types';

function SummaryItem({ value, label }: { value: number; label: string }) {
  return <div><strong className="block text-xl font-black text-white">{value}</strong><span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span></div>;
}

function formatEventDate(value: string): string {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  return new Date(value).toLocaleDateString('pt-BR');
}

function Statuses({ event }: { event: TeamCareerEvent }) {
  return <div className="flex flex-wrap gap-1.5">{eventStatusLabels(event).map((label, index) => <span key={label} className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', index === 0 ? 'border-slate-700 text-slate-400' : label === 'Com scout' ? 'border-orange-800/70 bg-orange-950/30 text-orange-300' : 'border-emerald-900/70 bg-emerald-950/20 text-emerald-400')}>{label}</span>)}</div>;
}

function EventRow({ event, active, onClick }: { event: TeamCareerEvent; active?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={cn('group w-full border-b border-slate-800 px-2 py-4 text-left transition-colors hover:bg-slate-900/70', active && 'bg-slate-900 ring-1 ring-inset ring-orange-500/40')}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{event.short_name || event.name}</div><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">{event.starts_at && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatEventDate(event.starts_at)}</span>}<span>{event.matches_count} partidas</span><span>{event.scouted_matches_count} scouts</span></div></div><ChevronRight className="mt-1 h-4 w-4 flex-none text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-orange-400" /></div><div className="mt-3"><Statuses event={event} /></div>
  </button>;
}

function CareerOverview({ seasons, onSeason, onEvent }: { seasons: TeamCareerSeason[]; onSeason: (season: TeamCareerSeason) => void; onEvent: (season: TeamCareerSeason, event: TeamCareerEvent) => void }) {
  if (!seasons.length) return <div className="border-y border-slate-800 py-16 text-center"><Clock3 className="mx-auto mb-3 h-9 w-9 text-slate-700" /><p className="text-slate-400">Esta equipe ainda não possui histórico competitivo.</p></div>;
  return <div className="space-y-10">{seasons.map(season => <section key={season.season ?? 'unknown'} className="grid gap-5 md:grid-cols-[10rem_1fr]"><button onClick={() => onSeason(season)} className="self-start text-left"><span className="text-xs font-bold uppercase tracking-widest text-orange-400">Temporada</span><strong className="mt-1 block text-2xl font-black text-white">{season.label}</strong><span className="mt-2 block text-xs text-slate-500">{season.events_count} eventos · {season.matches_count} partidas</span></button><div className="relative border-l border-slate-700 pl-6 before:absolute before:-left-1 before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-orange-500">{season.events.map(event => <EventRow key={event.id ?? event.name} event={event} onClick={() => onEvent(season, event)} />)}</div></section>)}</div>;
}

function SeasonComparison({ season, data, teamNumber, onEvent }: { season: TeamCareerSeason; data: TeamProfileData; teamNumber: number; onEvent: (event: TeamCareerEvent) => void }) {
  const scoped = filterTeamProfileData(data, season);
  const performance = computeTeamPerformance(scoped.matches, teamNumber);
  return <div className="space-y-8">
    <div><span className="text-xs font-bold uppercase tracking-widest text-orange-400">Temporada</span><h2 className="mt-1 text-3xl font-black text-white">{season.label}</h2><p className="mt-2 text-sm text-slate-400">Comparação entre torneios desta temporada. As métricas não são misturadas com outros jogos.</p></div>
    <div className="grid grid-cols-2 gap-5 border-y border-slate-800 py-5 sm:grid-cols-4"><SummaryItem value={season.events_count} label="Eventos" /><SummaryItem value={season.matches_count} label="Partidas" /><SummaryItem value={season.scouted_matches_count} label="Com scout" /><SummaryItem value={season.media_count} label="Mídias" /></div>
    {performance && <div className="text-sm text-slate-400">Média da temporada: <strong className="text-white">{performance.avgScore.toFixed(1)}</strong> acertos por scout · taxa de acerto <strong className="text-white">{performance.avgHitRate.toFixed(1)}%</strong></div>}
    <section><h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Torneios</h3><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-y border-slate-800 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Torneio</th><th className="px-3 py-3">Partidas</th><th className="px-3 py-3">Scouts</th><th className="px-3 py-3">Cobertura</th><th className="px-3 py-3">Média</th><th className="px-3 py-3">Melhor</th><th className="px-3 py-3"></th></tr></thead><tbody>{season.events.map(event => { const ids = new Set([event.id, ...event.divisions.map(item => item.id)].filter(Boolean)); const eventMatches = data.matches.filter(match => !!match.championship_id && ids.has(match.championship_id)); const metrics = computeTeamPerformance(eventMatches, teamNumber); const coverage = event.matches_count ? Math.round((event.scouted_matches_count / event.matches_count) * 100) : 0; return <tr key={event.id ?? event.name} onClick={() => onEvent(event)} className="cursor-pointer border-b border-slate-800 transition-colors hover:bg-slate-900"><td className="px-3 py-4"><div className="font-semibold text-white">{event.short_name || event.name}</div><div className="mt-1"><Statuses event={event} /></div></td><td className="px-3 py-4 text-slate-300">{event.matches_count}</td><td className="px-3 py-4 text-slate-300">{event.scouted_matches_count}</td><td className="px-3 py-4 text-slate-300">{coverage}%</td><td className="px-3 py-4 text-slate-300">{metrics ? metrics.avgScore.toFixed(1) : '—'}</td><td className="px-3 py-4 text-slate-300">{metrics?.highestScore ?? '—'}</td><td className="px-3 py-4 text-right"><ChevronRight className="inline h-4 w-4 text-orange-400" /></td></tr>; })}</tbody></table></div></section>
  </div>;
}

export default function TeamProfilePage() {
  const { teamNumber } = useParams<{ teamNumber: string }>();
  const navigate = useNavigate();
  const { isCollapsed } = useSidebar();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<TeamProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const number = Number(teamNumber);

  useEffect(() => {
    if (!number) return;
    setLoading(true); setError(null);
    fetchApi<TeamProfileData>(`/team-profile.php?team_number=${number}`)
      .then(setData).catch(error => setError(error.message)).finally(() => setLoading(false));
  }, [number]);

  const selection = useMemo(() => {
    if (!data) return { season: null, event: null, division: null };
    const eventId = params.get('event');
    const divisionId = params.get('division');
    const eventSeason = data.seasons.find(item => item.events.some(event => event.id === eventId));
    const season = eventSeason ?? data.seasons.find(item => item.season === params.get('season')) ?? null;
    const event = season?.events.find(item => item.id === eventId) ?? null;
    const division = event?.divisions.find(item => item.id === divisionId) ?? null;
    return { season, event, division };
  }, [data, params]);

  const selectGeneral = () => setParams({});
  const selectSeason = (season: TeamCareerSeason) => setParams(season.season ? { season: season.season } : {});
  const selectEvent = (season: TeamCareerSeason, event: TeamCareerEvent) => { const next: Record<string, string> = {}; if (season.season) next.season = season.season; if (event.id) next.event = event.id; setParams(next); };
  const scoped = data ? filterTeamProfileData(data, selection.season, selection.event, selection.division) : { matches: [], media: [] };

  return <div className="min-h-screen flex"><Sidebar /><main className={cn('flex-1 overflow-x-hidden px-4 pb-12 pt-20 transition-all sm:px-6 lg:px-8 lg:pt-8', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}><div className="mx-auto max-w-6xl">
    <button onClick={() => navigate(-1)} className="mb-5 flex items-center gap-2 text-sm text-slate-500 hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar</button>
    {loading && <div className="py-24 text-center text-slate-400">Carregando carreira da equipe…</div>}
    {error && <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-red-300">{error}</div>}
    {!loading && !error && data && <>
      <header className="mb-7 flex flex-col gap-6 border-b border-slate-700 pb-7 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">{data.team?.logo_url ? <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-800"><img src={resolveLogoUrl(data.team.logo_url)} alt="" className="h-full w-full object-contain" /></div> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-800"><Hash className="h-7 w-7 text-slate-600" /></div>}<div><div className="flex flex-wrap items-baseline gap-3"><span className="text-3xl font-black text-orange-400">#{number}</span><h1 className="text-2xl font-black text-white sm:text-3xl">{data.team?.team_name || 'Equipe sem cadastro'}</h1></div><div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">{data.team?.incomplete && <span className="text-amber-400">Cadastro incompleto</span>}{data.team?.instagram && <span>@{data.team.instagram.replace('@', '')}</span>}<span>Perfil de carreira</span></div></div></div>
        <div className="grid grid-cols-5 gap-4 md:min-w-[28rem]"><SummaryItem value={data.summary.seasons_count} label="Temporadas" /><SummaryItem value={data.summary.events_count} label="Eventos" /><SummaryItem value={data.summary.matches_count} label="Partidas" /><SummaryItem value={data.summary.scouted_matches_count} label="Scouts" /><SummaryItem value={data.summary.media_count} label="Mídias" /></div>
      </header>

      <nav className="mb-7 flex gap-2 overflow-x-auto border-b border-slate-800 pb-3" aria-label="Temporadas da equipe"><button onClick={selectGeneral} className={cn('rounded-lg px-4 py-2 text-sm font-bold transition-colors', !selection.season ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>Geral</button>{data.seasons.map(season => <button key={season.season ?? 'unknown'} onClick={() => selectSeason(season)} className={cn('whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors', selection.season?.season === season.season ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>{season.label}</button>)}</nav>

      {!selection.season ? <CareerOverview seasons={data.seasons} onSeason={selectSeason} onEvent={selectEvent} /> : <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]"><aside className="self-start lg:sticky lg:top-6"><button onClick={() => selectSeason(selection.season!)} className={cn('mb-2 w-full rounded-lg px-3 py-2 text-left text-sm font-bold', !selection.event ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800')}>Geral da temporada</button><div className="border-t border-slate-800">{selection.season.events.map(event => <EventRow key={event.id ?? event.name} event={event} active={selection.event?.id === event.id} onClick={() => selectEvent(selection.season!, event)} />)}</div></aside><div className="min-w-0">{!selection.event ? <SeasonComparison season={selection.season} data={data} teamNumber={number} onEvent={event => selectEvent(selection.season!, event)} /> : <div className="space-y-7"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-400"><Trophy className="h-4 w-4" />{selection.season.label}</div><h2 className="mt-2 text-3xl font-black text-white">{selection.event.name}</h2>{selection.event.location && <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4" />{selection.event.location}</p>}<div className="mt-4"><Statuses event={selection.event} /></div>{selection.event.divisions.length > 1 && <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => selectEvent(selection.season!, selection.event!)} className={cn('rounded-lg border px-3 py-1.5 text-xs font-bold', !selection.division ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-700 text-slate-400')}>Todas as divisões</button>{selection.event.divisions.map(division => <button key={division.id ?? division.name} onClick={() => { const next: Record<string,string> = {}; if (selection.season?.season) next.season = selection.season.season; if (selection.event?.id) next.event = selection.event.id; if (division.id) next.division = division.id; setParams(next); }} className={cn('rounded-lg border px-3 py-1.5 text-xs font-bold', selection.division?.id === division.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-700 text-slate-400 hover:text-white')}>{division.short_name || division.name}</button>)}</div>}</div><TeamPerformancePanel matches={scoped.matches} media={scoped.media} teamNumber={number} registeredOnly={selection.division?.registered ?? selection.event.registered} /></div>}</div></div>}
    </>}
  </div></main></div>;
}
