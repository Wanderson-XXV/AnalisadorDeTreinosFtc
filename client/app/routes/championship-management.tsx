import { useMemo, useState } from 'react';
import { Layers3, MapPin, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ClipFarmImport } from '../components/championships/ClipFarmImport';
import { FtcScoutJsonImport } from '../components/championships/FtcScoutJsonImport';
import { useSidebar } from '../hooks/useSidebar';
import { useChampionshipContext } from '../hooks/useChampionshipContext';
import { fetchApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { Championship, ChampionshipScopeType } from '../lib/types';

const timezoneOptions = [
  { value: 'America/Sao_Paulo', city: 'Brasília, DF', region: 'Brasil — horário de Brasília' },
  { value: 'America/New_York', city: 'Nova York, NY', region: 'EUA — horário do Leste' },
  { value: 'America/Chicago', city: 'Houston ou Chicago, EUA', region: 'EUA — horário Central' },
  { value: 'America/Denver', city: 'Denver, CO', region: 'EUA — horário das Montanhas' },
  { value: 'America/Los_Angeles', city: 'Los Angeles, CA', region: 'EUA — horário do Pacífico' },
  { value: 'America/Phoenix', city: 'Phoenix, AZ', region: 'EUA — Arizona' },
  { value: 'America/Anchorage', city: 'Anchorage, AK', region: 'EUA — Alasca' },
  { value: 'Pacific/Honolulu', city: 'Honolulu, HI', region: 'EUA — Havaí' },
  { value: 'America/Toronto', city: 'Toronto, ON', region: 'Canadá — horário do Leste' },
  { value: 'America/Mexico_City', city: 'Cidade do México', region: 'México — horário Central' },
  { value: 'Europe/London', city: 'Londres', region: 'Reino Unido' },
  { value: 'Europe/Paris', city: 'Paris', region: 'França / Europa Central' },
  { value: 'Asia/Tokyo', city: 'Tóquio', region: 'Japão' },
] as const;

function TimezonePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.toLocaleLowerCase('pt-BR');
  const options = timezoneOptions.filter(option => `${option.city} ${option.region} ${option.value}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  const selected = timezoneOptions.find(option => option.value === value);

  return (
    <fieldset className="space-y-2 md:col-span-2">
      <div>
        <span className="text-xs text-slate-300">Onde o evento acontece?</span>
        <p className="mt-0.5 text-[11px] text-slate-500">Escolha pela cidade. Exemplo: Houston usa o horário Central dos EUA.</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar cidade, estado ou país..." className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
      </div>
      <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {options.map(option => (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} className={cn('rounded-lg border px-3 py-2 text-left transition-colors', value === option.value ? 'border-orange-400 bg-orange-500/15 text-white' : 'border-slate-700 bg-slate-900/35 text-slate-300 hover:border-slate-500 hover:bg-slate-700/70')}>
            <span className="flex items-center gap-1.5 text-sm font-semibold"><MapPin className="h-3.5 w-3.5 text-orange-400" />{option.city}</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">{option.region}</span>
          </button>
        ))}
        {options.length === 0 && <p className="col-span-full py-3 text-sm text-slate-500">Não encontramos essa cidade. Use o fuso principal mais próximo ou ajuste o local do evento.</p>}
      </div>
      {selected && <p className="text-[11px] text-orange-200">Selecionado: <strong>{selected.city}</strong> — {selected.region}</p>}
      {!selected && <p className="text-[11px] text-amber-200">Fuso importado: {value}. Escolha uma cidade acima para substituí-lo.</p>}
    </fieldset>
  );
}

const scopeLabels: Record<ChampionshipScopeType, string> = {
  standalone: 'Independente',
  event_group: 'Evento pai',
  division: 'Divisão',
  final: 'Final',
};

const playableScopes: ChampionshipScopeType[] = ['standalone', 'division', 'final'];

interface FormState {
  name: string;
  short_name: string;
  season: string;
  event_code: string;
  scope_type: ChampionshipScopeType;
  parent_id: string;
  level: string;
  location: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  alliance_size: string;
}

const initialForm: FormState = {
  name: '',
  short_name: '',
  season: '2025',
  event_code: '',
  scope_type: 'standalone',
  parent_id: '',
  level: '',
  location: '',
  starts_at: '',
  ends_at: '',
  timezone: 'America/Sao_Paulo',
  alliance_size: '2',
};

function flatten(items: Championship[]): Championship[] {
  return items.flatMap(item => [item, ...flatten(item.children ?? [])]);
}

function ChampionshipRow({
  championship,
  depth,
  onEdit,
  onDelete,
}: {
  championship: Championship;
  depth: number;
  onEdit: (championship: Championship) => void;
  onDelete: (id: string) => void;
}) {
  const canHostChildren = championship.scope_type === 'event_group';
  const isPlayable = playableScopes.includes(championship.scope_type);
  return (
    <div>
      <div
        className="flex items-center gap-3 border border-slate-700 bg-slate-800 rounded-xl px-3 py-3"
        style={{ marginLeft: depth * 18 }}
      >
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
          canHostChildren ? 'bg-indigo-900/50 text-indigo-300' : 'bg-orange-900/40 text-orange-300'
        )}>
          <Layers3 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">{championship.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
              {scopeLabels[championship.scope_type]}
            </span>
            {isPlayable && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-300">
                recebe partidas
              </span>
            )}
            {isPlayable && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300">{championship.alliance_size ?? 2}×{championship.alliance_size ?? 2}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex gap-2 flex-wrap">
            {championship.short_name && <span>{championship.short_name}</span>}
            {championship.event_code && <span>{championship.event_code}</span>}
            {championship.season && <span>Temporada {championship.season}</span>}
            {championship.location && <span>{championship.location}</span>}
            {championship.timezone && <span>{championship.timezone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(championship)}
            className="p-2 text-slate-500 hover:text-orange-300 hover:bg-slate-700 rounded-lg transition-colors"
            title="Editar detalhes"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(championship.id)}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {(championship.children ?? []).map(child => (
        <ChampionshipRow key={child.id} championship={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function formFromChampionship(championship: Championship): FormState {
  return {
    name: championship.name ?? '',
    short_name: championship.short_name ?? '',
    season: championship.season ?? '',
    event_code: championship.event_code ?? '',
    scope_type: championship.scope_type,
    parent_id: championship.parent_id ?? '',
    level: championship.level ?? '',
    location: championship.location ?? '',
    starts_at: toDatetimeLocal(championship.starts_at),
    ends_at: toDatetimeLocal(championship.ends_at),
    timezone: championship.timezone || 'America/Sao_Paulo',
    alliance_size: String(championship.alliance_size ?? 2),
  };
}

export default function ChampionshipManagementPage() {
  const { isCollapsed } = useSidebar();
  const { championships, flatChampionships, loading, error, reloadChampionships } = useChampionshipContext();
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingChampionshipId, setEditingChampionshipId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const parentOptions = useMemo(() =>
    flatten(championships).filter(c => c.scope_type === 'event_group' && c.id !== editingChampionshipId),
    [championships, editingChampionshipId]
  );

  const set = (key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const setScopeType = (scopeType: ChampionshipScopeType) => {
    setForm(prev => ({
      ...prev,
      scope_type: scopeType,
      parent_id: scopeType === 'standalone' || scopeType === 'event_group' ? '' : prev.parent_id,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setLocalError(null);
    try {
      await fetchApi<Championship>('/championships.php', {
        method: editingChampionshipId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          ...(editingChampionshipId ? { id: editingChampionshipId } : {}),
          parent_id: form.parent_id || null,
          short_name: form.short_name || null,
          event_code: form.event_code || null,
          level: form.level || null,
          location: form.location || null,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          status: 'active',
          ...(!editingChampionshipId ? { alliance_size: Number(form.alliance_size) } : {}),
        }),
      });
      setForm(initialForm);
      setEditingChampionshipId(null);
      await reloadChampionships();
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (championship: Championship) => {
    setEditingChampionshipId(championship.id);
    setForm(formFromChampionship(championship));
    setLocalError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingChampionshipId(null);
    setForm(initialForm);
    setLocalError(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este campeonato, suas divisões, partidas e scouts vinculados?')) return;
    try {
      await fetchApi(`/championships.php?id=${encodeURIComponent(id)}&force=1`, { method: 'DELETE' });
      await reloadChampionships();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className={cn('flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 transition-all duration-300 overflow-x-hidden', isCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Layers3 className="w-8 h-8 text-orange-500" />
                <h2 className="text-3xl font-bold text-white">Campeonatos</h2>
              </div>
              <p className="text-slate-400">Organize eventos, divisões e finais antes de criar partidas.</p>
            </div>
            <button
              onClick={reloadChampionships}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl transition-colors self-start sm:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {editingChampionshipId ? <Pencil className="w-4 h-4 text-orange-400" /> : <Plus className="w-4 h-4 text-orange-400" />}
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {editingChampionshipId ? 'Editar campeonato' : 'Novo campeonato'}
                </h3>
              </div>
              {editingChampionshipId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-400">Nome</span>
                <input value={form.name} onChange={e => set('name', e.target.value)} required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Nome curto</span>
                <input value={form.short_name} onChange={e => set('short_name', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Tipo</span>
                <select value={form.scope_type} onChange={e => setScopeType(e.target.value as ChampionshipScopeType)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                  <option value="standalone">Campeonato independente</option>
                  <option value="event_group">Evento pai</option>
                  <option value="division">Divisão</option>
                  <option value="final">Final</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Evento pai</span>
                <select value={form.parent_id} onChange={e => set('parent_id', e.target.value)} disabled={form.scope_type === 'standalone' || form.scope_type === 'event_group'} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50">
                  <option value="">Sem pai</option>
                  {parentOptions.map(parent => (
                    <option key={parent.id} value={parent.id}>{parent.short_name || parent.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Temporada</span>
                <input value={form.season} onChange={e => set('season', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Código externo</span>
                <input value={form.event_code} onChange={e => set('event_code', e.target.value)} placeholder="BRCMP, WORLD-FRK..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Robôs por aliança</span>
                <select value={form.alliance_size} onChange={e => set('alliance_size', e.target.value)} disabled={!!editingChampionshipId} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60">
                  <option value="2">2 × 2 (FTC padrão)</option>
                  <option value="3">3 × 3 (CRI)</option>
                </select>
                {editingChampionshipId && <span className="block text-[11px] text-slate-500">Definido na criação e bloqueado para proteger as partidas.</span>}
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Nível</span>
                <input value={form.level} onChange={e => set('level', e.target.value)} placeholder="national, division..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Local</span>
                <input value={form.location} onChange={e => set('location', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Início</span>
                <input type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Fim</span>
                <input type="datetime-local" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              </label>
              <TimezonePicker value={form.timezone} onChange={value => set('timezone', value)} />
              {(form.scope_type === 'division' || form.scope_type === 'final') && <span className="-mt-2 block text-[11px] text-slate-500 md:col-span-2">Divisões e finais usam o fuso do evento pai ao exibir as partidas.</span>}
            </div>

            {localError && <p className="text-sm text-red-400">{localError}</p>}
            <div className="flex justify-end">
              <button disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">
                {editingChampionshipId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {saving ? 'Salvando...' : editingChampionshipId ? 'Salvar alteracoes' : 'Criar Campeonato'}
              </button>
            </div>
          </form>

          <FtcScoutJsonImport onImported={reloadChampionships} />
          <ClipFarmImport onImported={reloadChampionships} />

          <div className="space-y-3">
            {loading && <div className="text-center py-12 text-slate-400">Carregando campeonatos...</div>}
            {error && <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-400">{error}</div>}
            {!loading && flatChampionships.length === 0 && (
              <div className="text-center py-16 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700">Nenhum campeonato cadastrado.</div>
            )}
            {!loading && championships.map(championship => (
              <ChampionshipRow key={championship.id} championship={championship} depth={0} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
