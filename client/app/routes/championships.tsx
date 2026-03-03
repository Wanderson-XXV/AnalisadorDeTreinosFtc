import { useState } from 'react';
import { Trophy, Plus, Search } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useSidebar } from '../hooks/useSidebar';
import { useMatches } from '../hooks/useMatches';
import { MatchForm } from '../components/championships/MatchForm';
import { MatchListCard } from '../components/championships/MatchListCard';
import { cn } from '../lib/utils';
import type { Match } from '../lib/types';

export default function ChampionshipsPage() {
  const { isCollapsed } = useSidebar();
  const { matches, loading, error, createMatch, updateMatch, deleteMatch } = useMatches();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);

  const filtered = matches.filter(m => {
    if (!

search) return true;
    const s = search.toLowerCase();
    return (
      m.display_name.toLowerCase().includes(s) ||
      String(m.red_team1_number).includes(s) ||
      String(m.red_team2_number).includes(s) ||
      String(m.blue_team1_number).includes(s) ||
      String(m.blue_team2_number).includes(s) ||
      (m.red_team1_name ?? '').toLowerCase().includes(s) ||
      (m.red_team2_name ?? '').toLowerCase().includes(s) ||
      (m.blue_team1_name ?? '').toLowerCase().includes(s) ||
      (m.blue_team2_name ?? '').toLowerCase().includes(s)
    );
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta partida?')) return;
    try { await deleteMatch(id); } catch (e: any) { alert(e.message); }
  };

  const handleSave = async (data: any) => {
    if (editMatch) {
      await updateMatch({ ...data, id: editMatch.id });
    } else {
      await createMatch(data);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn(


        'flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden',
        isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      )}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Trophy className="w-8 h-8 text-orange-500" />
                <h2 className="text-3xl font-bold text-white">Campeonatos</h2>
              </div>
              <p className="text-slate-400">Gerencie as partidas do campeonato.</p>
            </div>
            <button
              onClick={() => { setEditMatch(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Partida
            </button>
          </div>

          <div className="relative mb-4">


            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por equipe ou número..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
            />
          </div>

          {loading && (
            <div className="text-center py-16 text-slate-400">Carregando partidas...</div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-400 mb-4">{error}</div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-20">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">{search ? 'Nenhuma partida encontrada.' : 'Nenhuma partida cadastrada. Crie a primeira!'}</p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map(match => (
              <MatchListCard
                key={match.id}
                match={match}
                onView={() => {}}
                onEdit={() => { setEditMatch(match); setShowForm(true); }}
                onDelete={() => handleDelete(match.id)}
              />
            ))}
          </div>
        </div>
      </main>

      {showForm && (
        <MatchForm
          match={editMatch}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditMatch(null); }}
        />
      )}
    </div>
  );
}