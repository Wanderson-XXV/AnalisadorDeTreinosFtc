import { useState } from 'react';
import { Trophy } from 'lucide-react';
import type { Scout } from '../../lib/types';

interface LoginFormProps {
  onLogin: (username: string) => Promise<Scout>;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await onLogin(username.trim());
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Trophy className="w-10 h-10 text-orange-500" />
          <h1 className="text-3xl font-bold text-white">FTC Scout</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6"
        >
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Bem-vindo!</h2>
            <p className="text-slate-400 text-sm">Informe seu nome para começar o scouting.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Nome de usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="ex: maria, joao_scout..."
              maxLength={30}
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={!username.trim() || loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}