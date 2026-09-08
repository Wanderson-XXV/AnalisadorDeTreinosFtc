import { useMemo, useState } from 'react';
import { BarChart2, Image, List, Target, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MatchListCard } from '../championships/MatchListCard';
import { ScoutingViewModal } from '../championships/ScoutingViewModal';
import { computeTeamPerformance } from '../../lib/teamCareer';
import type { StrategyDetails } from '../../lib/teamCareer';
import { getTeamMatchCardTarget } from '../../lib/teamMatchCardTarget';
import { resolveMediaUrl } from '../../lib/api';
import type { Match, MatchMedia, ScoutingRound } from '../../lib/types';

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="border-l border-slate-700 pl-4 first:border-l-0 first:pl-0"><div className="text-2xl font-black text-white">{value}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</div></div>;
}

function StrategyLine({ title, details }: { title: string; details: StrategyDetails | null }) {
  if (!details) return <div><div className="mb-2 text-sm font-semibold text-slate-300">{title}</div><p className="text-xs text-slate-600">Sem dados de zona.</p></div>;
  const items = [{ label: 'Perto', value: details.nearPct }, { label: 'Longe', value: details.farPct }, { label: 'Híbrido', value: details.hybridPct }];
  return <div><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-slate-300">{title}</span><span className="text-xs font-bold text-orange-400">{details.strategy === 'near' ? 'Perto' : details.strategy === 'far' ? 'Longe' : 'Híbrido'}</span></div><div className="space-y-2">{items.map(item => <div key={item.label} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2 text-[11px] text-slate-500"><span>{item.label}</span><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-orange-500 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${item.value}%` }} /></div><span className="text-right">{item.value}%</span></div>)}</div></div>;
}

export function TeamPerformancePanel({ matches, media, teamNumber, registeredOnly = false }: {
  matches: Match[];
  media: MatchMedia[];
  teamNumber: number;
  registeredOnly?: boolean;
}) {
  const performance = useMemo(() => computeTeamPerformance(matches, teamNumber), [matches, teamNumber]);
  const [viewScouting, setViewScouting] = useState<{ sr: ScoutingRound; teamNumber: number; teamName?: string | null; alliance: 'red' | 'blue' } | null>(null);

  return <div className="space-y-9 motion-safe:animate-[fadeIn_.2s_ease-out]">
    <section>
      <div className="mb-4 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-orange-400" /><h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Desempenho</h2></div>
      {!performance ? <div className="border-y border-slate-800 py-10 text-center"><Target className="mx-auto mb-2 h-8 w-8 text-slate-700" /><p className="text-sm text-slate-400">{registeredOnly && matches.length === 0 ? 'Equipe inscrita, mas ainda sem partidas registradas.' : matches.length ? 'Há partidas, mas nenhuma possui scout com ciclos completos.' : 'Nenhuma partida registrada neste recorte.'}</p></div> : <>
        <div className="grid grid-cols-2 gap-y-5 border-y border-slate-800 py-5 sm:grid-cols-4"><Metric label="Melhor scout" value={performance.highestScore} /><Metric label="Média" value={performance.avgScore.toFixed(1)} /><Metric label="Taxa de acerto" value={`${performance.avgHitRate.toFixed(1)}%`} /><Metric label="Partidas scoutadas" value={performance.rounds.length} /></div>
        <div className="mt-7 grid gap-8 border-b border-slate-800 pb-7 md:grid-cols-2"><StrategyLine title="Teleoperado" details={performance.teleopDetails} /><StrategyLine title="Autônomo" details={performance.autoDetails} /></div>
      </>}
    </section>

    {performance && performance.chartData.length > 0 && <section>
      <div className="mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-orange-400" /><h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Evolução no recorte</h2></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0"><h3 className="mb-2 text-xs text-slate-500">Acertos por partida</h3><ResponsiveContainer width="100%" height={220}><BarChart data={performance.chartData}><XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} /><Legend /><Bar dataKey="auto" name="Autônomo" stackId="a" fill="#a855f7" /><Bar dataKey="teleop" name="Teleop" stackId="a" fill="#f97316" /></BarChart></ResponsiveContainer></div>
        <div className="min-w-0"><h3 className="mb-2 text-xs text-slate-500">Total ao longo das partidas</h3><ResponsiveContainer width="100%" height={220}><LineChart data={performance.chartData}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} /><Line type="monotone" dataKey="total" name="Total" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316' }} /></LineChart></ResponsiveContainer></div>
      </div>
    </section>}

    {media.length > 0 && <section><div className="mb-4 flex items-center gap-2"><Image className="h-4 w-4 text-orange-400" /><h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Mídias ({media.length})</h2></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map(item => <a key={item.id} href={resolveMediaUrl(item.file_path)} target="_blank" rel="noreferrer" className="group relative aspect-video overflow-hidden rounded-lg bg-slate-800 ring-orange-500 transition hover:ring-2">{item.file_type === 'image' ? <img src={resolveMediaUrl(item.file_path)} alt={item.title ?? item.original_filename} className="h-full w-full object-cover transition-transform group-hover:scale-105 motion-reduce:transition-none" /> : <div className="flex h-full items-center justify-center"><Image className="h-6 w-6 text-slate-600" /></div>}<span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/80 px-2 py-1 text-[11px] text-slate-300">{item.title || item.original_filename}</span></a>)}</div></section>}

    <section><div className="mb-4 flex items-center gap-2"><List className="h-4 w-4 text-orange-400" /><h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Partidas ({matches.length})</h2></div>{matches.length === 0 ? <div className="border-y border-slate-800 py-9 text-center text-sm text-slate-500">Nenhuma partida neste recorte.</div> : <div className="space-y-3">{matches.map(match => { const target = getTeamMatchCardTarget(match, teamNumber); return <MatchListCard key={match.id} match={match} onView={() => target && setViewScouting(target)} />; })}</div>}</section>
    {viewScouting && <ScoutingViewModal scoutingRound={viewScouting.sr} teamNumber={viewScouting.teamNumber} teamName={viewScouting.teamName} alliance={viewScouting.alliance} onClose={() => setViewScouting(null)} />}
  </div>;
}
