import { Sidebar } from '../components/Sidebar';
import { RoundTimer } from '../components/RoundTimer';
import { Timer } from 'lucide-react';
import { useSidebar } from '../hooks/useSidebar';
import { cn } from '../lib/utils';

export default function HomePage() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn(
        'flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden',
        isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      )}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Timer className="w-8 h-8 text-orange-500" />
            <h2 className="text-3xl font-bold text-white">Novo Round</h2>
          </div>
          <p className="text-slate-400 mb-8">Inicie um novo round de treino e registre seus ciclos de pontuação.</p>
          
          <RoundTimer />
        </div>
      </main>
    </div>
  );
}