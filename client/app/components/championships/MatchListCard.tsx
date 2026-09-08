import { useState } from 'react';
import { ClipboardList, Clock, Play, Trash2, Target, User, Video } from 'lucide-react';
import type { Match, Team, LogoPosition, ScoutingRound, ScoutAssignment } from '../../lib/types';
import { resolveLogoUrl } from '../../lib/api';
import { ScoutingViewModal } from './ScoutingViewModal';
import { TeamProfileModal } from '../TeamProfileModal';
import { getMatchTeamSlots } from '../../lib/matchTeams';
import { formatMatchSchedule } from '../../lib/matchSchedule';

interface MatchListCardProps {
  match: Match;
  teamsMap?: Map<number, Team>;
  assignments?: ScoutAssignment[];
  onView: () => void;
  onDelete?: () => void;
  onVideoView?: () => void;
}

const statusConfig = {
  scheduled: { label: 'Agendada', cls: 'text-slate-300 bg-slate-700' },
  in_progress: { label: 'Em andamento', cls: 'text-yellow-300 bg-yellow-900/30' },
  completed: { label: 'Completa', cls: 'text-emerald-300 bg-emerald-900/30' },
};

function getScoutStatus(round?: ScoutingRound): 'none' | 'active' | 'done' {
  if (!round) return 'none';
  return round.is_locked ? 'active' : 'done';
}

function getTeamHits(round?: ScoutingRound): number | null {
  if (!round?.cycles?.length) return null;
  return round.cycles.reduce((sum, cycle) => sum + cycle.hits, 0);
}

function TeamLogo({ url, position }: { url: string; position?: LogoPosition }) {
  return (
    <span className="inline-block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-700">
      <img src={resolveLogoUrl(url)} alt="" className="h-full w-full" style={{ objectFit: 'cover', objectPosition: position ?? 'center' }} onError={event => { event.currentTarget.parentElement?.remove(); }} />
    </span>
  );
}

const scoutDot = {
  none: { cls: 'bg-slate-600', title: 'Scout pendente' },
  active: { cls: 'bg-yellow-400 animate-pulse', title: 'Scout em andamento' },
  done: { cls: 'bg-emerald-400', title: 'Scout concluído' },
};

interface TeamRowProps {
  number: number;
  name?: string | null;
  team?: Team;
  round?: ScoutingRound;
  assignedUsername?: string;
  onOpen: () => void;
}

function TeamRow({ number, name, team, round, assignedUsername, onOpen }: TeamRowProps) {
  const status = getScoutStatus(round);
  const dot = scoutDot[status];
  const hits = getTeamHits(round);
  const username = round?.scout_username ?? assignedUsername;

  return (
    <button type="button" onClick={event => { event.stopPropagation(); onOpen(); }} className={`team-row-action group/team flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5 ${status === 'done' ? 'bg-emerald-500/5' : status === 'active' ? 'bg-yellow-500/5' : ''}`} title={round ? 'Abrir resultado do scout desta equipe' : 'Abrir perfil desta equipe'}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot.cls}`} title={dot.title} />
      {team?.logo_url && <TeamLogo url={team.logo_url} position={team.logo_position} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white">#{number}</span>
          {name && <span className="truncate text-xs text-slate-400">{name}</span>}
        </div>
        {username && <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><User className="h-2.5 w-2.5" />{username}</span>}
      </div>
      {hits !== null && <span className="inline-flex items-center gap-1 rounded bg-emerald-900/30 px-1.5 py-0.5 text-xs font-bold text-emerald-400"><Target className="h-3 w-3" />{hits}</span>}
      <span className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-slate-300 transition-all group-hover/team:scale-105 group-hover/team:bg-sky-500/15 group-hover/team:text-sky-200">
        {round ? 'Ver resultado' : 'Ver perfil'}
      </span>
    </button>
  );
}

interface AllianceBlockProps {
  color: 'red' | 'blue';
  teams: Omit<TeamRowProps, 'onOpen'>[];
  allianceTotal?: number;
  scoutTotal: number | null;
  onTeamOpen: (team: Omit<TeamRowProps, 'onOpen'>) => void;
}

function AllianceBlock({ color, teams, allianceTotal, scoutTotal, onTeamOpen }: AllianceBlockProps) {
  const red = color === 'red';
  const colorClasses = red ? 'bg-red-950/30 text-red-400' : 'bg-blue-950/30 text-blue-400';
  return (
    <section className={`overflow-hidden rounded-md ${colorClasses.split(' ')[0]}`}>
      <header className="flex items-center justify-between px-2.5 py-1.5">
        <span className={`text-xs font-bold tracking-wider ${colorClasses.split(' ')[1]}`}>{red ? 'VERMELHA' : 'AZUL'}</span>
        <span className="flex items-center gap-2 text-xs">
          {scoutTotal !== null && <span className="font-semibold text-emerald-400">{scoutTotal} pontos scout</span>}
          {allianceTotal !== undefined && <span className="font-bold text-slate-100">{allianceTotal} pts</span>}
        </span>
      </header>
      <div className="space-y-0.5 px-1 pb-1">
        {teams.map(team => <TeamRow key={team.number} {...team} onOpen={() => onTeamOpen(team)} />)}
      </div>
    </section>
  );
}

export function MatchListCard({ match, teamsMap, assignments, onView, onDelete, onVideoView }: MatchListCardProps) {
  const [scoutModal, setScoutModal] = useState<{ sr: ScoutingRound; teamNumber: number; teamName?: string | null; alliance: 'red' | 'blue' } | null>(null);
  const [profileTeam, setProfileTeam] = useState<number | null>(null);
  const status = statusConfig[match.status] ?? statusConfig.scheduled;
  const typeLabel = match.match_type === 'qualification' ? 'Qualificatória' : match.match_type === 'practice' ? 'Treino' : 'Playoff';
  const roundFor = (number: number) => match.scouting_rounds?.find(round => round.team_number === number);
  const assignedFor = (number: number) => assignments?.find(item => item.match_id === match.id && item.team_number === number)?.scout_username;
  type TeamRowData = Omit<TeamRowProps, 'onOpen'>;
  const teamsFor = (alliance: 'red' | 'blue'): TeamRowData[] => getMatchTeamSlots(match, alliance).map(slot => ({ number: slot.number, name: slot.name, team: teamsMap?.get(slot.number), round: roundFor(slot.number), assignedUsername: assignedFor(slot.number) }));
  const redTeams = teamsFor('red');
  const blueTeams = teamsFor('blue');
  const scoutTotalFor = (teams: TeamRowData[]) => {
    const totals = teams.map(team => getTeamHits(team.round));
    return totals.some(total => total !== null) ? totals.reduce<number>((sum, total) => sum + (total ?? 0), 0) : null;
  };
  const schedule = match.scheduled_time ? formatMatchSchedule(match.scheduled_time, match.championship_timezone ?? 'America/Sao_Paulo', match.championship_location) : null;
  const thumbSrc = match.first_video_thumb ? resolveLogoUrl(match.first_video_thumb) : null;
  const [hideThumb, setHideThumb] = useState(false);
  const openTeam = (team: TeamRowData, alliance: 'red' | 'blue') => team.round
    ? setScoutModal({ sr: team.round, teamNumber: team.number, teamName: team.name, alliance })
    : setProfileTeam(team.number);

  return (
    <>
      <article role="button" tabIndex={0} onClick={onView} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onView(); } }} className="match-card cursor-pointer overflow-hidden rounded-lg border border-slate-700/70 bg-slate-800/65 transition-colors hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/60">
        {thumbSrc && <button type="button" onClick={event => { event.stopPropagation(); (onVideoView ?? onView)(); }} className="video-analysis-action group/video relative block h-20 w-full overflow-hidden bg-slate-900 text-left sm:h-24" title="Analisar partida em vídeo">
          {hideThumb ? <div className="h-full w-full bg-slate-900" /> : <img src={thumbSrc} alt="" className="h-full w-full object-cover opacity-75" onError={() => setHideThumb(true)} />}
          <span className="absolute inset-0 bg-slate-950/10 transition-colors group-hover/video:bg-slate-950/35" />
          <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-black/40 transition-transform group-hover/video:scale-110"><Play className="h-5 w-5 fill-current" /></span>
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-slate-100 backdrop-blur-sm transition-all group-hover/video:bg-orange-500 group-hover/video:text-white"><Video className="h-3 w-3" />Analisar partida</span>
        </button>}

        <div className="p-2.5">
          <header className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-base font-bold text-white">{match.display_name}</h3>
                <span className="text-xs text-slate-500">{typeLabel}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
              </div>
              {schedule && <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs"><span className="inline-flex items-center gap-1 font-medium text-slate-300"><Clock className="h-3.5 w-3.5 text-orange-400" />{schedule.date}</span><span title={`Fuso do evento: ${schedule.eventTimeZone}`} className="cursor-help rounded bg-slate-700/80 px-1.5 py-0.5 text-slate-300"><strong className="text-white">{schedule.eventTime}</strong> {schedule.eventLabel}</span>{schedule.brasiliaTime && <span className="rounded bg-sky-950/50 px-1.5 py-0.5 text-sky-200"><strong className="text-sky-100">{schedule.brasiliaTime}</strong> Brasília</span>}</div>}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={event => { event.stopPropagation(); onView(); }} title="Abrir detalhes e scouts da partida" className="match-details-action inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:border-sky-400 hover:bg-sky-500/20 hover:shadow-md active:translate-y-px"><ClipboardList className="h-4 w-4 text-sky-300 transition-transform" /><span className="hidden sm:inline">Detalhes / scout</span></button>
              {onDelete && <button type="button" onClick={event => { event.stopPropagation(); onDelete(); }} title="Excluir partida" className="rounded p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          </header>
          <p className="mt-1 text-[11px] font-medium text-orange-300">Clique no card para abrir partida e scouts</p>

          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <AllianceBlock color="red" teams={redTeams} allianceTotal={match.status === 'completed' ? match.red_total : undefined} scoutTotal={scoutTotalFor(redTeams)} onTeamOpen={team => openTeam(team, 'red')} />
            <AllianceBlock color="blue" teams={blueTeams} allianceTotal={match.status === 'completed' ? match.blue_total : undefined} scoutTotal={scoutTotalFor(blueTeams)} onTeamOpen={team => openTeam(team, 'blue')} />
          </div>
        </div>
      </article>

      {scoutModal && <ScoutingViewModal scoutingRound={scoutModal.sr} teamNumber={scoutModal.teamNumber} teamName={scoutModal.teamName} alliance={scoutModal.alliance} onClose={() => setScoutModal(null)} onViewProfile={() => { setScoutModal(null); setProfileTeam(scoutModal.teamNumber); }} />}
      {profileTeam !== null && <TeamProfileModal teamNumber={profileTeam} onClose={() => setProfileTeam(null)} />}
    </>
  );
}
