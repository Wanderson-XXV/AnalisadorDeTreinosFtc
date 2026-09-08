import { useState, useEffect, useMemo } from 'react';
import {
  BarChart2, Trophy, Target, Zap, Percent, TrendingUp,
  Users, SlidersHorizontal, X, ChevronUp, ChevronDown,
  Medal, Star, GitCompare, Plus, Pencil, Trash2, CalendarRange, Layers3,
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Tooltip as RTooltip, Legend,
} from 'recharts';
import { Sidebar } from '../components/Sidebar';
import { useSidebar } from '../hooks/useSidebar';
import { TeamProfileModal } from '../components/TeamProfileModal';
import { ComparisonProfileForm } from '../components/ComparisonProfileForm';
import { fetchApi, resolveLogoUrl } from '../lib/api';
import { cn } from '../lib/utils';
import { useChampionshipContext } from '../hooks/useChampionshipContext';
import type { ComparisonMetrics, ComparisonProfile } from '../lib/types';
import { buildComparisonChartData, buildComparisonMetricBenchmarks, RANKING_COMPARISON_METRICS, toggleComparisonSelection } from '../lib/comparisonProfiles';

interface TeamStats {
  team_number: number;
  team_name: string;
  logo_url?: string;
  logo_position?: string;
  matches_scouted: number;
  avg_score: number;
  max_score: number;
  avg_auto: number;
  max_auto: number;
  avg_teleop: number;
  max_teleop: number;
  avg_hit_rate: number;
  consistency: number;
  scores: number[];
  comparison_metrics: ComparisonMetrics;
}

interface DisplayParticipant {
  key: string;
  label: string;
  subtitle: string;
  logo_url?: string | null;
  logo_position?: string;
  metrics: ComparisonMetrics;
  team_number?: number;
}

interface Weights {
  avg_score:    number;
  max_score:    number;
  avg_auto:     number;
  avg_teleop:   number;
  avg_hit_rate: number;
  consistency:  number;
}

type RankingMetricKey = keyof Weights;

interface ProfileRankingRow {
  profile: ComparisonProfile;
  score: number;
  avg_score: number;
  max_score: number;
  avg_auto: number;
  avg_teleop: number;
  avg_hit_rate: number;
  consistency: number;
}

const DEFAULT_WEIGHTS: Weights = {
  avg_score:    30,
  max_score:    20,
  avg_auto:     15,
  avg_teleop:   15,
  avg_hit_rate: 10,
  consistency:  10,
};

const WEIGHT_LABELS: Record<keyof Weights, string> = {
  avg_score:    'Média de Pontuação',
  max_score:    'Maior Pontuação',
  avg_auto:     'Média Autônomo',
  avg_teleop:   'Média Teleop',
  avg_hit_rate: 'Taxa de Acerto',
  consistency:  'Consistência',
};

const METRIC_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444'];

const RANKING_COLUMNS = [
  ['score', 'Score', Star],
  ['avg_score', 'Média', TrendingUp],
  ['max_score', 'Máx', Trophy],
  ['avg_auto', 'Auto', Zap],
  ['avg_teleop', 'Teleop', Zap],
  ['avg_hit_rate', 'Acerto', Percent],
  ['consistency', 'Consist.', Target],
] as const;

function normalize(teams: TeamStats[], key: keyof TeamStats) {
  const vals = teams.map(t => Number(t[key]));
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  if (max === min) return teams.map(() => 100);
  return vals.map(v => ((v - min) / (max - min)) * 100);
}

function computeScores(teams: TeamStats[], weights: Weights): (TeamStats & { score: number })[] {
  const keys = Object.keys(weights) as (keyof Weights)[];
  const normed: Record<keyof Weights, number[]> = {} as never;
  keys.forEach(k => { normed[k] = normalize(teams, k as keyof TeamStats); });

  const totalWeight = keys.reduce((s, k) => s + weights[k], 0) || 1;

  return teams.map((t, i) => {
    const score = keys.reduce((s, k) => s + (normed[k][i] * weights[k]) / totalWeight, 0);
    return { ...t, score: Math.round(score * 10) / 10 };
  }).sort((a, b) => b.score - a.score);
}

function profileRankingMetrics(profile: ComparisonProfile): Omit<ProfileRankingRow, 'profile' | 'score'> {
  return {
    avg_score: profile.metrics.avg_hits_per_round,
    max_score: profile.metrics.max_hits_per_round,
    avg_auto: profile.metrics.avg_auto_hits_per_round,
    avg_teleop: profile.metrics.avg_teleop_hits_per_round,
    avg_hit_rate: profile.metrics.hit_rate,
    consistency: profile.metrics.consistency,
  };
}

function rankingComparisonMetrics(team: TeamStats): ComparisonMetrics {
  return {
    ...team.comparison_metrics,
    hit_rate: team.avg_hit_rate,
    avg_hits_per_round: team.avg_score,
    avg_auto_hits_per_round: team.avg_auto,
    avg_teleop_hits_per_round: team.avg_teleop,
    max_hits_per_round: team.max_score,
    consistency: team.consistency,
  };
}

function calculateProfileScore(metrics: Omit<ProfileRankingRow, 'profile' | 'score'>, teams: TeamStats[], weights: Weights): number {
  const keys = Object.keys(weights) as RankingMetricKey[];
  const totalWeight = keys.reduce((total, key) => total + weights[key], 0) || 1;
  const score = keys.reduce((total, key) => {
    const teamValues = teams.map(team => Number(team[key]));
    const min = Math.min(...teamValues);
    const max = Math.max(...teamValues);
    const normalized = teams.length === 0 || max === min ? 100 : ((metrics[key] - min) / (max - min)) * 100;
    return total + (normalized * weights[key]) / totalWeight;
  }, 0);
  return Math.round(Math.max(0, score) * 10) / 10;
}

function TeamLogo({ url, position, size = 'md' }: { url?: string; position?: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  if (!url) {
    return (
      <div className={`${sz} rounded-full bg-slate-700 ring-2 ring-slate-600 flex items-center justify-center flex-shrink-0`}>
        <Users className="w-4 h-4 text-slate-500" />
      </div>
    );
  }
  return (
    <div className={`${sz} rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-600 flex-shrink-0`}>
      <img
        src={resolveLogoUrl(url)}
        alt=""
        className="w-full h-full object-cover"
        style={{ objectPosition: position ?? 'center' }}
        onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
      />
    </div>
  );
}

function RankingRadarTooltip({
  active,
  payload,
  participants,
  benchmarks,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { metricKey?: string } }>;
  participants: DisplayParticipant[];
  benchmarks: Partial<Record<keyof ComparisonMetrics, number>>;
}) {
  const key = payload?.[0]?.payload?.metricKey;
  const definition = RANKING_COMPARISON_METRICS.find(item => item.key === key);
  if (!active || !definition) return null;

  return (
    <div className="min-w-52 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 shadow-xl">
      <p className="text-xs font-bold text-white">{definition.label}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{definition.description}</p>
      <p className="mt-1 text-[11px] text-slate-500">100 no radar = {definition.format(benchmarks[definition.key] ?? 0)} no recorte atual.</p>
      <div className="mt-2 space-y-1.5 border-t border-slate-700 pt-2">
        {participants.map((participant, index) => (
          <div key={participant.key} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: METRIC_COLORS[index] }} />
              <span className="max-w-32 truncate">{participant.label}</span>
            </span>
            <span className="shrink-0 font-bold" style={{ color: METRIC_COLORS[index] }}>{definition.format(definition.value(participant.metrics))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const rankColors = [
  'from-yellow-500/20 to-yellow-600/10 border-yellow-700/40 text-yellow-400',
  'from-slate-400/20 to-slate-500/10 border-slate-600/40 text-slate-300',
  'from-orange-700/20 to-orange-800/10 border-orange-800/40 text-orange-500',
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="w-4 h-4 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-slate-300" />;
  if (rank === 3) return <Medal className="w-4 h-4 text-orange-500" />;
  return <span className="text-xs text-slate-500 font-bold w-4 text-center">{rank}</span>;
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-orange-400 w-8 text-right">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-orange-500 cursor-pointer"
      />
    </div>
  );
}

export default function AnalysisPage() {
  const { isCollapsed } = useSidebar();
  const { queryString, selectedChampionship, flatChampionships } = useChampionshipContext();
  const [teams, setTeams]         = useState<TeamStats[]>([]);
  const [comparisonProfiles, setComparisonProfiles] = useState<ComparisonProfile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [weights, setWeights]     = useState<Weights>(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const [selected, setSelected]   = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState<ComparisonProfile | null | undefined>(undefined);
  const [profileTeam, setProfileTeam] = useState<number | null>(null);
  const [sortKey, setSortKey]     = useState<'score' | keyof TeamStats>('score');
  const [sortAsc, setSortAsc]     = useState(false);
  const [profileSortKey, setProfileSortKey] = useState<'score' | RankingMetricKey>('score');
  const [profileSortAsc, setProfileSortAsc] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchApi<{ teams: TeamStats[] }>(`/analysis.php${queryString ? `?${queryString}` : ''}`),
      fetchApi<{ profiles: ComparisonProfile[] }>('/comparison-profiles.php'),
    ])
      .then(([teamData, profileData]) => {
        setTeams(teamData.teams);
        setComparisonProfiles(profileData.profiles);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [queryString]);

  const ranked = useMemo(() => computeScores(teams, weights), [teams, weights]);

  const sorted = useMemo(() => {
    if (sortKey === 'score') return sortAsc ? [...ranked].reverse() : ranked;
    return [...ranked].sort((a, b) => {
      const av = Number(a[sortKey as keyof TeamStats]);
      const bv = Number(b[sortKey as keyof TeamStats]);
      return sortAsc ? av - bv : bv - av;
    });
  }, [ranked, sortKey, sortAsc]);

  const profileRankingRows = useMemo<ProfileRankingRow[]>(() => comparisonProfiles.map(profile => {
    const metrics = profileRankingMetrics(profile);
    return { profile, ...metrics, score: calculateProfileScore(metrics, teams, weights) };
  }), [comparisonProfiles, teams, weights]);

  const sortedProfiles = useMemo(() => [...profileRankingRows].sort((a, b) => {
    const result = a[profileSortKey] - b[profileSortKey];
    return profileSortAsc ? result : -result;
  }), [profileRankingRows, profileSortKey, profileSortAsc]);

  const legacyCompareData = useMemo(() => {
    if (selected.length < 2) return [];
    const sel = selected.map(key => ranked.find(t => `team:${t.team_number}` === key)!).filter(Boolean);
    return [
      { metric: 'Média',       ...Object.fromEntries(sel.map(t => [t.team_number, t.avg_score])) },
      { metric: 'Máx',         ...Object.fromEntries(sel.map(t => [t.team_number, t.max_score])) },
      { metric: 'Auto',        ...Object.fromEntries(sel.map(t => [t.team_number, t.avg_auto])) },
      { metric: 'Teleop',      ...Object.fromEntries(sel.map(t => [t.team_number, t.avg_teleop])) },
      { metric: 'Acerto %',    ...Object.fromEntries(sel.map(t => [t.team_number, +t.avg_hit_rate.toFixed(1)])) },
      { metric: 'Consistência',...Object.fromEntries(sel.map(t => [t.team_number, +t.consistency.toFixed(1)])) },
    ];
  }, [selected, ranked]);

  const legacyRadarData = useMemo(() => {
    if (selected.length < 2) return [];
    const keys: (keyof TeamStats)[] = ['avg_score', 'max_score', 'avg_auto', 'avg_teleop', 'avg_hit_rate', 'consistency'];
    const normed: Record<string, number[]> = {};
    keys.forEach(k => {
      normed[k] = normalize(teams, k);
    });
    const labels: Record<string, string> = {
      avg_score: 'Média', max_score: 'Máx', avg_auto: 'Auto',
      avg_teleop: 'Teleop', avg_hit_rate: 'Acerto', consistency: 'Consistência',
    };
    return keys.map(k => ({
      metric: labels[k],
      ...Object.fromEntries(
        selected.map(key => {
          const idx = teams.findIndex(t => `team:${t.team_number}` === key);
          return [key, idx >= 0 ? Math.round(normed[k][idx]) : 0];
        })
      ),
    }));
  }, [selected, teams]);

  const participants = useMemo<DisplayParticipant[]>(() => [
    ...ranked.map(team => ({
      key: `team:${team.team_number}`,
      label: `#${team.team_number} ${team.team_name}`,
      subtitle: selectedChampionship?.short_name || selectedChampionship?.name || 'Equipe oficial',
      logo_url: team.logo_url,
      logo_position: team.logo_position,
      metrics: rankingComparisonMetrics(team),
      team_number: team.team_number,
    })),
    ...comparisonProfiles.map(profile => ({
      key: `profile:${profile.id}`,
      label: profile.name,
      subtitle: profile.nickname || (profile.source_type === 'training_period' ? 'Periodo de treino' : 'Media de campeonato'),
      logo_url: profile.logo_url,
      logo_position: profile.logo_position,
      metrics: profile.metrics,
    })),
  ], [ranked, comparisonProfiles, selectedChampionship]);

  const selectedParticipants = useMemo(
    () => selected.map(key => participants.find(participant => participant.key === key)).filter(Boolean) as DisplayParticipant[],
    [selected, participants],
  );

  const compareData = useMemo(() => buildComparisonChartData(selectedParticipants), [selectedParticipants]);

  const metricBenchmarks = useMemo(() => buildComparisonMetricBenchmarks(
    teams.map(team => ({
      key: `team:${team.team_number}`,
      label: team.team_name,
      metrics: rankingComparisonMetrics(team),
    })),
  ), [teams]);

  const radarData = useMemo(() => {
    if (selectedParticipants.length < 2) return [];
    return RANKING_COMPARISON_METRICS.map(definition => {
      const values = selectedParticipants.map(participant => definition.value(participant.metrics));
      const benchmark = metricBenchmarks[definition.key] ?? 0;
      return {
        metric: definition.shortLabel,
        metricKey: definition.key,
        ...Object.fromEntries(selectedParticipants.map((participant, index) => [participant.key, benchmark > 0 ? Math.min(100, Math.round((values[index] / benchmark) * 100)) : 0])),
      };
    });
  }, [metricBenchmarks, selectedParticipants]);

  const toggleSelect = (key: string) => setSelected(previous => toggleComparisonSelection(previous, key));

  const saveComparisonProfile = async (payload: Record<string, unknown>) => {
    const id = payload.id as string | undefined;
    const saved = await fetchApi<ComparisonProfile>(`/comparison-profiles.php${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload),
    });
    setComparisonProfiles(previous => id ? previous.map(profile => profile.id === id ? saved : profile) : [...previous, saved]);
  };

  const deleteProfile = async (profile: ComparisonProfile) => {
    if (!window.confirm(`Excluir o perfil "${profile.name}"?`)) return;
    await fetchApi<{ success: boolean }>(`/comparison-profiles.php?id=${encodeURIComponent(profile.id)}`, { method: 'DELETE' });
    setComparisonProfiles(previous => previous.filter(item => item.id !== profile.id));
    setSelected(previous => previous.filter(key => key !== `profile:${profile.id}`));
  };

  const setWeight = (key: keyof Weights, val: number) => {
    setWeights(w => ({ ...w, [key]: val }));
  };

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const handleProfileSort = (key: typeof profileSortKey) => {
    if (profileSortKey === key) setProfileSortAsc(ascending => !ascending);
    else { setProfileSortKey(key); setProfileSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3 opacity-30" />;

  const ProfileSortIcon = ({ k }: { k: typeof profileSortKey }) =>
    profileSortKey === k
      ? profileSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3 opacity-30" />;

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn('flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <div className="max-w-6xl mx-auto space-y-6">

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-orange-400" />
                Comparar equipes
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {selectedChampionship ? `Ranking em ${selectedChampionship.short_name || selectedChampionship.name}` : 'Ranqueie e compare equipes com base em pesos personalizados'}
              </p>
            </div>
            <button
              onClick={() => setShowWeights(w => !w)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all',
                showWeights
                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Pesos do Ranking
            </button>
          </div>

          {showWeights && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-orange-400" />
                  Configurar Pesos
                </h2>
                <button
                  onClick={() => setWeights(DEFAULT_WEIGHTS)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                >
                  Resetar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {(Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]).map(k => (
                  <WeightSlider
                    key={k}
                    label={WEIGHT_LABELS[k]}
                    value={weights[k]}
                    onChange={v => setWeight(k, v)}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">Os pesos são normalizados automaticamente. Arraste os sliders para priorizar métricas específicas.</p>
            </div>
          )}

          {!loading && !error && (
            <section className="border-y border-slate-700 py-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Layers3 className="h-4 w-4 text-orange-400" /> Perfis comparativos</h2>
                  <p className="mt-1 text-xs text-slate-400">Referências de treino e médias de campeonato para a comparação direta.</p>
                </div>
                <button type="button" onClick={() => setEditingProfile(null)} className="flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500">
                  <Plus className="h-4 w-4" /> Novo perfil
                </button>
              </div>

              {comparisonProfiles.length === 0 ? (
                <button type="button" onClick={() => setEditingProfile(null)} className="w-full rounded-md border border-dashed border-slate-600 py-5 text-sm text-slate-400 hover:border-orange-500 hover:text-white">
                  Crie a primeira referência de comparação
                </button>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800/60">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/80">
                        <th className="px-4 py-2.5 text-left"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Perfil</span></th>
                        {RANKING_COLUMNS.map(([key, label, Icon]) => (
                          <th key={key} className="px-3 py-2.5 text-right">
                            <button onClick={() => handleProfileSort(key)} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-white">
                              <Icon className="h-3 w-3" />
                              {label}
                              <ProfileSortIcon k={key} />
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-right"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProfiles.map(({ profile, score, avg_score, max_score, avg_auto, avg_teleop, avg_hit_rate, consistency }) => {
                        const key = `profile:${profile.id}`;
                        const isSelected = selected.includes(key);
                        const selectionIndex = selected.indexOf(key);
                        const sourceLabel = profile.source_type === 'training_period'
                          ? `${profile.start_date} ${profile.end_date ? `a ${profile.end_date}` : 'em diante'}`
                          : (profile.championship_short_name || profile.championship_name || 'Campeonato');
                        return (
                          <tr key={profile.id} className={cn('border-b border-slate-700/50 last:border-b-0 transition-colors', isSelected ? 'bg-orange-500/5' : 'hover:bg-slate-700/30')}>
                            <td className="px-4 py-3">
                              <div className="flex min-w-[190px] items-center gap-3">
                                <TeamLogo url={profile.logo_url || undefined} position={profile.logo_position} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {isSelected && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: METRIC_COLORS[selectionIndex] }} />}
                                    <span className="truncate text-sm font-bold text-white">{profile.name}</span>
                                    {profile.nickname && <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{profile.nickname}</span>}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                                    <CalendarRange className="h-3 w-3 flex-shrink-0 text-slate-500" />
                                    <span className="truncate">{sourceLabel}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right"><span className="text-sm font-black text-orange-400">{score.toFixed(1)}</span></td>
                            <td className="px-3 py-3 text-right"><span className="text-sm text-white">{avg_score.toFixed(1)}</span></td>
                            <td className="px-3 py-3 text-right"><span className="text-sm text-white">{max_score.toFixed(1)}</span></td>
                            <td className="px-3 py-3 text-right"><span className="text-sm text-purple-300">{avg_auto.toFixed(1)}</span></td>
                            <td className="px-3 py-3 text-right"><span className="text-sm text-blue-300">{avg_teleop.toFixed(1)}</span></td>
                            <td className="px-3 py-3 text-right"><span className="text-sm text-rose-300">{avg_hit_rate.toFixed(1)}%</span></td>
                            <td className="px-3 py-3 text-right"><span className="text-sm text-emerald-300">{consistency.toFixed(1)}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button type="button" onClick={() => setEditingProfile(profile)} title="Editar perfil" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-white"><Pencil className="h-4 w-4" /></button>
                                <button type="button" onClick={() => void deleteProfile(profile)} title="Excluir perfil" className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:border-red-400/60 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                                <button type="button" onClick={() => toggleSelect(key)} disabled={!isSelected && selected.length >= 4} title={isSelected ? 'Remover da comparação' : 'Adicionar à comparação'} className={cn('flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40', isSelected ? 'border-orange-500 bg-orange-500/15 text-orange-300' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white')}>
                                  {isSelected ? <X className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {loading && (
            <div className="flex items-center justify-center h-60 text-slate-400">Carregando dados...</div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-400 text-sm">{error}</div>
          )}

          {!loading && !error && sorted.length === 0 && (
            <div className="text-center py-16 text-slate-500 bg-slate-800/50 rounded-2xl border border-slate-700">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-base font-medium">Nenhuma equipe scouted ainda</p>
              <p className="text-sm mt-1">Faça scouts de partidas para ver a análise comparativa.</p>
            </div>
          )}

          {!loading && sorted.length > 0 && (
            <>
              {selected.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium">Comparando:</span>
                  {selectedParticipants.map((participant, i) => (
                    <div key={participant.key} className="flex items-center gap-1.5 bg-slate-700 rounded-lg px-2 py-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: METRIC_COLORS[i] }} />
                      <span className="max-w-40 truncate text-xs font-semibold text-white">{participant.label}</span>
                      <button onClick={() => toggleSelect(participant.key)} className="text-slate-400 hover:text-white ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {selected.length < 4 && (
                    <span className="text-xs text-slate-500">Selecione até {4 - selected.length} equipe{4 - selected.length !== 1 ? 's' : ''} a mais</span>
                  )}
                </div>
              )}

              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                  <Trophy className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-bold text-white">Ranking das Equipes</h2>
                  <span className="ml-auto text-xs text-slate-500">{sorted.length} equipes</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/80">
                        <th className="px-4 py-2.5 text-left w-8"><span className="sr-only">Rank</span></th>
                        <th className="px-4 py-2.5 text-left">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Equipe</span>
                        </th>
                        {([
                          ['score',        'Score',    Star],
                          ['avg_score',    'Média',    TrendingUp],
                          ['max_score',    'Máx',      Trophy],
                          ['avg_auto',     'Auto',     Zap],
                          ['avg_teleop',   'Teleop',   Zap],
                          ['avg_hit_rate', 'Acerto',   Percent],
                          ['consistency',  'Consist.', Target],
                        ] as const).map(([key, label, Icon]) => (
                          <th key={key} className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => handleSort(key as typeof sortKey)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-white transition-colors"
                            >
                              <Icon className="w-3 h-3" />
                              {label}
                              <SortIcon k={key as typeof sortKey} />
                            </button>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-center">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comparar</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((t, i) => {
                        const rank    = ranked.indexOf(t) + 1;
                        const selectionKey = `team:${t.team_number}`;
                        const isSel   = selected.includes(selectionKey);
                        const selIdx  = selected.indexOf(selectionKey);
                        const rankCl  = rank <= 3 ? rankColors[rank - 1] : '';
                        return (
                          <tr
                            key={t.team_number}
                            className={cn(
                              'border-b border-slate-700/50 transition-colors',
                              isSel ? 'bg-orange-500/5' : 'hover:bg-slate-700/30'
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center border bg-gradient-to-br', rank <= 3 ? rankCl : 'border-slate-700 text-slate-500')}>
                                <RankBadge rank={rank} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setProfileTeam(t.team_number)}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                              >
                                <TeamLogo url={t.logo_url} position={t.logo_position} size="sm" />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    {isSel && (
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: METRIC_COLORS[selIdx] }} />
                                    )}
                                    <span className="text-sm font-bold text-white">#{t.team_number}</span>
                                  </div>
                                  <span className="text-xs text-slate-400 truncate max-w-[120px] block">{t.team_name}</span>
                                </div>
                              </button>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm font-black text-orange-400">{t.score.toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm text-white">{t.avg_score.toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm text-white">{t.max_score}</span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm text-purple-300">{t.avg_auto.toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm text-blue-300">{t.avg_teleop.toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm text-rose-300">{t.avg_hit_rate.toFixed(1)}%</span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="text-sm text-emerald-300">{t.consistency.toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => toggleSelect(selectionKey)}
                                disabled={!isSel && selected.length >= 4}
                                className={cn(
                                  'w-6 h-6 rounded border-2 transition-all flex items-center justify-center mx-auto',
                                  isSel
                                    ? 'border-orange-500 bg-orange-500/20'
                                    : 'border-slate-600 hover:border-slate-400 disabled:opacity-30'
                                )}
                              >
                                {isSel && <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: METRIC_COLORS[selIdx] }} />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedParticipants.length >= 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-slate-400" />
                    <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Comparação Direta</h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
                    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Radar das métricas do ranking</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">Escala do recorte: 100 representa o maior valor registrado entre todas as equipes deste recorte. Passe o mouse em um eixo para ver o valor real e a referência.</p>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData} margin={{ top: 12, right: 24, bottom: 2, left: 24 }}>
                          <PolarGrid stroke="#334155" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                          {selectedParticipants.map((participant, index) => (
                            <Radar key={participant.key} name={participant.label} dataKey={participant.key} stroke={METRIC_COLORS[index]} fill={METRIC_COLORS[index]} fillOpacity={0.16} strokeWidth={2} />
                          ))}
                          <RTooltip content={<RankingRadarTooltip participants={selectedParticipants} benchmarks={metricBenchmarks} />} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-700 pt-3 sm:grid-cols-2">
                        {selectedParticipants.map((participant, index) => (
                          <div key={participant.key} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: METRIC_COLORS[index] }} />
                              <TeamLogo url={participant.logo_url || undefined} position={participant.logo_position} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{participant.label}</p>
                                <p className="truncate text-[10px] text-slate-400">{participant.subtitle}</p>
                              </div>
                            </div>
                            <div className="mt-3 space-y-1 text-xs">
                              <div className="flex justify-between gap-3"><span className="text-slate-400">Taxa de acerto</span><span className="font-bold" style={{ color: METRIC_COLORS[index] }}>{participant.metrics.hit_rate.toFixed(1)}%</span></div>
                              <div className="flex justify-between gap-3"><span className="text-slate-400">Média de acertos</span><span className="font-semibold text-white">{participant.metrics.avg_hits_per_round.toFixed(1)}</span></div>
                              <div className="flex justify-between gap-3"><span className="text-slate-400">Rounds</span><span className="font-semibold text-white">{participant.metrics.rounds_count}</span></div>
                            </div>
                            {participant.team_number && <button onClick={() => setProfileTeam(participant.team_number!)} className="mt-3 w-full rounded-lg bg-slate-700/50 py-1 text-[10px] text-slate-400 transition-colors hover:bg-slate-700 hover:text-white">Ver perfil</button>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Comparação por métrica</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">Barras e números usam os mesmos valores do Ranking das Equipes. A cor identifica cada equipe.</p>
                      <div className="mt-4 space-y-3">
                        {compareData.map(row => {
                          const values = selectedParticipants.map(participant => Number(row[participant.key]));
                          const definition = RANKING_COMPARISON_METRICS.find(item => item.label === row.metric)!;
                          const benchmark = metricBenchmarks[definition.key] ?? 0;
                          return (
                            <div key={String(row.metric)} className="border-b border-slate-700/70 pb-3 last:border-b-0 last:pb-0">
                              <div className="flex items-baseline justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-slate-100">{row.metric}</p>
                                  <p className="text-[11px] text-slate-500">{row.description}</p>
                                </div>
                                <span className="shrink-0 text-[10px] font-medium text-slate-500">maior é melhor</span>
                              </div>
                              <div className="mt-2 space-y-1.5">
                                {selectedParticipants.map((participant, index) => {
                                  const value = values[index];
                                  const width = benchmark > 0 ? Math.min(100, (value / benchmark) * 100) : 0;
                                  return (
                                    <div key={participant.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                                      <div className="h-2 overflow-hidden rounded-full bg-slate-700/80">
                                        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${width}%`, backgroundColor: METRIC_COLORS[index] }} />
                                      </div>
                                      <span className="w-14 text-right text-xs font-bold tabular-nums" style={{ color: METRIC_COLORS[index] }}>{definition.format(value)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}
        </div>
      </main>

      {profileTeam !== null && (
        <TeamProfileModal teamNumber={profileTeam} onClose={() => setProfileTeam(null)} />
      )}
      {editingProfile !== undefined && (
        <ComparisonProfileForm
          profile={editingProfile}
          championships={flatChampionships}
          onSave={saveComparisonProfile}
          onClose={() => setEditingProfile(undefined)}
        />
      )}
    </div>
  );
}
