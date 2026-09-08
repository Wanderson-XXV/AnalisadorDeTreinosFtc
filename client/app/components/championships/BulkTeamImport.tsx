import { useState } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { fetchApi } from '../../lib/api';

interface BulkTeamImportProps {
  onDone: () => void;
  onClose: () => void;
}

interface TeamRow {
  id: string;
  team_number: string;
  team_name: string;
  instagram: string;
}

function emptyRow(id: string): TeamRow {
  return { id, team_number: '', team_name: '', instagram: '' };
}

function parseCSV(text: string): TeamRow[] {
  return text.trim().split('\n').filter(l => l.trim()).map((line, i) => {
    const cols = line.split(/[,;\t]/).map(c => c.trim());
    return {
      id: String(Date.now() + i),
      team_number: cols[0] ?? '',
      team_name: cols[1] ?? '',
      instagram: cols[2] ?? '',
    };
  });
}

export function BulkTeamImport({ onDone, onClose }: BulkTeamImportProps) {
  const [rows, setRows] = useState<TeamRow[]>([emptyRow('1')]);
  const [csvText, setCsvText] = useState('');
  const [tab, setTab] = useState<'manual' | 'csv'>('manual');
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<{ ok: number; errors: string[] } | null>(null);

  const addRow = () => setRows(r => [...r, emptyRow(String(Date.now()))]);
  const removeRow = (id: string) => setRows(r => r.filter(row => row.id !== id));
  const setField = (id: string, field: keyof TeamRow, value: string) =>
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const getRows = () => tab === 'csv' ? parseCSV(csvText) : rows;

  const handleSubmit = async () => {
    const toSave = getRows().filter(r => r.team_number);
    if (!toSave.length) return;

    setSaving(true);
    setResults(null);
    let ok = 0;
    const errors: string[] = [];

    for (const row of toSave) {
      try {
        await fetchApi('/teams.php', {
          method: 'POST',
          body: JSON.stringify({
            team_number: Number(row.team_number),
            team_name: row.team_name || `Equipe ${row.team_number}`,
            instagram: row.instagram || null,
          }),
        });
        ok++;
      } catch (e: any) {
        errors.push(`Equipe #${row.team_number}: ${e.message}`);
      }
    }

    setSaving(false);
    setResults({ ok, errors });
    if (ok > 0) onDone();
  };

  const inputCls = 'bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs placeholder-slate-400 focus:outline-none focus:border-orange-500 w-full';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Importar Equipes em Lote</h2>
            <p className="text-xs text-slate-400 mt-0.5">Adicione várias equipes de uma vez</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTab('manual')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'manual' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              Manual
            </button>
            <button
              onClick={() => setTab('csv')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'csv' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              CSV / Colar
            </button>
          </div>

          {tab === 'manual' ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left pb-2 pr-2 font-medium w-28">Número *</th>
                      <th className="text-left pb-2 pr-2 font-medium">Nome</th>
                      <th className="text-left pb-2 pr-2 font-medium w-36">Instagram</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} className="border-b border-slate-700/50">
                        <td className="py-1.5 pr-2">
                          <input type="number" min="1" value={row.team_number} onChange={e => setField(row.id, 'team_number', e.target.value)} className={inputCls} placeholder="12345" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={row.team_name} onChange={e => setField(row.id, 'team_name', e.target.value)} className={inputCls} placeholder="Nome da equipe" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input value={row.instagram} onChange={e => setField(row.id, 'instagram', e.target.value)} className={inputCls} placeholder="@equipe" />
                        </td>
                        <td className="py-1.5">
                          <button onClick={() => removeRow(row.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addRow}
                className="mt-3 flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar linha
              </button>
            </>
          ) : (
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Cole os dados com separador vírgula, ponto-e-vírgula ou tab. Colunas: <span className="text-slate-300">número, nome, instagram</span>
              </p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={'12345,Nome da Equipe,@equipe\n23456,Outra Equipe,@outra'}
                rows={10}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-y"
              />
              {csvText && (
                <p className="text-xs text-slate-400 mt-1">{parseCSV(csvText).length} equipes detectadas</p>
              )}
            </div>
          )}

          {results && (
            <div className="mt-4 space-y-2">
              {results.ok > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-800/50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-300">{results.ok} equipe{results.ok !== 1 ? 's' : ''} importada{results.ok !== 1 ? 's' : ''} com sucesso</span>
                </div>
              )}
              {results.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-300">{err}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg">Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg"
            >
              {saving ? 'Importando...' : `Importar ${getRows().filter(r => r.team_number).length} Equipe(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
