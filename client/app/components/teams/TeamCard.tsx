import { Pencil, Trash2, Instagram, Hash } from 'lucide-react';
import { Link } from 'react-router';
import type { Team } from '../../lib/types';
import { resolveLogoUrl } from '../../lib/api';
import { buildTeamProfilePath } from '../../lib/teamProfilePath';

interface TeamCardProps {
  team: Team;
  onEdit: () => void;
  onDelete: () => void;
}

export function TeamCard({ team, onEdit, onDelete }: TeamCardProps) {
  return (
    <div className="relative bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
      <Link
        to={buildTeamProfilePath(team.team_number)}
        aria-label={`Abrir perfil da equipe ${team.team_number}`}
        title="Abrir perfil"
        className="absolute inset-0 z-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:ring-offset-2 focus:ring-offset-slate-950"
      />
      <div className="flex items-center gap-4">
        {team.logo_url ? (
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700">
            <img
              src={resolveLogoUrl(team.logo_url)}
              alt={team.team_name}
              className="w-full h-full"
              style={{
                objectFit: 'contain',
                objectPosition: team.logo_position ?? 'center',
              }}
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
            <Hash className="w-5 h-5 text-slate-500" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-lg font-bold text-orange-400">#{team.team_number}</span>
            <span className="text-white font-medium truncate">{team.team_name}</span>
          </div>
          {team.instagram && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Instagram className="w-3 h-3" />
              <span>{team.instagram}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} title="Editar" className="relative z-20 p-2 text-slate-400 hover:text-orange-400 hover:bg-slate-700 rounded-lg transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Excluir" className="relative z-20 p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
