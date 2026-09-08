import { useState, useEffect, useCallback, useRef } from 'react';
import type { MatchMedia, MediaCategory } from '../lib/types';
import { API_BASE } from '../lib/api';

export interface UploadMediaPayload {
  file: File;
  thumbnail?: Blob;
  match_id: string;
  category: MediaCategory;
  title?: string;
  description?: string;
  tagged_teams?: number[];
  uploaded_by?: string;
}

export interface AddExternalMediaPayload {
  match_id: string;
  url: string;
  category?: MediaCategory;
  title?: string;
  description?: string;
  tagged_teams?: number[];
  uploaded_by?: string;
  video_match_start_ms?: number;
}

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_RETRIES = 3;

function parseMatchMedia(item: any): MatchMedia {
  return {
    ...item,
    tagged_teams: Array.isArray(item.tagged_teams)
      ? item.tagged_teams
      : item.tagged_teams
        ? JSON.parse(item.tagged_teams)
        : [],
  };
}

async function fetchWithRetry(url: string, opts: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts);
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Falha na conexão após múltiplas tentativas.');
}

export function useMedia(matchId: string | null) {
  const [media, setMedia] = useState<MatchMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/media.php?match_id=${matchId}`);
      if (!res.ok) throw new Error('Erro ao carregar mídias');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setMedia(list.map(parseMatchMedia));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  const uploadDirect = useCallback(async (payload: UploadMediaPayload): Promise<MatchMedia> => {
    const fd = new FormData();
    fd.append('file', payload.file);
    fd.append('match_id', payload.match_id);
    fd.append('category', payload.category);
    if (payload.title) fd.append('title', payload.title);
    if (payload.description) fd.append('description', payload.description);
    if (payload.tagged_teams?.length) fd.append('tagged_teams', JSON.stringify(payload.tagged_teams));
    if (payload.uploaded_by) fd.append('uploaded_by', payload.uploaded_by);
    if (payload.thumbnail) fd.append('thumbnail', payload.thumbnail, 'thumbnail.jpg');

    const res = await fetchWithRetry(`${API_BASE}/media.php`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro no upload' }));
      throw new Error(err.error || 'Erro no upload');
    }
    return await res.json();
  }, []);

  const uploadChunked = useCallback(async (payload: UploadMediaPayload): Promise<MatchMedia> => {
    const file = payload.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const initFd = new FormData();
    initFd.append('action', 'init');
    initFd.append('match_id', payload.match_id);
    initFd.append('filename', file.name);
    initFd.append('mime_type', file.type);
    initFd.append('total_chunks', String(totalChunks));
    initFd.append('category', payload.category);
    if (payload.title) initFd.append('title', payload.title);
    if (payload.description) initFd.append('description', payload.description);
    if (payload.tagged_teams?.length) initFd.append('tagged_teams', JSON.stringify(payload.tagged_teams));
    if (payload.uploaded_by) initFd.append('uploaded_by', payload.uploaded_by);

    const initRes = await fetchWithRetry(`${API_BASE}/media-chunk.php`, { method: 'POST', body: initFd });
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({ error: 'Erro ao iniciar upload' }));
      throw new Error(err.error || 'Erro ao iniciar upload');
    }
    const { upload_id } = await initRes.json();

    for (let i = 0; i < totalChunks; i++) {
      if (abortRef.current?.signal.aborted) throw new Error('Upload cancelado.');

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      const chunkFd = new FormData();
      chunkFd.append('action', 'chunk');
      chunkFd.append('upload_id', upload_id);
      chunkFd.append('chunk_index', String(i));
      chunkFd.append('chunk', blob, `chunk_${i}`);

      const chunkRes = await fetchWithRetry(`${API_BASE}/media-chunk.php`, { method: 'POST', body: chunkFd });
      if (!chunkRes.ok) {
        const err = await chunkRes.json().catch(() => ({ error: `Erro no chunk ${i}` }));
        throw new Error(err.error || `Erro no chunk ${i}`);
      }

      setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    const completeFd = new FormData();
    completeFd.append('action', 'complete');
    completeFd.append('upload_id', upload_id);
    if (payload.thumbnail) completeFd.append('thumbnail', payload.thumbnail, 'thumbnail.jpg');

    const completeRes = await fetchWithRetry(`${API_BASE}/media-chunk.php`, { method: 'POST', body: completeFd });
    if (!completeRes.ok) {
      const err = await completeRes.json().catch(() => ({ error: 'Erro ao finalizar upload' }));
      throw new Error(err.error || 'Erro ao finalizar upload');
    }
    return await completeRes.json();
  }, []);

  const uploadMedia = useCallback(async (payload: UploadMediaPayload) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const useChunked = payload.file.size > CHUNK_SIZE;
      const created: any = useChunked
        ? await uploadChunked(payload)
        : await uploadDirect(payload);

      const item: MatchMedia = parseMatchMedia(created);
      setMedia(prev => [item, ...prev]);
      setUploadProgress(100);
      return item;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }, [uploadDirect, uploadChunked]);

  const addExternalMedia = useCallback(async (payload: AddExternalMediaPayload) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const res = await fetchWithRetry(`${API_BASE}/media.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          category: payload.category ?? 'full_match',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao salvar link' }));
        throw new Error(err.error || 'Erro ao salvar link');
      }
      const item = parseMatchMedia(await res.json());
      setMedia(prev => [item, ...prev.filter(m => m.id !== item.id)]);
      setUploadProgress(100);
      return item;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setUploading(false);
    }
  }, []);

  const updateMediaStartOffset = useCallback(async (id: string, startMs: number | null): Promise<MatchMedia> => {
    const res = await fetchWithRetry(`${API_BASE}/media.php?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_match_start_ms: startMs }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao ajustar inicio do video' }));
      throw new Error(err.error || 'Erro ao ajustar inicio do video');
    }
    const item = parseMatchMedia(await res.json());
    setMedia(prev => prev.map(m => (m.id === item.id ? item : m)));
    return item;
  }, []);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const deleteMedia = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/media.php?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao deletar' }));
      throw new Error(err.error || 'Erro ao deletar');
    }
    setMedia(prev => prev.filter(m => m.id !== id));
  }, []);

  const mediaByCategory = useCallback((category: MediaCategory) =>
    media.filter(m => m.category === category), [media]);

  return { media, loading, uploading, uploadProgress, error, reload: load, uploadMedia, addExternalMedia, updateMediaStartOffset, cancelUpload, deleteMedia, mediaByCategory };
}
