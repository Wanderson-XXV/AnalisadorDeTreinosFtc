import { API_BASE } from '../config';

export { API_BASE };

export function resolveLogoUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  return `${API_BASE}/${url}`;
}

export function resolveMediaUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}/${path}`;
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || 'Erro na requisição');
  }
  
  return response.json();
}
