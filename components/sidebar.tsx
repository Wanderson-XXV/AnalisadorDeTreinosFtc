"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer, BarChart3, History, Settings, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Novo Round", icon: Timer },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/history", label: "Histórico", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-slate-800 to-slate-900 border-r border-slate-700 shadow-xl z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg ftc-gradient">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">FTC Timer</h1>
            <p className="text-xs text-slate-400">Cycle Tracker</p>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems?.map((item) => {
            const Icon = item?.icon;
            const isActive = pathname === item?.href;
            return (
              <Link
                key={item?.href}
                href={item?.href ?? "/"}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-orange-500/20 to-blue-500/20 text-orange-400 border border-orange-500/30"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                )}
              >
                {Icon && <Icon className="w-5 h-5" />}
                <span className="font-medium">{item?.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-400">Dica: Pressione</p>
          <p className="text-sm font-mono text-orange-400">ESPAÇO</p>
          <p className="text-xs text-slate-400">para marcar ciclo</p>
        </div>
      </div>
    </aside>
  );
}
