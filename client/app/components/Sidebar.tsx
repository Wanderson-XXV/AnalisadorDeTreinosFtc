import { NavLink, useNavigate } from 'react-router';
import { Timer, BarChart3, History, Trophy, Users, Zap, Menu, X, ChevronLeft, Volume2, VolumeX, ClipboardList, UserCheck, LogOut, GitCompareArrows, Layers3, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSidebar } from '../hooks/useSidebar';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { useAuth } from '../hooks/useAuth';
import { ChampionshipSelector } from './championships/ChampionshipSelector';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { formatShortcutCode } from '../lib/keyboardShortcuts';

const navItems = [
  { to: '/', label: 'Novo Round', icon: Timer },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/history', label: 'Histórico', icon: History },
];

navItems.push({ to: '/settings', label: 'Configurações', icon: Settings });

const competitionItems = [
  { to: '/championships', label: 'Partidas', icon: Trophy },
  { to: '/analysis', label: 'Comparar', icon: GitCompareArrows },
  { to: '/scout-management', label: 'Scouts', icon: ClipboardList },
  { to: '/teams', label: 'Equipes', icon: Users },
  { to: '/championship-management', label: 'Campeonatos', icon: Layers3 },
];

const adminItems = [
  { to: '/users', label: 'Usuários', icon: UserCheck },
];

export function Sidebar() {
  const { isOpen, isCollapsed, setIsOpen, toggleCollapse } = useSidebar();
  const { soundEnabled, toggleSound } = useSoundSettings();
  const { scout, logout } = useAuth();
  const keyboardShortcuts = useKeyboardShortcuts();
  const navigate = useNavigate();

  const visibleCompetitionItems = competitionItems;

  const handleSwitchUser = () => {
    logout();
    navigate('/');
    setIsOpen(false);
  };
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-gradient-to-b from-slate-800 to-slate-900 border-r border-slate-700 shadow-xl z-50 transition-all duration-300 flex flex-col',
          isCollapsed ? 'w-20' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex-1 overflow-y-auto p-6 pb-0">
          <div className="flex items-center justify-between mb-8">
            <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center w-full')}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {scout ? scout.username.charAt(0).toUpperCase() : <Zap className="w-5 h-5" />}
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="text-base font-semibold text-white leading-tight">{scout?.username ?? 'FTC Timer'}</h1>
                  <p className="text-xs text-slate-400">Cycle Tracker</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:block p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex w-full justify-center p-2 mb-4 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="mb-4">
            <ChampionshipSelector collapsed={isCollapsed} />
          </div>

          <nav className="space-y-2">
            {!isCollapsed && <p className="text-xs text-slate-500 uppercase tracking-wider px-4 mb-2">Treinos</p>}
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/20 to-blue-500/20 text-orange-400 border border-orange-500/30'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white',
                      isCollapsed && 'justify-center'
                    )
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                </NavLink>
              );
            })}

            <div className="pt-4 mt-4 border-t border-slate-700">
              {!isCollapsed && <p className="text-xs text-slate-500 uppercase tracking-wider px-4 mb-2">Competições</p>}
              {visibleCompetitionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                        isActive
                          ? 'bg-gradient-to-r from-orange-500/20 to-blue-500/20 text-orange-400 border border-orange-500/30'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white',
                        isCollapsed && 'justify-center'
                      )
                    }
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5" />
                    {!isCollapsed && <span className="font-medium">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>

            {scout?.username.toLowerCase() === 'wanderson' && (
              <div className="pt-4 mt-4 border-t border-slate-700">
                {!isCollapsed && <p className="text-xs text-slate-500 uppercase tracking-wider px-4 mb-2">Admin</p>}
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm',
                          isActive
                            ? 'bg-gradient-to-r from-orange-500/20 to-blue-500/20 text-orange-400 border border-orange-500/30'
                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white',
                          isCollapsed && 'justify-center'
                        )
                      }
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      {!isCollapsed && <span className="font-medium">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-700 space-y-3">
          {!isCollapsed && (
            <>
              <button
                onClick={toggleSound}
                className="w-full flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 transition-colors"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-slate-300">Sons Ativados</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-400">Sons Desativados</span>
                  </>
                )}
              </button>

              <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400">Dica: Pressione</p>
                <p className="text-sm font-mono text-orange-400">{formatShortcutCode(keyboardShortcuts.mark_cycle).toUpperCase()}</p>
                <p className="text-xs text-slate-400">para marcar ciclo</p>
              </div>
            </>
          )}

          <button
            onClick={handleSwitchUser}
            title="Trocar usuário"
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/40 transition-colors text-xs',
              isCollapsed && 'justify-center'
            )}
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {!isCollapsed && <span>Trocar usuário</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
