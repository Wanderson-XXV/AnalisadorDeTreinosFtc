import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, KeyRound, RefreshCw, Search, UserRound, Zap } from 'lucide-react';
import type { Scout } from '../../lib/types';
import { API_BASE } from '../../lib/api';

interface LoginFormProps {
  onLogin: (username: string, password?: string) => Promise<Scout>;
}

const RECENT_USERS_KEY = 'ftc_recent_scout_users';

function initials(username: string) {
  return username
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function readRecentUsers(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecentUser(username: string) {
  const next = [username, ...readRecentUsers().filter(item => item !== username)].slice(0, 4);
  localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(next));
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [users, setUsers] = useState<Scout[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [recentUsers, setRecentUsers] = useState<string[]>(() => readRecentUsers());
  const [selectedUser, setSelectedUser] = useState<Scout | null>(null);
  const [password, setPassword] = useState('');

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE}/scouts.php`);
      if (!response.ok) throw new Error('API indisponivel');
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setLoadError('Nao foi possivel carregar os perfis. Confirme se a API esta rodando.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const recentMatches = useMemo(() => {
    const byName = new Map(users.map(user => [user.username, user]));
    return recentUsers.map(username => byName.get(username)).filter(Boolean) as Scout[];
  }, [recentUsers, users]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(user => user.username.toLowerCase().includes(needle));
  }, [query, users]);

  const visibleUsers = useMemo(() => {
    const recentNames = new Set(recentMatches.map(user => user.username));
    return filteredUsers.filter(user => !recentNames.has(user.username));
  }, [filteredUsers, recentMatches]);

  const handleSelect = async (user: Scout) => {
    if (user.password_configured && selectedUser?.id !== user.id) {
      setSelectedUser(user);
      setPassword('');
      setLoginError(null);
      return;
    }
    const username = user.username;
    setLoggingIn(username);
    setLoginError(null);
    try {
      await onLogin(username, password || undefined);
      saveRecentUser(username);
      setRecentUsers(readRecentUsers());
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao entrar');
      setLoggingIn(null);
    }
  };

  const renderUserButton = (user: Scout, compact = false) => (
    <button
      key={user.id}
      onClick={() => void handleSelect(user)}
      disabled={loggingIn !== null}
      className={`w-full flex items-center gap-3 rounded-xl border text-left transition-all disabled:cursor-wait ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3'
      } ${
        loggingIn === user.username
          ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
          : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500 text-white'
      }`}
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
        {initials(user.username) || <UserRound className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{user.username}</span>
        {user.last_active && (
          <span className="block text-xs text-slate-400">
            Usou recentemente
          </span>
        )}
      </div>
      {loggingIn === user.username && (
        <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2 rounded-lg ftc-gradient">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FTC Scout</h1>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Quem esta usando?</h2>
              <p className="text-slate-400 text-sm">Escolha seu perfil para entrar no sistema.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={loadingUsers}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar perfil..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500"
            />
          </div>

          {loadingUsers && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {loadError && (
            <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800/40 rounded-xl text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p>{loadError}</p>
                <p className="mt-1 text-xs text-red-200/70">Endpoint atual: {API_BASE}/scouts.php</p>
              </div>
            </div>
          )}

          {!loadingUsers && !loadError && users.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">Nenhum perfil cadastrado.</p>
              <p className="text-slate-500 text-xs mt-1">Cadastre os scouts na aba Usuarios.</p>
            </div>
          )}

          {!loadingUsers && !loadError && users.length > 0 && (
            <div className="space-y-5">
              {recentMatches.length > 0 && !query.trim() && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Recentes</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recentMatches.map(user => renderUserButton(user, true))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {query.trim() ? 'Resultados' : 'Todos os perfis'}
                </p>
                {visibleUsers.length === 0 ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 text-center text-sm text-slate-500">
                    Nenhum perfil encontrado.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {visibleUsers.map(user => renderUserButton(user))}
                  </div>
                )}
              </div>
            </div>
          )}

          {loginError && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-red-900/20 border border-red-800/40 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {loginError}
            </div>
          )}

          {selectedUser && (
            <form onSubmit={event => { event.preventDefault(); void handleSelect(selectedUser); }} className="mt-4 rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-100"><KeyRound className="h-4 w-4" /> Senha de {selectedUser.username}</div>
              <input autoFocus type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite a senha" className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400" />
              <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setSelectedUser(null)} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">Cancelar</button><button type="submit" disabled={!password || loggingIn !== null} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">Entrar</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
