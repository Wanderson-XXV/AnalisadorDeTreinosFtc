// Configuração da API
// A URL muda automaticamente baseado no ambiente

// PRODUÇÃO (hospedagem)
//export const API_BASE = '/techfenixscoutapp/api';
//export const API_BASE = 'http://localhost:8000';

// PRODUÇÃO (hospedagem) - descomente para build de produção
export const API_BASE = '/techfenixscoutapp/api';

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
