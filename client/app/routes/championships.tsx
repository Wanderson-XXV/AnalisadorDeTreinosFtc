// Página Campeonatos - Em breve
import { Sidebar } from '../components/Sidebar';
import { Trophy, Clock } from 'lucide-react';

export default function ChampionshipsPage() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-orange-500" />
            <h2 className="text-3xl font-bold text-white">Campeonatos</h2>
          </div>
          <p className="text-slate-400 mb-8">Análise de competições e desempenho de equipes.</p>

          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-orange-500/20 to-blue-500/20 flex items-center justify-center">
                <Clock className="w-10 h-10 text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Em Breve</h3>
              <p className="text-slate-400 mb-6">
                Estamos trabalhando nesta funcionalidade! Em breve você poderá:
              </p>
              <ul className="text-left text-slate-300 space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Analisar partidas de campeonatos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Comparar desempenho entre equipes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Contabilizar pontuações automaticamente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span>Acompanhar rankings e estatísticas</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
