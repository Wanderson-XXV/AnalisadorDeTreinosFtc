import { NavLink } from 'react-router';
import { Timer, BarChart3, History, Trophy, Zap, Menu, X, ChevronLeft, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSidebar } from '../hooks/useSidebar';
import { useSoundSettings } from '../hooks/useSoundSettings';
const navItems = [
  { to: '/', label: 'Novo Round', icon: Timer },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/history', label: 'Histórico', icon: History },
];

const comingSoonItems = [
  { to: '/championships', label: 'Campeonatos', icon: Trophy },
];

export function Sidebar() {
  const { isOpen, isCollapsed, setIsOpen, toggleCollapse } = useSidebar();
  const { soundEnabled, toggleSound } = useSoundSettings();
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
          'fixed left-0 top-0 h-full bg-gradient-to-b from-slate-800 to-slate-900 border-r border-slate-700 shadow-xl z-50 transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center w-full')}>
              <div className="p-2 rounded-lg ftc-gradient">
                <Zap className="w-6 h-6 text-white" />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="text-xl font-bold text-white">FTC Timer</h1>
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
              {comingSoonItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-slate-700/30 hover:text-slate-400 transition-all duration-200',
                      isCollapsed && 'justify-center'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5" />
                    {!isCollapsed && (
                      <>
                        <span className="font-medium">{item.label}</span>
                        <span className="ml-auto text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                          Em breve
                        </span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>

        {!isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
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
              <p className="text-sm font-mono text-orange-400">ESPAÇO</p>
              <p className="text-xs text-slate-400">para marcar ciclo</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}