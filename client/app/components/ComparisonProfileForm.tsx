import { useEffect, useRef, useState } from 'react';
import { CalendarRange, Image as ImageIcon, Trophy, Upload, X } from 'lucide-react';
import type { Championship, ComparisonProfile, ComparisonProfileSource, LogoPosition } from '../lib/types';
import { API_BASE } from '../lib/api';
import { cn } from '../lib/utils';

interface ComparisonProfileFormProps {
  profile?: ComparisonProfile | null;
  championships: Championship[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

const POSITIONS: LogoPosition[] = [
  'top left', 'top center', 'top right', 'center left', 'center',
  'center right', 'bottom left', 'bottom center', 'bottom right',
];

export function ComparisonProfileForm({ profile, championships, onSave, onClose }: ComparisonProfileFormProps) {
  const [sourceType, setSourceType] = useState<ComparisonProfileSource>(profile?.source_type ?? 'training_period');
  const [name, setName] = useState(profile?.name ?? '');
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [logoUrl, setLogoUrl] = useState(profile?.logo_url ?? '');
  const [logoPosition, setLogoPosition] = useState<LogoPosition>(profile?.logo_position ?? 'center');
  const [startDate, setStartDate] = useState(profile?.start_date ?? '');
  const [endDate, setEndDate] = useState(profile?.end_date ?? '');
  const [championshipId, setChampionshipId] = useState(profile?.championship_id ?? championships[0]?.id ?? '');
  const [includeChildren, setIncludeChildren] = useState(profile?.include_children ?? false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(profile?.logo_url ? (profile.logo_url.startsWith('http') ? profile.logo_url : `${API_BASE}/${profile.logo_url}`) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  const selectedChampionship = championships.find(championship => championship.id === championshipId);
  const hasChildren = Boolean(selectedChampionship?.children?.length);

  const chooseFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async () => {
    if (!selectedFile) return logoUrl || null;
    const body = new FormData();
    body.append('file', selectedFile);
    const response = await fetch(`${API_BASE}/team-logo.php`, { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erro ao enviar imagem');
    return data.file_path as string;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const uploadedLogo = await uploadLogo();
      await onSave({
        id: profile?.id,
        source_type: sourceType,
        name: name.trim(),
        nickname: nickname.trim() || null,
        logo_url: uploadedLogo,
        logo_position: logoPosition,
        start_date: sourceType === 'training_period' ? startDate : null,
        end_date: sourceType === 'training_period' ? endDate || null : null,
        championship_id: sourceType === 'championship_average' ? championshipId : null,
        include_children: sourceType === 'championship_average' && hasChildren ? includeChildren : false,
      });
      onClose();
    } catch (caught: any) {
      setError(caught.message || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500';
  const labelClass = 'mb-1 block text-xs font-semibold text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="font-bold text-white">{profile ? 'Editar perfil comparativo' : 'Novo perfil comparativo'}</h2>
            <p className="mt-0.5 text-xs text-slate-400">Defina a identidade e a fonte dos dados.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white" title="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-5">
          <div>
            <label className={labelClass}>Fonte dos dados</label>
            <div className="grid grid-cols-2 rounded-md bg-slate-900 p-1">
              <button type="button" onClick={() => setSourceType('training_period')} className={cn('flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold', sourceType === 'training_period' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white')}>
                <CalendarRange className="h-4 w-4" /> Treinos
              </button>
              <button type="button" onClick={() => setSourceType('championship_average')} className={cn('flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold', sourceType === 'championship_average' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white')}>
                <Trophy className="h-4 w-4" /> Média de campeonato
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Nome fantasia *</label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} required placeholder="Robô atual" /></div>
            <div><label className={labelClass}>Apelido</label><input className={inputClass} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="V2" /></div>
          </div>

          {sourceType === 'training_period' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Início *</label><input type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} required /></div>
              <div><label className={labelClass}>Fim</label><input type="date" className={inputClass} value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /><p className="mt-1 text-xs text-slate-500">Vazio mantém o período aberto.</p></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div><label className={labelClass}>Campeonato *</label><select className={inputClass} value={championshipId} onChange={e => { setChampionshipId(e.target.value); setIncludeChildren(false); }} required>{championships.map(championship => <option key={championship.id} value={championship.id}>{championship.short_name || championship.name}</option>)}</select></div>
              {hasChildren && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={includeChildren} onChange={e => setIncludeChildren(e.target.checked)} className="accent-orange-500" /> Incluir divisões deste campeonato</label>}
            </div>
          )}

          <div className="space-y-3 border-t border-slate-700 pt-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div><label className={labelClass}>URL da imagem</label><input className={inputClass} value={logoUrl} onChange={e => { setLogoUrl(e.target.value); setPreview(e.target.value || null); setSelectedFile(null); }} placeholder="https://..." /></div>
              <div><label className={labelClass}>Arquivo</label><button type="button" onClick={() => fileRef.current?.click()} className="flex h-[38px] items-center gap-2 rounded-md border border-slate-600 px-3 text-sm text-slate-300 hover:border-orange-500 hover:text-white"><Upload className="h-4 w-4" /> Escolher</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => chooseFile(e.target.files?.[0])} /></div>
            </div>
            {preview && <div className="flex items-center gap-3"><div className="h-14 w-14 overflow-hidden rounded-md border border-slate-600 bg-slate-900"><img src={preview} alt="Prévia" className="h-full w-full object-cover" style={{ objectPosition: logoPosition }} /></div><div className="flex-1"><label className={labelClass}>Enquadramento</label><select className={inputClass} value={logoPosition} onChange={e => setLogoPosition(e.target.value as LogoPosition)}>{POSITIONS.map(position => <option key={position} value={position}>{position}</option>)}</select></div><ImageIcon className="h-5 w-5 text-slate-500" /></div>}
          </div>

          {error && <p className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-700 pt-4"><button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-300 hover:text-white">Cancelar</button><button type="submit" disabled={saving} className="rounded-md bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar perfil'}</button></div>
        </form>
      </div>
    </div>
  );
}
