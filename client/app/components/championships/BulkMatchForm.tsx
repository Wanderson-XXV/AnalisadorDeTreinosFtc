import { useState, useRef } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle, Download, Upload } from 'lucide-react';
import type { AllianceSize, MatchType, Team } from '../../lib/types';
import { fetchApi } from '../../lib/api';
import { dateAndTimeInZone, zonedLocalDateTimeToIso } from '../../lib/matchSchedule';

interface BulkMatchFormProps {
  championshipId: string;
  onDone: () => void;
  onClose: () => void;
  existingMatches?: Array<{ match_number: number; match_type: MatchType }>;
  teamsMap?: Map<number, Team>;
  allianceSize?: AllianceSize;
  championshipTimezone?: string;
}

interface MatchRow {
  id: string;
  match_type: MatchType;
  match_number: string;
  red1: string;
  red2: string;
  red3: string;
  blue1: string;
  blue2: string;
  blue3: string;
  scheduled_date: string;
  scheduled_time: string;
  scheduled_iso: string;
}

function emptyRow(id: string): MatchRow {
  return { id, match_type: 'qualification', match_number: '', red1: '', red2: '', red3: '', blue1: '', blue2: '', blue3: '', scheduled_date: '', scheduled_time: '', scheduled_iso: '' };
}

function parseCSV(text: string, allianceSize: AllianceSize): MatchRow[] {
  return text.trim().split('\n').filter(l => l.trim()).map((line, i) => {
    const cols = line.split(/[,;\t]/).map(c => c.trim());
    const type = (cols[0] ?? '').toUpperCase();
    return {
      id: String(Date.now() + i),
      match_type: (type === 'M' || type === 'E' || cols[0] === 'elimination') ? 'elimination' : (type === 'T' || cols[0] === 'practice') ? 'practice' : 'qualification',
      match_number: cols[1] ?? '',
      red1: cols[2] ?? '',
      red2: cols[3] ?? '',
      red3: allianceSize === 3 ? (cols[4] ?? '') : '',
      blue1: cols[allianceSize === 3 ? 5 : 4] ?? '',
      blue2: cols[allianceSize === 3 ? 6 : 5] ?? '',
      blue3: allianceSize === 3 ? (cols[7] ?? '') : '',
      scheduled_date: cols[allianceSize === 3 ? 8 : 6] ?? '',
      scheduled_time: cols[allianceSize === 3 ? 9 : 7] ?? '',
      scheduled_iso: '',
    };
  });
}

function officialPlayoffMatchNumber(match: any): string {
  const series = Number(match.series ?? 0);
  if (series > 0) return String(series);

  const id = Number(match.id ?? 0);
  if (id >= 21000) {
    const inferred = Math.floor(id / 1000) - 20;
    if (inferred > 0) return String(inferred);
  }

  return String(id || 1);
}

function parseOfficialJSON(data: any[], allianceSize: AllianceSize, championshipTimezone: string): MatchRow[] {
  const rows: MatchRow[] = [];
  for (const match of data) {
    const level = String(match.tournamentLevel ?? '').toLowerCase();
    let matchType: MatchType = 'qualification';
    if (level.includes('qual')) matchType = 'qualification';
    else if (level.includes('semi') || level.includes('final') || level.includes('elim')) matchType = 'elimination';
    else if (level.includes('practice')) matchType = 'practice';
    else continue;

    const teams: any[] = match.teams ?? [];
    const redOne = teams.find((t: any) => t.alliance === 'Red' && t.station === 'One');
    const redTwo = teams.find((t: any) => t.alliance === 'Red' && t.station === 'Two');
    const redThree = teams.find((t: any) => t.alliance === 'Red' && t.station === 'Three');
    const blueOne = teams.find((t: any) => t.alliance === 'Blue' && t.station === 'One');
    const blueTwo = teams.find((t: any) => t.alliance === 'Blue' && t.station === 'Two');
    const blueThree = teams.find((t: any) => t.alliance === 'Blue' && t.station === 'Three');
    if (!redOne || !redTwo || !blueOne || !blueTwo || (allianceSize === 3 && (!redThree || !blueThree))) continue;

    let date = '';
    let time = '';
    let scheduledIso = '';
    if (match.scheduledStartTime) {
      scheduledIso = zonedLocalDateTimeToIso(String(match.scheduledStartTime), championshipTimezone);
      ({ date, time } = dateAndTimeInZone(scheduledIso, championshipTimezone));
    }

    rows.push({
      id: String(match.id ?? Date.now() + rows.length),
      match_type: matchType,
      match_number: matchType === 'elimination'
        ? officialPlayoffMatchNumber(match)
        : String(match.matchNum ?? match.id ?? rows.length + 1),
      red1: String(redOne.teamNumber),
      red2: String(redTwo.teamNumber),
      red3: redThree ? String(redThree.teamNumber) : '',
      blue1: String(blueOne.teamNumber),
      blue2: String(blueTwo.teamNumber),
      blue3: blueThree ? String(blueThree.teamNumber) : '',
      scheduled_date: date,
      scheduled_time: time,
      scheduled_iso: scheduledIso,
    });
  }
  return rows;
}

export function BulkMatchForm({ championshipId, onDone, onClose, existingMatches = [], teamsMap, allianceSize = 2, championshipTimezone = 'America/Sao_Paulo' }: BulkMatchFormProps) {
  const [rows, setRows] = useState<MatchRow[]>([emptyRow('1')]);
  const [csvText, setCsvText] = useState('');
  const [tab, setTab] = useState<'manual' | 'csv' | 'api' | 'json'>('manual');
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<{ ok: number; skipped: number; errors: string[] } | null>(null);
  const [apiUrl, setApiUrl] = useState('https://api.ftcscout.org/rest/v1/events/2025/BRCMP/matches');
  const [importing, setImporting] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const arr = Array.isArray(data) ? data : [data];
        const parsed = parseOfficialJSON(arr, allianceSize, championshipTimezone);
        if (!parsed.length) {
          alert('Nenhuma partida válida encontrada no JSON.');
          return;
        }
        setRows(parsed);
        setTab('manual');
      } catch {
        alert('Erro ao ler o arquivo JSON. Verifique o formato.');
      }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const addRow = () => setRows(r => [...r, emptyRow(String(Date.now()))]);
  const removeRow = (id: string) => setRows(r => r.filter(row => row.id !== id));
  const setField = (id: string, field: keyof MatchRow, value: string) =>
    setRows(r => r.map(row => row.id === id
      ? { ...row, [field]: value, ...((field === 'scheduled_date' || field === 'scheduled_time') ? { scheduled_iso: '' } : {}) }
      : row));

  const getRows = () => tab === 'csv' ? parseCSV(csvText, allianceSize) : rows;

  const handleImportFromAPI = async () => {
    setImporting(true);
    setResults(null);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const qualis = data.filter((m: any) => m.tournamentLevel === 'Quals');
      const imported: MatchRow[] = [];

      for (const match of qualis) {
        const redOne = match.teams.find((t: any) => t.alliance === 'Red' && t.station === 'One');
        const redTwo = match.teams.find((t: any) => t.alliance === 'Red' && t.station === 'Two');
        const redThree = match.teams.find((t: any) => t.alliance === 'Red' && t.station === 'Three');
        const blueOne = match.teams.find((t: any) => t.alliance === 'Blue' && t.station === 'One');
        const blueTwo = match.teams.find((t: any) => t.alliance === 'Blue' && t.station === 'Two');
        const blueThree = match.teams.find((t: any) => t.alliance === 'Blue' && t.station === 'Three');

        if (!redOne || !redTwo || !blueOne || !blueTwo || (allianceSize === 3 && (!redThree || !blueThree))) continue;

        const scheduledIso = match.scheduledStartTime
          ? zonedLocalDateTimeToIso(String(match.scheduledStartTime), championshipTimezone)
          : '';
        const { date, time } = dateAndTimeInZone(scheduledIso, championshipTimezone);

        imported.push({
          id: String(match.id),
          match_type: 'qualification',
          match_number: String(match.matchNum ?? match.id),
          red1: String(redOne.teamNumber),
          red2: String(redTwo.teamNumber),
          red3: redThree ? String(redThree.teamNumber) : '',
          blue1: String(blueOne.teamNumber),
          blue2: String(blueTwo.teamNumber),
          blue3: blueThree ? String(blueThree.teamNumber) : '',
          scheduled_date: date,
          scheduled_time: time,
          scheduled_iso: scheduledIso,
        });
      }

      setRows(imported);
      setTab('manual');
    } catch (e: any) {
      alert(`Erro ao importar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async () => {
    if (!championshipId) {
      alert('Selecione uma divisão, final ou campeonato independente antes de importar partidas.');
      return;
    }
    const toSave = getRows().filter(r => r.match_number && r.red1 && r.red2 && r.blue1 && r.blue2 && (allianceSize === 2 || (r.red3 && r.blue3)));
    if (!toSave.length) return;

    setSaving(true);
    setResults(null);
    let ok = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of toSave) {
      const exists = existingMatches.some(
        m => m.match_number === Number(row.match_number) && m.match_type === row.match_type
      );
      if (exists) {
        skipped++;
        continue;
      }

      try {
        const scheduled_time = row.scheduled_iso || (row.scheduled_date && row.scheduled_time
          ? zonedLocalDateTimeToIso(`${row.scheduled_date}T${row.scheduled_time}`, championshipTimezone)
          : row.scheduled_date || row.scheduled_time || null);

        await fetchApi('/matches.php', {
          method: 'POST',
          body: JSON.stringify({
            championship_id: championshipId,
            match_type: row.match_type,
            match_number: Number(row.match_number),
            red_team1_number: Number(row.red1),
            red_team1_name: teamsMap?.get(Number(row.red1))?.team_name ?? null,
            red_team2_number: Number(row.red2),
            red_team2_name: teamsMap?.get(Number(row.red2))?.team_name ?? null,
            red_team3_number: row.red3 ? Number(row.red3) : null,
            red_team3_name: row.red3 ? teamsMap?.get(Number(row.red3))?.team_name ?? null : null,
            blue_team1_number: Number(row.blue1),
            blue_team1_name: teamsMap?.get(Number(row.blue1))?.team_name ?? null,
            blue_team2_number: Number(row.blue2),
            blue_team2_name: teamsMap?.get(Number(row.blue2))?.team_name ?? null,
            blue_team3_number: row.blue3 ? Number(row.blue3) : null,
            blue_team3_name: row.blue3 ? teamsMap?.get(Number(row.blue3))?.team_name ?? null : null,
            scheduled_time,
          }),
        });
        ok++;
      } catch (e: any) {
        errors.push(`Partida #${row.match_number}: ${e.message}`);
      }
    }

    setSaving(false);
    setResults({ ok, skipped, errors });
    if (ok > 0) onDone();
  };

  const inputCls = 'bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs placeholder-slate-400 focus:outline-none focus:border-orange-500 w-full';

  const validRows = getRows().filter(r => r.match_number && r.red1 && r.red2 && r.blue1 && r.blue2 && (allianceSize === 2 || (r.red3 && r.blue3)));
  const newRows = validRows.filter(r =>
    !existingMatches.some(m => m.match_number === Number(r.match_number) && m.match_type === r.match_type)
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Criar Partidas em Lote</h2>
            <p className="text-xs text-slate-400 mt-0.5">Adicione várias partidas de uma vez</p>
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
            <button
              onClick={() => setTab('api')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'api' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              Importar API
            </button>
            <button
              onClick={() => setTab('json')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'json' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              <span className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> JSON Oficial</span>
            </button>
          </div>

          {tab === 'json' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Importe partidas a partir de um arquivo JSON oficial do torneio (mesmo formato exportado pelo sistema FIRST/FTCScout).
                Apenas equipes e horários são importados — pontuações são ignoradas. Partidas já existentes no sistema serão ignoradas automaticamente.
              </p>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleJsonFile}
                className="hidden"
              />
              <button
                onClick={() => jsonInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Carregar arquivo JSON
              </button>
            </div>
          ) : tab === 'api' ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Importa qualificatórias da API do FTCScout. O horário é convertido automaticamente para horário de Brasília (UTC-3). Partidas já existentes no sistema são ignoradas.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">URL da API</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <button
                onClick={handleImportFromAPI}
                disabled={importing || !apiUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                {importing ? 'Buscando...' : 'Importar Qualificatórias'}
              </button>
            </div>
          ) : tab === 'manual' ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left pb-2 pr-2 font-medium">Tipo</th>
                      <th className="text-left pb-2 pr-2 font-medium">#</th>
                      <th className="text-left pb-2 pr-2 font-medium text-red-400">Vermelho 1</th>
                      <th className="text-left pb-2 pr-2 font-medium text-red-400">Vermelho 2</th>
                      {allianceSize === 3 && <th className="text-left pb-2 pr-2 font-medium text-red-400">Vermelho 3</th>}
                      <th className="text-left pb-2 pr-2 font-medium text-blue-400">Azul 1</th>
                      <th className="text-left pb-2 pr-2 font-medium text-blue-400">Azul 2</th>
                      {allianceSize === 3 && <th className="text-left pb-2 pr-2 font-medium text-blue-400">Azul 3</th>}
                      <th className="text-left pb-2 pr-2 font-medium">Data</th>
                      <th className="text-left pb-2 pr-2 font-medium">Horário</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {rows.map(row => {
                      const alreadyExists = row.match_number
                        ? existingMatches.some(m => m.match_number === Number(row.match_number) && m.match_type === row.match_type)
                        : false;
                      return (
                        <tr key={row.id} className={`border-b border-slate-700/50 ${alreadyExists ? 'opacity-40' : ''}`}>
                          <td className="py-1.5 pr-2">
                            <select
                              value={row.match_type}
                              onChange={e => setField(row.id, 'match_type', e.target.value)}
                              className={inputCls}
                            >
                              <option value="qualification">Q</option>
                              <option value="elimination">M</option>
                              <option value="practice">T</option>
                            </select>
                          </td>
                          <td className="py-1.5 pr-2 w-16">
                            <input type="number" min="1" value={row.match_number} onChange={e => setField(row.id, 'match_number', e.target.value)} className={inputCls} placeholder="1" />
                          </td>
                          <td className="py-1.5 pr-2 w-24">
                            <input type="number" min="1" value={row.red1} onChange={e => setField(row.id, 'red1', e.target.value)} className={inputCls} placeholder="12345" />
                          </td>
                          <td className="py-1.5 pr-2 w-24">
                            <input type="number" min="1" value={row.red2} onChange={e => setField(row.id, 'red2', e.target.value)} className={inputCls} placeholder="12345" />
                          </td>
                          {allianceSize === 3 && <td className="py-1.5 pr-2 w-24">
                            <input type="number" min="1" value={row.red3} onChange={e => setField(row.id, 'red3', e.target.value)} className={inputCls} placeholder="12345" />
                          </td>}
                          <td className="py-1.5 pr-2 w-24">
                            <input type="number" min="1" value={row.blue1} onChange={e => setField(row.id, 'blue1', e.target.value)} className={inputCls} placeholder="12345" />
                          </td>
                          <td className="py-1.5 pr-2 w-24">
                            <input type="number" min="1" value={row.blue2} onChange={e => setField(row.id, 'blue2', e.target.value)} className={inputCls} placeholder="12345" />
                          </td>
                          {allianceSize === 3 && <td className="py-1.5 pr-2 w-24">
                            <input type="number" min="1" value={row.blue3} onChange={e => setField(row.id, 'blue3', e.target.value)} className={inputCls} placeholder="12345" />
                          </td>}
                          <td className="py-1.5 pr-2 w-32">
                            <input type="date" value={row.scheduled_date} onChange={e => setField(row.id, 'scheduled_date', e.target.value)} className={inputCls} />
                          </td>
                          <td className="py-1.5 pr-2 w-24">
                            <input type="time" value={row.scheduled_time} onChange={e => setField(row.id, 'scheduled_time', e.target.value)} className={inputCls} />
                          </td>
                          <td className="py-1.5">
                            <button onClick={() => removeRow(row.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
                Cole os dados com separador vírgula, ponto-e-vírgula ou tab. Colunas: <span className="text-slate-300">{allianceSize === 3 ? 'tipo (Q/M/T), número, vermelho1, vermelho2, vermelho3, azul1, azul2, azul3, data, horário' : 'tipo (Q/M/T), número, vermelho1, vermelho2, azul1, azul2, data, horário'}</span>
              </p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={allianceSize === 3 ? 'Q,1,12345,23456,34567,45678,56789,67890,2026-07-24,09:00' : 'Q,1,12345,23456,34567,45678,2026-03-05,09:00'}
                rows={10}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-y"
              />
              {csvText && (
                <p className="text-xs text-slate-400 mt-1">{parseCSV(csvText, allianceSize).length} partidas detectadas</p>
              )}
            </div>
          )}

          {results && (
            <div className="mt-4 space-y-2">
              {results.ok > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-800/50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-300">{results.ok} partida{results.ok !== 1 ? 's' : ''} criada{results.ok !== 1 ? 's' : ''} com sucesso</span>
                </div>
              )}
              {results.skipped > 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-900/30 border border-yellow-800/50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-sm text-yellow-300">{results.skipped} partida{results.skipped !== 1 ? 's' : ''} ignorada{results.skipped !== 1 ? 's' : ''} (já existe{results.skipped !== 1 ? 'm' : ''})</span>
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

          {tab !== 'api' && tab !== 'json' && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
              <div className="text-xs text-slate-400">
                {existingMatches.length > 0 && validRows.length > 0 && validRows.length !== newRows.length && (
                  <span className="text-yellow-400">{validRows.length - newRows.length} já existe{validRows.length - newRows.length !== 1 ? 'm' : ''} e ser{validRows.length - newRows.length !== 1 ? 'ão' : 'á'} ignorada{validRows.length - newRows.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg">Cancelar</button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || newRows.length === 0}
                  className="px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
                >
                  {saving ? 'Criando...' : `Criar ${newRows.length} Partida${newRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
