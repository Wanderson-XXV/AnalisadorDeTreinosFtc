// Funções utilitárias

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  const secs = (ms / 1000).toFixed(2);
  return `${secs}s`;
}

export function formatTime(ms: number): string {
  const secs = (ms / 1000).toFixed(2);
  return `${secs}s`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${weekday}, ${day}/${month}`;
}

export function getTimeInterval(timestamp: number): string {
  if (timestamp < 30000) return "0-30s";
  if (timestamp < 60000) return "30-60s";
  if (timestamp < 90000) return "60-90s";
  return "90-120s";
}

export function getDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}
