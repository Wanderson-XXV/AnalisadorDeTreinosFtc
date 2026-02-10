import { Sidebar } from '../components/Sidebar';
import { HistoryContent } from '../components/HistoryContent';
import { History } from 'lucide-react';
import { useSidebar } from '../hooks/useSidebar';
import { cn } from '../lib/utils';

export default function HistoryPage() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn(
        'flex-1 p-8 pt-20 lg:pt-8 transition-all duration-300',
        isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      )}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <History className="w-8 h-8 text-orange-500" />
            <h2 className="text-3xl font-bold text-white">Histórico</h2>
          </div>
          <p className="text-slate-400 mb-8">Visualize e analise todos os rounds anteriores.</p>
          
          <HistoryContent />
        </div>
      </main>
    </div>
  );
}