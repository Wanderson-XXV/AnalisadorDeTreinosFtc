import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { X, Clock, Edit2, Trash2, Film, Plus, Play, FileText, AlertTriangle, Lightbulb } from 'lucide-react';
import type { Match, ScoutingRound, Team, ScoutAssignment } from '../../lib/types';
import { TeamCardInMatch } from './TeamCardInMatch';
import { ScoutingViewModal } from './ScoutingViewModal';
import { MediaUpload } from './MediaUpload';
import { MediaGallery } from './MediaGallery';
import { useMedia } from '../../hooks/useMedia';
import { resolveMediaUrl } from '../../lib/api';
import { findMatchTeam, getMatchTeamSlots } from '../../lib/matchTeams';
import { formatMatchSchedule } from '../../lib/matchSchedule';

interface MatchModalProps {
  match: Match;
  teamsMap?: Map<number, Team>;
  assignments?: ScoutAssignment[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStartScouting: (teamNumber: number) => void;
  autoPlayFirstVideo?: boolean;
}

function isYoutube(path: string) {
  return path.includes('youtube.com') || path.includes('youtu.be');
}

function getYoutubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : '';
}

export function MatchModal({ match, teamsMap, assignments, onClose, onEdit, onDelete, onStartScouting, autoPlayFirstVideo = false }: MatchModalProps) {
  const navigate = useNavigate();
  const [viewScouting, setViewScouting] = useState<{
    sr: ScoutingRound;
    teamNumber: number;
    teamName?: string | null;
    alliance: 'red' | 'blue';
  } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [didAutoPlayFirstVideo, setDidAutoPlayFirstVideo] = useState(false);

  const { media, uploadMedia, addExternalMedia, deleteMedia, uploadProgress, cancelUpload } = useMedia(match.id);
  const matchVideos = media.filter(m => m.file_type === 'video');
  const handleUpload = async (payload: Parameters<typeof uploadMedia>[0]): Promise<void> => { await uploadMedia(payload); };
  const handleAddExternal = async (payload: Parameters<typeof addExternalMedia>[0]): Promise<void> => { await addExternalMedia(payload); };

  useEffect(() => {
    if (!autoPlayFirstVideo || didAutoPlayFirstVideo || matchVideos.length === 0) return;
    setPlayingVideo(matchVideos[0].id);
    setDidAutoPlayFirstVideo(true);
  }, [autoPlayFirstVideo, didAutoPlayFirstVideo, matchVideos]);

  const typeLabel = match.match_type === 'qualification' ? 'Qualificatória' : match.match_type === 'practice' ? 'Treino' : 'Eliminatória';

  const statusLabel =
    match.status === 'scheduled'
      ? 'Agendada'
      : match.status === 'in_progress'
      ? 'Em andamento'
      : 'Completa';

  const statusColor =
    match.status === 'scheduled'
      ? 'text-slate-400'
      : match.status === 'in_progress'
      ? 'text-yellow-400'
      : 'text-green-400';

  const redTeams = getMatchTeamSlots(match, 'red');
  const blueTeams = getMatchTeamSlots(match, 'blue');
  const schedule = match.scheduled_time
    ? formatMatchSchedule(match.scheduled_time, match.championship_timezone ?? 'America/Sao_Paulo', match.championship_location)
    : null;

  const getScoutingForTeam = (teamNumber: number): ScoutingRound | undefined =>
    match.scouting_rounds?.find(sr => sr.team_number === teamNumber);

  const getAssignedForTeam = (teamNumber: number): string | undefined =>
    assignments?.find(a => a.match_id === match.id && a.team_number === teamNumber)?.scout_username;

  const handleViewScouting = (teamNumber: number, teamName: string | undefined | null, alliance: 'red' | 'blue') => {
    const sr = getScoutingForTeam(teamNumber);
    if (sr) setViewScouting({ sr, teamNumber, teamName, alliance });
  };

  const handleEditScouting = (teamNumber: number) => {
    const sr = getScoutingForTeam(teamNumber);
    if (sr) navigate(`/scouting/${sr.id}`);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-700">
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-xl font-bold text-white">{match.display_name}</h2>
                <span className="text-sm text-slate-500">{typeLabel}</span>
                {schedule && (
                  <span className="flex flex-wrap items-center gap-x-1 text-sm text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span className="font-medium text-slate-200">{schedule.date}</span>
                    <span title={`Fuso do evento: ${schedule.eventTimeZone}`} className="cursor-help rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300"><strong className="text-white">{schedule.eventTime}</strong> {schedule.eventLabel}</span>
                    {schedule.brasiliaTime && <span className="rounded bg-sky-950/50 px-1.5 py-0.5 text-xs text-sky-200"><strong className="text-sky-100">{schedule.brasiliaTime}</strong> Brasília</span>}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">Partida e scouts · <span className={`font-medium ${statusColor}`}>{statusLabel}</span></p>
            </div>
            <div className="flex items-center gap-1 ml-4">
              <button onClick={onEdit} className="p-2 text-slate-400 hover:text-orange-400 hover:bg-slate-700 rounded-lg transition-colors" title="Editar">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors" title="Excluir">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Vídeos da Partida */}
          <div className="px-4 pt-4 pb-3 sm:px-5 border-b border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Vídeos da Partida</h3>
              </div>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Adicionar Mídia
              </button>
            </div>

            {matchVideos.length === 0 ? (
              <button
                onClick={() => setShowUpload(true)}
                className="w-full border-2 border-dashed border-slate-600 hover:border-orange-500 rounded-xl p-6 flex flex-col items-center gap-2 text-slate-500 hover:text-orange-400 transition-colors"
              >
                <Film className="w-8 h-8" />
                <span className="text-sm font-medium">Nenhum vídeo ainda — clique para adicionar</span>
              </button>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {matchVideos.map(v => {
                  const src = resolveMediaUrl(v.file_path);
                  const isYt = isYoutube(v.file_path);
                  const thumbSrc = v.thumbnail_url || (v.thumbnail_path ? resolveMediaUrl(v.thumbnail_path) : isYt
                    ? `https://img.youtube.com/vi/${getYoutubeId(v.file_path)}/mqdefault.jpg`
                    : src);
                  return (
                    <div
                      key={v.id}
                      className="flex-shrink-0 w-48"
                    >
                    <button
                      onClick={() => setPlayingVideo(v.id)}
                      className="relative w-full aspect-video bg-slate-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500 transition-all group"
                    >
                      {isYt ? (
                        <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={src} className="w-full h-full object-cover" preload="metadata" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                        <Play className="w-8 h-8 text-white drop-shadow" />
                      </div>
                      {v.title && (
                        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/70 text-xs text-white truncate">
                          {v.title}
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/match-analysis/${match.id}?video=${encodeURIComponent(v.id)}`)}
                      className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1.5 text-xs font-semibold text-orange-200 transition-colors hover:border-orange-400 hover:bg-orange-500/20 hover:text-white"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Analisar este vídeo
                    </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex-shrink-0 w-32 aspect-video border-2 border-dashed border-slate-600 hover:border-orange-500 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-orange-400 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs">Adicionar</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <p className="mb-3 text-sm text-slate-400">Escolha uma equipe para iniciar, continuar ou consultar o scout dela.</p>
            {/* Alianças */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-3">
                <h3 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Aliança Vermelha
                </h3>
                <div className="space-y-2">
                  {redTeams.map(team => (
                    <TeamCardInMatch
                      key={team.number}
                      teamNumber={team.number}
                      teamName={team.name}
                      alliance="red"
                      scoutingRound={getScoutingForTeam(team.number)}
                      assignedUsername={getAssignedForTeam(team.number)}
                      onStartScouting={() => onStartScouting(team.number)}
                      onViewScouting={() => handleViewScouting(team.number, team.name, 'red')}
                      onEditScouting={() => handleEditScouting(team.number)}
                      logoUrl={teamsMap?.get(team.number)?.logo_url}
                      logoPosition={teamsMap?.get(team.number)?.logo_position}
                    />
                  ))}
                </div>
                {match.status === 'completed' && (
                  <div className="mt-4 pt-3 border-t border-red-800/30 flex justify-between items-center">
                    <span className="text-sm text-slate-400">Total aliança:</span>
                    <span className="text-red-300 font-bold text-xl">{match.red_total} pts</span>
                  </div>
                )}
              </div>

              <div className="bg-blue-900/10 border border-blue-800/30 rounded-lg p-3">
                <h3 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Aliança Azul
                </h3>
                <div className="space-y-2">
                  {blueTeams.map(team => (
                    <TeamCardInMatch
                      key={team.number}
                      teamNumber={team.number}
                      teamName={team.name}
                      alliance="blue"
                      scoutingRound={getScoutingForTeam(team.number)}
                      assignedUsername={getAssignedForTeam(team.number)}
                      onStartScouting={() => onStartScouting(team.number)}
                      onViewScouting={() => handleViewScouting(team.number, team.name, 'blue')}
                      onEditScouting={() => handleEditScouting(team.number)}
                      logoUrl={teamsMap?.get(team.number)?.logo_url}
                      logoPosition={teamsMap?.get(team.number)?.logo_position}
                    />
                  ))}
                </div>
                {match.status === 'completed' && (
                  <div className="mt-4 pt-3 border-t border-blue-800/30 flex justify-between items-center">
                    <span className="text-sm text-slate-400">Total aliança:</span>
                    <span className="text-blue-300 font-bold text-xl">{match.blue_total} pts</span>
                  </div>
                )}
              </div>
            </div>

            {match.status === 'completed' && (
              <div className="mt-4 p-3 bg-slate-700/40 border border-slate-600 rounded-xl text-center">
                {match.red_total > match.blue_total ? (
                  <p className="text-red-300 font-bold">🏆 Aliança Vermelha venceu ({match.red_total} × {match.blue_total})</p>
                ) : match.blue_total > match.red_total ? (
                  <p className="text-blue-300 font-bold">🏆 Aliança Azul venceu ({match.blue_total} × {match.red_total})</p>
                ) : (
                  <p className="text-slate-300 font-bold">Empate ({match.red_total} × {match.blue_total})</p>
                )}
              </div>
            )}

            {match.scouting_rounds && match.scouting_rounds.some(r => r.observations || r.robot_issues || r.strategy_notes) && (
              <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Notas de Scouting</h3>
                {match.scouting_rounds.filter(r => r.observations || r.robot_issues || r.strategy_notes).map(r => {
                  const slot = findMatchTeam(match, r.team_number);
                  const isRed = slot?.alliance === 'red';
                  const teamName = slot?.name;
                  const borderCls = isRed ? 'border-red-800/40 bg-red-900/10' : 'border-blue-800/40 bg-blue-900/10';
                  const labelCls  = isRed ? 'text-red-400' : 'text-blue-400';
                  return (
                    <div key={r.id} className={`border rounded-xl p-4 space-y-3 ${borderCls}`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${labelCls}`}>#{r.team_number}</span>
                        {teamName && <span className="text-xs text-slate-400">{teamName}</span>}
                        {r.scout_username && (
                          <span className="ml-auto text-xs text-slate-500">{r.scout_username}</span>
                        )}
                      </div>
                      {r.observations && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Observações</span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{r.observations}</p>
                        </div>
                      )}
                      {r.robot_issues && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-[11px] font-semibold text-yellow-600 uppercase tracking-wider">Problemas do Robô</span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{r.robot_issues}</p>
                        </div>
                      )}
                      {r.strategy_notes && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Lightbulb className="w-3.5 h-3.5 text-orange-400" />
                            <span className="text-[11px] font-semibold text-orange-500 uppercase tracking-wider">Notas de Estratégia</span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{r.strategy_notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {match.notes && (
              <div className="mt-4 p-4 bg-slate-700/30 border border-slate-600 rounded-xl">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notas</h4>
                <p className="text-sm text-slate-300">{match.notes}</p>
              </div>
            )}

            {/* Galeria de Mídia */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Galeria da Partida</h3>
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar Mídia
                </button>
              </div>
              <MediaGallery media={media} onDelete={deleteMedia} canDelete />
            </div>
          </div>
        </div>
      </div>

      {viewScouting && (
        <ScoutingViewModal
          scoutingRound={viewScouting.sr}
          teamNumber={viewScouting.teamNumber}
          teamName={viewScouting.teamName}
          alliance={viewScouting.alliance}
          onClose={() => setViewScouting(null)}
        />
      )}

      {showUpload && (
        <MediaUpload
          match={match}
          onUpload={handleUpload}
          onAddExternal={handleAddExternal}
          uploadProgress={uploadProgress}
          onCancel={cancelUpload}
          onClose={() => setShowUpload(false)}
        />
      )}

      {playingVideo && (() => {
        const v = matchVideos.find(vid => vid.id === playingVideo);
        if (!v) return null;
        const src = resolveMediaUrl(v.file_path);
        const isYt = isYoutube(v.file_path);
        return (
          <div
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
            onClick={() => setPlayingVideo(null)}
          >
            <button
              onClick={() => setPlayingVideo(null)}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
              {isYt ? (
                <iframe
                  src={`https://www.youtube.com/embed/${getYoutubeId(v.file_path)}?autoplay=1`}
                  className="w-full aspect-video rounded-lg"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video src={src} controls autoPlay className="w-full rounded-lg" />
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
