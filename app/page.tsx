import { Sidebar } from "@/components/sidebar";
import { RoundTimer } from "@/components/round-timer";

export default function HomePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Novo Round</h1>
            <p className="text-slate-400">
              Inicie um novo round de 2 minutos e registre os ciclos do robô
            </p>
          </div>
          <RoundTimer />
        </div>
      </main>
    </div>
  );
}
