import { useParams } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { useSidebar } from '../hooks/useSidebar';
import { ChampionshipTimer } from '../components/championships/ChampionshipTimer';
import { cn } from '../lib/utils';

export default function ScoutingPage() {
  const { id } = useParams<{ id: string }>();
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main
        className={cn(
          'flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden',
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        <div className="max-w-7xl mx-auto">
          <ChampionshipTimer scoutingRoundId={id!} />
        </div>
      </main>
    </div>
  );
}
