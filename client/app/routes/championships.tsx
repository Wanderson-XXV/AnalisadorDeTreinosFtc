import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ClipboardCheck, Trophy, Plus, Search, ListPlus, RefreshCw, Video, X } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useSidebar } from '../hooks/useSidebar';
import { useMatches } from '../hooks/useMatches';
import { useTeams } from '../hooks/useTeams';
import { useAuth } from '../hooks/useAuth';
import { MatchForm } from '../components/championships/MatchForm';
import { MatchListCard } from '../components/championships/MatchListCard';
import { MatchModal } from '../components/championships/MatchModal';
import { BulkMatchForm } from '../components/championships/BulkMatchForm';
import { ChampionshipDivisionNav } from '../components/championships/ChampionshipDivisionNav';
import { cn } from '../lib/utils';
import type { Match, Team, ScoutAssignment } from '../lib/types';
import { fetchApi } from '../lib/api';
import { useNavigate } from 'react-router';
import { DEFAULT_TRANSITION_DURATION_MS } from '../lib/matchTiming';
import { useChampionshipContext } from '../hooks/useChampionshipContext';
import { getMatchTeamSlots } from '../lib/matchTeams';
export default function ChampionshipsPage() {
  const { isCollapsed } = useSidebar();
  const { scout } = useAuth();
  const { selectedChampionship, selectedChampionshipId, queryString } = useChampionshipContext();
  const { matches, loading, error, reload, createMatch, updateMatch, deleteMatch } = useMatches();
  const { teams } = useTeams();
  const isEventGroup = selectedChampionship?.scope_type === 'event_group';
  const canCreateMatches = !!selectedChampionshipId && !isEventGroup;
  const isCri = selectedChampionship?.event_code === 'FPECRI';
  const autoSyncAttempted = useRef(new Set<string>());

  const teamsMap = useMemo(() => {
    const map = new Map<number, Team>();
    teams.forEach(t => map.set(t.team_number, t));
    return map;
  }, [teams]);

  const [assignments, setAssignments] = useState<ScoutAssignment[]>([]);
  useEffect(() => {
    fetchApi<ScoutAssignment[]>(`/scout_assignments.php${queryString ? `?${queryString}` : ''}`).then(setAssignments).catch(() => {});
  }, [queryString]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'qualification' | 'practice' | 'elimination'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed'>('all');
  const [contentFilter, setContentFilter] = useState<'all' | 'scout' | 'video' | 'scout_video'>('all');
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [viewMatch, setViewMatch] = useState<Match | null>(null);
  const [autoPlayMatchVideo, setAutoPlayMatchVideo] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [syncingFtcScout, setSyncingFtcScout] = useState(false);
  const [ftcScoutSyncMessage, setFtcScoutSyncMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const syncFtcScoutMatches = useCallback(async () => {
    if (!selectedChampionshipId) return;
    setSyncingFtcScout(true);
    setFtcScoutSyncMessage(null);
    try {
      const result = await fetchApi<{ summary: { matches: { created: number; updated: number; found: number } } }>('/sync_ftcscout_matches.php', {
        method: 'POST',
        body: JSON.stringify({ championship_id: selectedChampionshipId }),
      });
      const { created, updated, found } = result.summary.matches;
      setFtcScoutSyncMessage(`FTCScout sincronizado: ${created} nova(s), ${updated} atualizada(s), ${found} encontrada(s).`);
      await reload();
    } catch (err: any) {
      setFtcScoutSyncMessage(`Não foi possível sincronizar com o FTCScout: ${err.message}`);
    } finally {
      setSyncingFtcScout(false);
    }
  }, [reload, selectedChampionshipId]);

  useEffect(() => {
    if (!isCri || !selectedChampionshipId || loading || matches.length > 0 || autoSyncAttempted.current.has(selectedChampionshipId)) return;
    const storageKey = `ftcscout-auto-sync:${selectedChampionshipId}`;
    if (sessionStorage.getItem(storageKey)) return;
    autoSyncAttempted.current.add(selectedChampionshipId);
    sessionStorage.setItem(storageKey, '1');
    void syncFtcScoutMatches();
  }, [isCri, loading, matches.length, selectedChampionshipId, syncFtcScoutMatches]);
  const filtered = matches.filter(m => {
    if (typeFilter !== 'all' && m.match_type !== typeFilter) return false;
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    const hasScout = (m.scouting_rounds?.length ?? 0) > 0;
    const hasVideo = Boolean(m.has_video);
    if (contentFilter === 'scout' && !hasScout) return false;
    if (contentFilter === 'video' && !hasVideo) return false;
    if (contentFilter === 'scout_video' && (!hasScout || !hasVideo)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return m.display_name.toLowerCase().includes(s) || getMatchTeamSlots(m).some(slot =>
      String(slot.number).includes(s) || (slot.name ?? teamsMap.get(slot.number)?.team_name ?? '').toLowerCase().includes(s)
    );
  });

  const typeCounts = useMemo(() => ({
    all: matches.length,
    qualification: matches.filter(m => m.match_type === 'qualification').length,
    practice: matches.filter(m => m.match_type === 'practice').length,
    elimination: matches.filter(m => m.match_type === 'elimination').length,
  }), [matches]);

  const statusCounts = useMemo(() => ({
    all: matches.length,
    scheduled: matches.filter(m => m.status === 'scheduled').length,
    in_progress: matches.filter(m => m.status === 'in_progress').length,
    completed: matches.filter(m => m.status === 'completed').length,
  }), [matches]);

  const contentCounts = useMemo(() => ({
    all: matches.length,
    scout: matches.filter(m => (m.scouting_rounds?.length ?? 0) > 0).length,
    video: matches.filter(m => Boolean(m.has_video)).length,
    scout_video: matches.filter(m => (m.scouting_rounds?.length ?? 0) > 0 && Boolean(m.has_video)).length,
  }), [matches]);

  const hasActiveFilters = search || typeFilter !== 'all' || statusFilter !== 'all' || contentFilter !== 'all';

  const handleView = async (match: Match, options?: { autoPlayVideo?: boolean }) => {
    setLoadingModal(true);
    setAutoPlayMatchVideo(!!options?.autoPlayVideo);
    try {
      const full = await fetchApi<Match>(`/matches.php?id=${match.id}`);
      setViewMatch(full);
    } catch (e: any) {
      setAutoPlayMatchVideo(false);
      alert(e.message);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta partida?')) return;
    try {
      await deleteMatch(id);
      if (viewMatch?.id === id) setViewMatch(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSave = async (data: any) => {
    if (!canCreateMatches || !selectedChampionshipId) {
      throw new Error('Selecione uma divisão, final ou campeonato independente para criar partidas.');
    }
    const payload = { ...data, championship_id: selectedChampionshipId };
    if (editMatch) {
      const updated = await updateMatch({ ...payload, id: editMatch.id });
      if (viewMatch?.id === updated.id) setViewMatch(updated);
    } else {
      await createMatch(payload);
    }
  };

  const handleStartScouting = async (teamNumber: number) => {
    if (!viewMatch) return;
    if (!scout) {
      alert('Você precisa estar logado para fazer scouting.');
      return;
    }

    try {
      const existing = viewMatch.scouting_rounds?.find(
        sr => sr.team_number === teamNumber && !sr.is_locked
      );
      if (existing) {
        await fetchApi(`/scouting.php?id=${existing.id}`, { method: 'DELETE' });
      }

      const result = await fetchApi<{ id: string }>('/scouting.php', {
        method: 'POST',
        body: JSON.stringify({
          match_id: viewMatch.id,
          team_number: teamNumber,
          scout_id: scout.id,
          transition_duration_ms: scout.transition_duration_ms ?? DEFAULT_TRANSITION_DURATION_MS,
        }),
      });
      setViewMatch(null);
      navigate(`/scouting/${result.id}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main
        className={cn(
          'flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden',
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Trophy className="w-8 h-8 text-orange-500" />
                <h2 className="text-3xl font-bold text-white">Partidas</h2>
              </div>
              <p className="text-slate-400">
                {selectedChampionship ? `Gerencie partidas em ${selectedChampionship.short_name || selectedChampionship.name}.` : 'Selecione um campeonato para gerenciar partidas.'}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isCri && (
                <button
                  onClick={() => { void syncFtcScoutMatches(); }}
                  disabled={syncingFtcScout}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                  title="Busca a tabela oficial mais recente do CRI no FTCScout"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingFtcScout ? 'animate-spin' : ''}`} />
                  {syncingFtcScout ? 'Sincronizando...' : 'Sincronizar FTCScout'}
                </button>
              )}
              <button
                onClick={() => setShowBulkForm(true)}
                disabled={!canCreateMatches}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
              >
                <ListPlus className="w-4 h-4" />
                Lote
              </button>
              <button
                onClick={() => { setEditMatch(null); setShowForm(true); }}
                disabled={!canCreateMatches}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Partida
              </button>
            </div>
          </div>
          {isCri && ftcScoutSyncMessage && (
            <div className={`mb-4 rounded-xl border p-3 text-sm ${ftcScoutSyncMessage.startsWith('Não foi') ? 'border-red-800 bg-red-950/30 text-red-200' : 'border-blue-800/60 bg-blue-950/30 text-blue-100'}`}>
              {ftcScoutSyncMessage}
            </div>
          )}
          <ChampionshipDivisionNav className="mb-4" />
          {isEventGroup && (
            <div className="mb-4 bg-indigo-900/20 border border-indigo-700/40 rounded-xl p-4 text-sm text-indigo-200">
              Este e o evento pai. Escolha uma divisao ou final acima para ver, criar ou importar partidas.
            </div>
          )}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por partida, equipe ou número..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="flex gap-1 flex-wrap">
              {([
                { value: 'all',           label: 'Todas',          count: typeCounts.all },
                { value: 'qualification', label: 'Qualificatórias', count: typeCounts.qualification },
                { value: 'elimination',   label: 'Eliminatórias',   count: typeCounts.elimination },
                { value: 'practice',      label: 'Treinos',         count: typeCounts.practice },
              ] as const).map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setTypeFilter(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    typeFilter === tab.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${typeFilter === tab.value ? 'bg-orange-600' : 'bg-slate-700'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-1 flex-wrap sm:ml-auto">
              {([
                { value: 'all',         label: 'Qualquer status',  cls: '' },
                { value: 'scheduled',   label: 'Agendadas',         cls: 'text-slate-300' },
                { value: 'in_progress', label: 'Em andamento',      cls: 'text-yellow-400' },
                { value: 'completed',   label: 'Completas',         cls: 'text-green-400' },
              ] as const).map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-slate-600 text-white border border-slate-500'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  <span className={statusFilter === tab.value ? 'text-white' : tab.cls}>{tab.label}</span>
                  {tab.value !== 'all' && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-700">
                      {statusCounts[tab.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-1 flex-wrap">
              {([
                { value: 'all',         label: 'Todo conteúdo', icon: null },
                { value: 'scout',       label: 'Com scout',     icon: ClipboardCheck },
                { value: 'video',       label: 'Com vídeo',     icon: Video },
                { value: 'scout_video', label: 'Scout + vídeo', icon: ClipboardCheck },
              ] as const).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setContentFilter(tab.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      contentFilter === tab.value
                        ? 'bg-sky-600 text-white border border-sky-500'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${contentFilter === tab.value ? 'bg-sky-700' : 'bg-slate-700'}`}>
                      {contentCounts[tab.value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">{filtered.length} partida{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setContentFilter('all'); }}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-16 text-slate-400">
              Carregando partidas...
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-400 mb-4">
              {error}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-20">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">
                {hasActiveFilters
                  ? 'Nenhuma partida encontrada para os filtros selecionados.'
                  : isEventGroup
                    ? 'Escolha uma divisao ou final acima para ver as partidas.'
                    : 'Nenhuma partida cadastrada. Crie a primeira!'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setContentFilter('all'); }}
                  className="mt-3 text-sm text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              {filtered.map(match => (
                <MatchListCard
                  key={match.id}
                  match={match}
                  teamsMap={teamsMap}
                  assignments={assignments}
                  onView={() => handleView(match)}
                  onVideoView={() => navigate(`/match-analysis/${match.id}`)}
                  onDelete={() => handleDelete(match.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showForm && (
        <MatchForm
          match={editMatch}
          allianceSize={selectedChampionship?.alliance_size ?? 2}
          championshipTimezone={selectedChampionship?.timezone ?? 'America/Sao_Paulo'}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditMatch(null); }}
        />
      )}

      {showBulkForm && (
        <BulkMatchForm
          championshipId={selectedChampionshipId ?? ''}
          allianceSize={selectedChampionship?.alliance_size ?? 2}
          championshipTimezone={selectedChampionship?.timezone ?? 'America/Sao_Paulo'}
          onDone={() => { void reload(); }}
          onClose={() => setShowBulkForm(false)}
          existingMatches={matches.map(m => ({ match_number: m.match_number, match_type: m.match_type }))}
          teamsMap={teamsMap}
        />
      )}

      {viewMatch && (
        <MatchModal
          match={viewMatch}
          teamsMap={teamsMap}
          assignments={assignments}
          autoPlayFirstVideo={autoPlayMatchVideo}
          onClose={() => { setViewMatch(null); setAutoPlayMatchVideo(false); }}
          onEdit={() => {
            if (!canCreateMatches) {
              alert('Selecione a divisão ou final da partida antes de editar.');
              return;
            }
            setEditMatch(viewMatch);
            setViewMatch(null);
            setAutoPlayMatchVideo(false);
            setShowForm(true);
          }}
          onDelete={() => handleDelete(viewMatch.id)}
          onStartScouting={handleStartScouting}
        />
      )}
    </div>
  );
}
