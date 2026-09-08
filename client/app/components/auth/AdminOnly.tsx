import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Sidebar } from '../Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useSidebar } from '../../hooks/useSidebar';
import { isAdminScout } from '../../lib/adminAccess';
import { cn } from '../../lib/utils';

interface AdminOnlyProps {
  children: React.ReactNode;
}

export function AdminOnly({ children }: AdminOnlyProps) {
  const { scout } = useAuth();
  const { isCollapsed } = useSidebar();

  if (isAdminScout(scout)) return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main
        className={cn(
          'flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden',
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64',
        )}
      >
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-800 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Area administrativa</h1>
          <p className="mt-2 text-sm text-slate-400">
            Este perfil nao tem permissao para acessar configuracoes, cadastros ou importacoes.
          </p>
          <Link
            to="/championships"
            className="mt-5 inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            Voltar para partidas
          </Link>
        </div>
      </main>
    </div>
  );
}
