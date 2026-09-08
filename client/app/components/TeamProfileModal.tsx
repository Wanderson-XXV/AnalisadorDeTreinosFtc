import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Hash, Target, Trophy, X } from 'lucide-react';
import { Link } from 'react-router';
import { useChampionshipContext } from '../hooks/useChampionshipContext';
import { fetchApi, resolveLogoUrl } from '../lib/api';
import { getTopLevelContextChampionship } from '../lib/championshipHierarchy';
import { computeTeamPerformance } from '../lib/teamCareer';
import { buildTeamProfilePath } from '../lib/teamProfilePath';
import type { TeamProfileData } from '../lib/types';

export function TeamProfileModal({ teamNumber, onClose }: { teamNumber: number; onClose: () => void }) {
  const { queryString, selectedChampionship, flatChampionships } = useChampionshipContext();
  const [data, setData] = useState<TeamProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetchApi<TeamProfileData>(`/team-profile.php?team_number=${teamNumber}${queryString ? `&${queryString}` : ''}`)
      .then(setData).catch(error => setError(error.message)).finally(() => setLoading(false));
  }, [queryString, teamNumber]);

  const performance = useMemo(() => data ? computeTeamPerformance(data.matches, teamNumber) : null, [data, teamNumber]);
  const fullProfilePath = useMemo(() => {
    const root = getTopLevelContextChampionship(selectedChampionship, flatChampionships);
    return buildTeamProfilePath(teamNumber, {
      season: root?.season ?? selectedChampionship?.season,
      event: root?.id ?? selectedChampionship?.id,
      division: selectedChampionship?.parent_id ? selectedChampionship.id : null,
    });
  }, [flatChampionships, selectedChampionship, teamNumber]);

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onClick={event => event.target === event.currentTarget && onClose()}>
    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl motion-safe:animate-[fadeIn_.18s_ease-out]">
      <div className="flex items-center justify-between border-b border-slate-800 p-5"><span className="text-xs font-bold uppercase tracking-widest text-slate-500">Prévia no contexto atual</span><button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div>
      {loading && <div className="py-20 text-center text-sm text-slate-400">Carregando equipe…</div>}
      {error && <div className="m-5 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>}
      {!loading && !error && data && <div className="p-5">
        <div className="flex items-center gap-4">{data.team?.logo_url ? <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-800"><img src={resolveLogoUrl(data.team.logo_url)} alt="" className="h-full w-full object-contain" /></div> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800"><Hash className="h-6 w-6 text-slate-600" /></div>}<div><div className="flex items-baseline gap-2"><span className="text-2xl font-black text-orange-400">#{teamNumber}</span><h2 className="text-xl font-bold text-white">{data.team?.team_name || 'Equipe sem cadastro'}</h2></div><p className="mt-1 text-xs text-slate-500">{selectedChampionship?.short_name || selectedChampionship?.name || 'Todas as competições'}</p></div></div>
        <div className="my-6 grid grid-cols-3 border-y border-slate-800 py-5 text-center"><div><strong className="block text-xl text-white">{data.matches.length}</strong><span className="text-[11px] uppercase text-slate-500">Partidas</span></div><div className="border-x border-slate-800"><strong className="block text-xl text-white">{performance?.rounds.length ?? 0}</strong><span className="text-[11px] uppercase text-slate-500">Scouts</span></div><div><strong className="block text-xl text-white">{performance ? performance.avgScore.toFixed(1) : '—'}</strong><span className="text-[11px] uppercase text-slate-500">Média</span></div></div>
        {!performance && <div className="mb-5 flex items-center gap-3 text-sm text-slate-500"><Target className="h-5 w-5" />Sem scout completo neste campeonato.</div>}
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-slate-400"><Trophy className="h-5 w-5 text-orange-400" /><span>A carreira completa reúne <strong className="text-white">{data.summary.events_count} eventos</strong> em <strong className="text-white">{data.summary.seasons_count} temporadas</strong>.</span></div>
        <Link to={fullProfilePath} onClick={onClose} className="flex w-full items-center justify-between rounded-lg bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600">Ver desempenho neste torneio<ArrowRight className="h-4 w-4" /></Link>
      </div>}
    </div>
  </div>;
}
