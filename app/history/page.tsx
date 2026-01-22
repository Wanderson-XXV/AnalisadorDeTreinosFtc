import { Sidebar } from "@/components/sidebar";
import { HistoryContent } from "@/components/history-content";

export default function HistoryPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Histórico</h1>
            <p className="text-slate-400">
              Visualize todos os rounds registrados
            </p>
          </div>
          <HistoryContent />
        </div>
      </main>
    </div>
  );
}
