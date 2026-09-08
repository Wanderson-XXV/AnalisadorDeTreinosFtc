import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { AllianceSize, Match, MatchType } from '../../lib/types';
import { TeamSearchInput } from './TeamSearchInput';
import { datetimeLocalInZone, zonedLocalDateTimeToIso } from '../../lib/matchSchedule';

interface MatchFormProps {
  match?: Match | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  allianceSize?: AllianceSize;
  championshipTimezone?: string;
}

const empty = {
  match_type: 'qualification' as MatchType,
  match_number: '',
  red_team1_number: '',
  red_team1_name: '',
  red_team2_number: '',
  red_team2_name: '',
  red_team3_number: '',
  red_team3_name: '',
  blue_team1_number: '',
  blue_team1_name: '',
  blue_team2_number: '',
  blue_team2_name: '',
  blue_team3_number: '',
  blue_team3_name: '',
  scheduled_time: '',
};

export function MatchForm({ match, onSave, onClose, allianceSize = 2, championshipTimezone = 'America/Sao_Paulo' }: MatchFormProps) {
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
        red_team3_number: match.red_team3_number ? String(match.red_team3_number) : '',
        red_team3_name: match.red_team3_name ?? '',
        blue_team1_number: String(match.blue_team1_number),
        blue_team1_name: match.blue_team1_name ?? '',
        blue_team2_number: String(match.blue_team2_number),
        blue_team2_name: match.blue_team2_name ?? '',
        blue_team3_number: match.blue_team3_number ? String(match.blue_team3_number) : '',
        blue_team3_name: match.blue_team3_name ?? '',
        scheduled_time: match.scheduled_time ? datetimeLocalInZone(match.scheduled_time, championshipTimezone) : '',
      });
    }
  }, [match, championshipTimezone]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.red_team1_number || !form.red_team2_number || !form.blue_team1_number || !form.blue_team2_number || (allianceSize === 3 && (!form.red_team3_number || !form.blue_team3_number))) {
      setError(`Selecione todas as ${allianceSize * 2} equipes.`);
      return;
    }
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
        red_team3_number: form.red_team3_number ? Number(form.red_team3_number) : null,
        red_team3_name: form.red_team3_name || null,
        blue_team1_number: Number(form.blue_team1_number),
        blue_team1_name: form.blue_team1_name || null,
        blue_team2_number: Number(form.blue_team2_number),
        blue_team2_name: form.blue_team2_name || null,
        blue_team3_number: form.blue_team3_number ? Number(form.blue_team3_number) : null,
        blue_team3_name: form.blue_team3_name || null,
        scheduled_time: form.scheduled_time ? zonedLocalDateTimeToIso(form.scheduled_time, championshipTimezone) : null,
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

  const prefix = form.match_type === 'qualification' ? 'Q' : form.match_type === 'practice' ? 'T' : 'M';
  const preview = form.match_number ? `${prefix}${form.match_number}` : '—';

  const labelCls = 'block text-xs font-medium text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">{match ? 'Editar Partida' : 'Nova Partida'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className={labelCls}>Tipo</label>
              <div className="flex gap-3">
                {(['qualification', 'elimination', 'practice'] as MatchType[]).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="match_type"
                      value={t}
                      checked={form.match_type === t}
                      onChange={e => set('match_type', e.target.value)}
                      className="accent-orange-500"
                    />
                    <span className="text-sm text-slate-300">
                      {t === 'qualification' ? 'Qualificatória' : t === 'practice' ? 'Treino' : 'Playoff'}
                    </span>
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
              <h3 className="text-sm font-semibold text-red-400">Aliança Vermelha</h3>
              <div>
                <label className={labelCls}>Equipe 1 *</label>
                <TeamSearchInput
                  value={{ number: form.red_team1_number, name: form.red_team1_name }}
                  onChange={(num, name) => setForm(f => ({ ...f, red_team1_number: num, red_team1_name: name }))}
                  placeholder="Buscar equipe 1..."
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Equipe 2 *</label>
                <TeamSearchInput
                  value={{ number: form.red_team2_number, name: form.red_team2_name }}
                  onChange={(num, name) => setForm(f => ({ ...f, red_team2_number: num, red_team2_name: name }))}
                  placeholder="Buscar equipe 2..."
                  required
                />
              </div>
              {allianceSize === 3 && <div>
                <label className={labelCls}>Equipe 3 *</label>
                <TeamSearchInput value={{ number: form.red_team3_number, name: form.red_team3_name }} onChange={(num, name) => setForm(f => ({ ...f, red_team3_number: num, red_team3_name: name }))} placeholder="Buscar equipe 3..." required />
              </div>}
            </div>

            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-400">Aliança Azul</h3>
              <div>
                <label className={labelCls}>Equipe 1 *</label>
                <TeamSearchInput
                  value={{ number: form.blue_team1_number, name: form.blue_team1_name }}
                  onChange={(num, name) => setForm(f => ({ ...f, blue_team1_number: num, blue_team1_name: name }))}
                  placeholder="Buscar equipe 1..."
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Equipe 2 *</label>
                <TeamSearchInput
                  value={{ number: form.blue_team2_number, name: form.blue_team2_name }}
                  onChange={(num, name) => setForm(f => ({ ...f, blue_team2_number: num, blue_team2_name: name }))}
                  placeholder="Buscar equipe 2..."
                  required
                />
              </div>
              {allianceSize === 3 && <div>
                <label className={labelCls}>Equipe 3 *</label>
                <TeamSearchInput value={{ number: form.blue_team3_number, name: form.blue_team3_name }} onChange={(num, name) => setForm(f => ({ ...f, blue_team3_number: num, blue_team3_name: name }))} placeholder="Buscar equipe 3..." required />
              </div>}
            </div>
          </div>

          <div>
            <label className={labelCls}>Data e Horário Previstos</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500"
              type="datetime-local"
              value={form.scheduled_time}
              onChange={e => set('scheduled_time', e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg">
              {saving ? 'Salvando...' : match ? 'Salvar' : 'Criar Partida'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
