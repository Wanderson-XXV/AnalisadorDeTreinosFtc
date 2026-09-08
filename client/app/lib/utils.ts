// Funções utilitárias

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getCycleTimeInterval } from "./matchTiming";

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
  return getCycleTimeInterval(timestamp);
}

export function getDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}
