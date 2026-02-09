import { Sidebar } from '../components/Sidebar';
import { DashboardContent } from '../components/DashboardContent';
import { BarChart3 } from 'lucide-react';
import { useSidebar } from '../hooks/useSidebar';
import { cn } from '../lib/utils';

export default function DashboardPage() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn(
        'flex-1 pt-20 lg:pt-8 transition-all duration-300',
        isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      )}>
        <div className="max-w-6xl ml-2 mx-auto">
          <div className="flex  items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-orange-500" />
            <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          </div>
          <p className="text-slate-400 mb-8">Visualize estatísticas e evolução do desempenho.</p>
          
          <DashboardContent />
        </div>
      </main>
    </div>
  );
}