import type { Team } from '../../lib/types';
import { TeamCard } from './TeamCard';
import { Users } from 'lucide-react';

interface TeamsListProps {
  teams: Team[];
  search: string;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
}

export function TeamsList({ teams, search, onEdit, onDelete }: TeamsListProps) {
  const filtered = teams.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      String(t.team_number).includes(s) ||
      t.team_name.toLowerCase().includes(s) ||
      (t.instagram ?? '').toLowerCase().includes(s)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20">
        <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">
          {search ? 'Nenhuma equipe encontrada.' : 'Nenhuma equipe cadastrada. Adicione a primeira!'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map(team => (
        <TeamCard
          key={team.id}
          team={team}
          onEdit={() => onEdit(team)}
          onDelete={() => onDelete(team)}
        />
      ))}
    </div>
  );
}