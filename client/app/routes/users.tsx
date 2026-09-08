import { useState } from 'react';
import { Users, Plus, Trash2, UserCheck, AlertCircle, Download } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { AdminOnly } from '../components/auth/AdminOnly';
import { useSidebar } from '../hooks/useSidebar';
import { useUsers } from '../hooks/useUsers';
import { cn } from '../lib/utils';
import type { Scout } from '../lib/types';

export default function UsersPage() {
  const { isCollapsed } = useSidebar();
  const { users, loading, error, createUser, deleteUser } = useUsers();
  const [newUsername, setNewUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleCreate = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const name = newUsername.trim();
    if (!name) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createUser(name);
      setNewUsername('');
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: Scout) => {
    if (!confirm(`Remover usuário "${user.username}"? Ele não conseguirá mais fazer login.`)) return;
    try {
      await deleteUser(user.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExport = () => {
    const header = 'id,username,last_active';
    const rows = users.map(u =>
      `${u.id},"${u.username}",${u.last_active ?? ''}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminOnly>
    <div className="min-h-screen flex">
      <Sidebar />
      <main
        className={cn(
          'flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden',
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-orange-500" />
              <h2 className="text-3xl font-bold text-white">Usuários</h2>
            </div>
            {users.length > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            )}
          </div>
          <p className="text-slate-400 mb-6">Gerencie quem pode fazer login no sistema.</p>

          <form onSubmit={handleCreate} className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-slate-300 mb-3">Adicionar usuário</p>
            <div className="flex gap-2">
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Nome do usuário..."
                maxLength={30}
                autoFocus
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 text-sm"
              />
              <button
                type="submit"
                disabled={!newUsername.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
            {saveError && (
              <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {saveError}
              </div>
            )}
          </form>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-800/40 rounded-xl mb-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16">
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Carregando...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Nenhum usuário cadastrado ainda.</p>
              <p className="text-slate-500 text-sm mt-1">Adicione o primeiro acima.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{user.username}</p>
                    {user.last_active && (
                      <p className="text-xs text-slate-500">
                        Último acesso: {new Date(user.last_active).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(user)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
    </AdminOnly>
  );
}
