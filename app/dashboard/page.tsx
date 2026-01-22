"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { DashboardContent } from "@/components/dashboard-content";
import { Calendar, ChevronDown } from "lucide-react";

type DateRange = "today" | "7days" | "30days" | "year" | "all" | "custom";

const dateRangeOptions = [
  { value: "all", label: "Todos os dados" },
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Últimos 7 dias" },
  { value: "30days", label: "Últimos 30 dias" },
  { value: "year", label: "Último ano" },
  { value: "custom", label: "Personalizado" },
];

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = dateRangeOptions.find(opt => opt.value === dateRange)?.label || "Todos os dados";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold text-white">Dashboard</h1>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="flex items-center gap-3 bg-slate-800/70 backdrop-blur rounded-xl px-4 py-2.5 border border-slate-600/50 hover:border-orange-400/50 transition-all min-w-[200px] group"
                >
                  <Calendar className="w-4 h-4 text-orange-400" />
                  <span className="text-white text-sm flex-1 text-left">{selectedLabel}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full mt-2 right-0 bg-slate-800/95 backdrop-blur-xl rounded-xl border border-slate-600/50 shadow-2xl overflow-hidden z-20 min-w-[200px]">
                      {dateRangeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setDateRange(option.value as DateRange);
                            setIsOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm transition-all ${
                            dateRange === option.value
                              ? 'bg-orange-500/20 text-orange-400 font-medium'
                              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {dateRange === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-400 transition-colors"
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          <DashboardContent
            dateRange={dateRange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
          />
        </div>
      </main>
    </div>
  );
}