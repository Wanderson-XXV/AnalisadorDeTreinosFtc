import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Match,

 MatchType } from '../../lib/types';

interface MatchFormProps {
  match?: Match | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

const empty = {
  match_type: 'qualification' as MatchType,
  match_number: '',
  red_team1_number: '',
  red_team1_name: '',
  red_team2_number: '',
  red_team2_name: '',
  blue_team1_number: '',
  blue_team1_name: '',
  blue_team2_number: '',
  blue_team2_name: '',
  scheduled_time: '',
};

export function MatchForm({ match, onSave, onClose }: MatchFormProps) {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (match) {
      setForm({
        match_type: match.match_type,
        match_number: String(match.match_number),
        red_team1_number: String(match.red_team1_number),
        red_team1_name: match.red_team1_name ?? '',
        red_team2_number: String(match.red_team2_number),
        red_team2_name: match.red_team2_name ?? '',
        blue_team1_number: String(match.blue_team1_number),
        blue_team1_name: match.blue_team1_name ?? '',
        blue_team2_number: String(match.blue_team2_number),
        blue_team2_name: match.blue_team2_name ?? '',
        scheduled_time: match.scheduled_time ?? '',
      });
    }
  }, [match]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        match_type: form.match_type,
        match_number: Number(form.match_number),
        red_team1_number: Number(form.red_team1_number),
        red_team1_name: form.red_team1_name || null,
        red_team2_number: Number(form.red_team2_number),
        red_team2_name: form.red_team2_name || null,
        blue_team1_number: Number(form.blue_team1_number),
        blue_team1_name: form.blue_team1_name || null,
        blue_team2_number: Number(form.blue_team2_number),
        blue_team2_name: form.blue_team2_name || null,
        scheduled_time: form.scheduled_time || null,
      };
      if (match) payload.id = match.id;
      await onSave(payload);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const prefix = form.match_type === 'qualification' ? 'Q' : 'M';
  const preview = form.match_number ? `${prefix}${form.match_number}` : '—';

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500';
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-

6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">{match ? 'Editar Partida' : 'Nova Partida'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className={labelCls}>Tipo</label>
              <div className="flex gap-3">
                {(['qualification', 'elimination'] as MatchType[]).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="match_type"
                      value={t}
                      checked={form.match_type === t}
                      onChange={e => set('match_type', e.target.value)}
                      className="accent-orange-500"
                

    />
                    <span className="text-sm text-slate-300">{t === 'qualification' ? 'Qualificatória' : 'Eliminatória'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Número</label>
              <input
                className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                type="number"
                min="1"
                value={form.match_number}
                onChange={e => set('match_number', e.target.value)}
                required
              />
            </div>
            <div className="text-2xl font-bold text-orange-400 pb-1">{preview}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-red-400">Aliança Ver

melha</h3>
              <div>
                <label className={labelCls}>Equipe 1 - Número *</label>
                <input className={inputCls} type="number" value={form.red_team1_number} onChange={e => set('red_team1_number', e.target.value)} required placeholder="#24888" />
              </div>
              <div>
                <label className={labelCls}>Equipe 1 - Nome</label>
                <input className={inputCls} value={form.red_team1_name} onChange={e => set('red_team1_name', e.target.value)} placeholder="Tech Dragons" />
              </div>
              <div>
                <label className={labelCls}>Equipe 2 - Número *</label>
                <input className={inputCls} type="number" value={form.red_team2_number} onChange={e => set('red_team2_number', e.target.value)} required placeholder="#23184" />
              </div>
              <div>
                <label className={labelCls}>Equipe 2 - Nome</label>
                <input className={inputCls} value={form.red_team2_name} onChange={e => set('red_team2_name', e.target.value)} placeholder="ATLAS" />
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-400">Aliança Azul</h3>
              <div>
                <label className={labelCls}>Equipe 1 - Número *</label>
                <input className={inputCls} type="number" value={form.blue_team1_number} onChange={e => set('blue_team1_number', e.target.value)} required placeholder="#16052" />
              </div>
              <div>
                <label className={labelCls}>Equipe 1 - Nome</label>
                <input className={inputCls} value={form.blue_team1_name} onChange={e => set('blue_team1_name', e.target.value)} placeholder="HYDRA" />
              </div>
              <div>
                <label className={labelCls}>Equipe 2 - Número *</label>
                <input className={inputCls} type="number" value={form.blue_team2_number} onChange={e => set('blue_team2_number', e.target.value)} required placeholder="#31692" />
              </div>
              <div>
                <label className={labelCls}>Equipe 2 - Nome</label>
                <input className={inputCls} value={form.blue_team2_name} onChange={e => set('blue_team2_name', e.target.value)} placeholder="SPARTAN" />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Horário Previsto</label>
            <input className={inputCls} type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg">Cancelar</button>
            <button type="submit" disabled

={saving} className="px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg">
              {saving ? 'Salvando...' : match ? 'Salvar' : 'Criar Partida'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}