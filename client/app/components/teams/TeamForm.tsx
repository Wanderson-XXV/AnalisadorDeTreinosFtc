import { useState, useEffect, useRef } from 'react';
import { X, Upload, Link, Trash2, Image as ImageIcon } from 'lucide-react';
import type { Team, LogoPosition } from '../../lib/types';
import { API_BASE } from '../../lib/api';
import { LogoGalleryModal } from './LogoGalleryModal';

interface TeamFormProps {
  team?: Team | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

const GRID_POSITIONS: { value: LogoPosition; row: number; col: number }[] = [
  { value: 'top left',      row: 0, col: 0 },
  { value: 'top center',    row: 0, col: 1 },
  { value: 'top right',     row: 0, col: 2 },
  { value: 'center left',   row: 1, col: 0 },
  { value: 'center',        row: 1, col: 1 },
  { value: 'center right',  row: 1, col: 2 },
  { value: 'bottom left',   row: 2, col: 0 },
  { value: 'bottom center', row: 2, col: 1 },
  { value: 'bottom right',  row: 2, col: 2 },
];

const empty = {
  team_number: '',
  team_name: '',
  logo_url: '',
  logo_position: 'center' as LogoPosition,
  instagram: '',
};

export function TeamForm({ team, onSave, onClose }: TeamFormProps) {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoMode, setLogoMode] = useState<'url' | 'file' | 'gallery'>('url');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (team) {
      setForm({
        team_number: String(team.team_number),
        team_name: team.team_name,
        logo_url: team.logo_url ?? '',
        logo_position: team.logo_position ?? 'center',
        instagram: team.instagram ?? '',
      });
      if (team.logo_url) {
        if (team.logo_url.startsWith('http')) {
          setLogoMode('url');
        } else if (team.logo_url.startsWith('uploads/logos/')) {
          setLogoMode('gallery');
          setFilePreview(`${API_BASE}/${team.logo_url}`);
        } else {
          setLogoMode('file');
          setFilePreview(`${API_BASE}/${team.logo_url}`);
        }
      }
    }
  }, [team]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = ev => setFilePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    set('logo_url', '');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = ev => setFilePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    set('logo_url', '');
  };

  const clearLogo = () => {
    setSelectedFile(null);
    setFilePreview(null);
    set('logo_url', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGallerySelect = (path: string) => {
    set('logo_url', path);
    setFilePreview(`${API_BASE}/${path}`);
    setSelectedFile(null);
  };

  const previewSrc = logoMode === 'gallery' ? filePreview
                   : logoMode === 'file' ? filePreview
                   : form.logo_url || null;

  const uploadLogoFile = async (): Promise<string | null> => {
    if (!selectedFile) return null;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await fetch(`${API_BASE}/api/team-logo.php`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro no upload' }));
        throw new Error(err.error || 'Erro no upload');
      }
      const data = await res.json();
      return data.file_path as string;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let logoUrl = form.logo_url || null;
      if (logoMode === 'file' && selectedFile) {
        const uploaded = await uploadLogoFile();
        if (uploaded) logoUrl = uploaded;
      } else if (logoMode === 'file' && filePreview && !selectedFile) {
        logoUrl = team?.logo_url ?? null;
      } else if (logoMode === 'gallery') {
        logoUrl = form.logo_url || null;
      }

      const payload: any = {
        team_number: Number(form.team_number),
        team_name: form.team_name,
        logo_url: logoUrl,
        logo_position: form.logo_position,
        instagram: form.instagram || null,
      };
      if (team) payload.id = team.id;
      await onSave(payload);
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">{team ? 'Editar Equipe' : 'Nova Equipe'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Número da Equipe *</label>
              <input className={inputCls} type="number" min="1" value={form.team_number} onChange={e => set('team_number', e.target.value)} required placeholder="24888" />
            </div>
            <div>
              <label className={labelCls}>Nome da Equipe *</label>
              <input className={inputCls} value={form.team_name} onChange={e => set('team_name', e.target.value)} required placeholder="Tech Fenix" />
            </div>
          </div>

          {/* Logo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' mb-0'}>Logo (opcional)</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setLogoMode('url')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${logoMode === 'url' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                >
                  <Link className="w-3 h-3" /> URL
                </button>
                <button
                  type="button"
                  onClick={() => setLogoMode('file')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${logoMode === 'file' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                >
                  <Upload className="w-3 h-3" /> Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => { setLogoMode('gallery'); setShowGallery(true); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${logoMode === 'gallery' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                >
                  <ImageIcon className="w-3 h-3" /> Galeria
                </button>
              </div>
            </div>

            {logoMode === 'url' ? (
              <input className={inputCls} value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://exemplo.com/logo.png" />
            ) : logoMode === 'gallery' ? (
              <div
                className="relative border-2 border-dashed border-slate-600 hover:border-orange-500 rounded-lg p-4 text-center cursor-pointer transition-colors"
                onClick={() => setShowGallery(true)}
              >
                {filePreview ? (
                  <div className="flex items-center gap-3">
                    <img src={filePreview} alt="Preview" className="w-12 h-12 object-contain rounded" />
                    <span className="text-xs text-slate-300 truncate flex-1">{form.logo_url.split('/').pop()}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); clearLogo(); }}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="py-2">
                    <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-400">Clique para escolher da galeria</p>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="relative border-2 border-dashed border-slate-600 hover:border-orange-500 rounded-lg p-4 text-center cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                {filePreview ? (
                  <div className="flex items-center gap-3">
                    <img src={filePreview} alt="Preview" className="w-12 h-12 object-contain rounded" />
                    <span className="text-xs text-slate-300 truncate flex-1">{selectedFile?.name ?? 'Logo atual'}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); clearLogo(); }}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="py-2">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-400">Clique ou arraste uma imagem</p>
                    <p className="text-xs text-slate-500 mt-0.5">JPG, PNG, WebP — máx 10 MB</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            )}
          </div>

          {/* Position editor */}
          {previewSrc && (
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0">
                <label className={labelCls}>Preview</label>
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-700 border border-slate-600">
                  <img
                    src={previewSrc}
                    alt="Preview"
                    className="w-full h-full"
                    style={{ objectFit: 'contain', objectPosition: form.logo_position }}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Posição do Logo</label>
                <div className="grid grid-cols-3 gap-1 w-24">
                  {GRID_POSITIONS.map(pos => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => set('logo_position', pos.value)}
                      title={pos.value}
                      className={`w-7 h-7 rounded transition-colors ${
                        form.logo_position === pos.value
                          ? 'bg-orange-500'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">{form.logo_position}</p>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Instagram (opcional)</label>
            <input className={inputCls} value={form.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@techfenix" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving || uploading} className="px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg">
              {uploading ? 'Enviando...' : saving ? 'Salvando...' : team ? 'Salvar' : 'Criar Equipe'}
            </button>
          </div>
        </form>

        {showGallery && (
          <LogoGalleryModal
            onSelect={handleGallerySelect}
            onClose={() => setShowGallery(false)}
          />
        )}
      </div>
    </div>
  );
}
