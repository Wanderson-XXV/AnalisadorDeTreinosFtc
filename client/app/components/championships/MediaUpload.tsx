import { useState, useRef, useCallback } from 'react';
import { X, Upload, Film, Image, Link2 } from 'lucide-react';
import type { Match, MediaCategory } from '../../lib/types';
import type { AddExternalMediaPayload, UploadMediaPayload } from '../../hooks/useMedia';
import { getMatchTeamSlots } from '../../lib/matchTeams';

interface MediaUploadProps {
  match: Match;
  uploadedBy?: string;
  uploadProgress?: number;
  onUpload: (payload: UploadMediaPayload) => Promise<void>;
  onAddExternal: (payload: AddExternalMediaPayload) => Promise<void>;
  onCancel?: () => void;
  onClose: () => void;
}

const categories: { value: MediaCategory; label: string }[] = [
  { value: 'full_match', label: 'Vídeo da Partida Inteira' },
  { value: 'key_moment', label: 'Momento-Chave' },
  { value: 'other', label: 'Outro' },
];

function captureVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener('error', () => { cleanup(); resolve(null); }, { once: true });

    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    }, { once: true });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = Math.round(640 * (video.videoHeight / video.videoWidth)) || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); resolve(null); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => { cleanup(); resolve(blob); }, 'image/jpeg', 0.8);
      } catch { cleanup(); resolve(null); }
    }, { once: true });

    video.load();
  });
}

export function MediaUpload({ match, uploadedBy, uploadProgress, onUpload, onAddExternal, onCancel, onClose }: MediaUploadProps) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [startSeconds, setStartSeconds] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [videoThumb, setVideoThumb] = useState<Blob | null>(null);
  const [category, setCategory] = useState<MediaCategory>('full_match');
  const [title, setTitle] = useState('');
  const [taggedTeams, setTaggedTeams] = useState<number[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allTeams = getMatchTeamSlots(match);

  const handleFile = async (f: File) => {
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setError('Formato não suportado. Use imagem ou vídeo.');
      return;
    }
    const maxMB = isImage ? 10 : 500;
    if (f.size > maxMB * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo ${maxMB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
    setVideoThumb(null);
    if (isImage) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
      const thumb = await captureVideoThumbnail(f);
      setVideoThumb(thumb);
      if (thumb) setPreview(URL.createObjectURL(thumb));
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const toggleTeam = (num: number) => {
    setTaggedTeams(prev =>
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'link') {
      if (!externalUrl.trim()) { setError('Cole um link.'); return; }
      const start = startSeconds.trim() ? Number(startSeconds.replace(',', '.')) : null;
      if (start !== null && (!Number.isFinite(start) || start < 0)) {
        setError('Inicio invalido.');
        return;
      }

      setSaving(true);
      setError(null);
      try {
        await onAddExternal({
          match_id: match.id,
          url: externalUrl.trim(),
          category,
          title: title || undefined,
          tagged_teams: taggedTeams.length ? taggedTeams : undefined,
          uploaded_by: uploadedBy,
          video_match_start_ms: start !== null ? Math.round(start * 1000) : undefined,
        });
        onClose();
      } catch (e: any) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!file) { setError('Selecione um arquivo.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onUpload({
        file,
        thumbnail: videoThumb ?? undefined,
        match_id: match.id,
        category,
        title: title || undefined,
        tagged_teams: taggedTeams.length ? taggedTeams : undefined,
        uploaded_by: uploadedBy,
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500';
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">Adicionar Mídia</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'file' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              Arquivo
            </button>
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                mode === 'link' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Link2 className="w-4 h-4" />
              Link
            </button>
          </div>

          {mode === 'file' ? (
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragging ? 'border-orange-500 bg-orange-500/10' : file ? 'border-green-600 bg-green-900/10' : 'border-slate-600 hover:border-slate-500'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <div className="space-y-2">
                {preview ? (
                  <img src={preview} alt="" className="mx-auto max-h-32 rounded-lg object-contain" />
                ) : (
                  <Film className="w-10 h-10 text-orange-400 mx-auto" />
                )}
                <p className="text-sm text-white font-medium truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-center gap-3">
                  <Image className="w-8 h-8 text-slate-500" />
                  <Film className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-sm text-slate-300">Arraste ou clique para selecionar</p>
                <p className="text-xs text-slate-500">JPG, PNG, WEBP até 10 MB · MP4, WEBM até 500 MB</p>
              </div>
            )}
          </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Link do video *</label>
                <input
                  className={inputCls}
                  value={externalUrl}
                  onChange={e => setExternalUrl(e.target.value)}
                  placeholder="https://youtu.be/..."
                />
              </div>
              <div>
                <label className={labelCls}>Inicio da partida no video (s)</label>
                <input
                  className={inputCls}
                  value={startSeconds}
                  onChange={e => setStartSeconds(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Categoria *</label>
            <select
              className={inputCls}
              value={category}
              onChange={e => setCategory(e.target.value as MediaCategory)}
            >
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Título (opcional)</label>
            <input
              className={inputCls}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Gol incrível no teleop"
            />
          </div>

          <div>
            <label className={labelCls}>Equipes presentes nesta mídia</label>
            <div className="space-y-2">
              {allTeams.map(t => (
                <label key={t.number} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={taggedTeams.includes(t.number)}
                    onChange={() => toggleTeam(t.number)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.alliance === 'red' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <span className="text-sm text-slate-300 group-hover:text-white">
                    #{t.number}{t.name ? ` ${t.name}` : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {saving && uploadProgress !== undefined && uploadProgress > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Enviando... {uploadProgress}%</span>
                {onCancel && (
                  <button
                    type="button"
                    onClick={() => { onCancel(); setSaving(false); }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || (mode === 'file' ? !file : !externalUrl.trim())}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {mode === 'link' ? <Link2 className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {saving ? (mode === 'link' ? 'Salvando...' : 'Enviando...') : (mode === 'link' ? 'Salvar link' : 'Enviar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
