import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Eye, FileJson, Loader2, UploadCloud } from 'lucide-react';
import { fetchApi } from '../../lib/api';

type ImportBucket = Record<string, number>;
type CopiedTarget = 'base' | 'example' | null;

const FTC_SCOUT_API_BASE = 'https://api.ftcscout.org/rest/v1';
const FTC_SCOUT_MATCHES_TEMPLATE = `${FTC_SCOUT_API_BASE}/events/{season}/{eventCode}/matches`;
const FTC_SCOUT_MATCHES_EXAMPLE = `${FTC_SCOUT_API_BASE}/events/2025/FTCCMP1ROSS/matches`;

interface ImportResult {
  success: boolean;
  dry_run: boolean;
  summary: {
    events: ImportBucket;
    teams: ImportBucket;
    enrollments: ImportBucket;
    matches: ImportBucket;
  };
  preview: {
    events: Array<{ id: string; name: string; short_name?: string | null; event_code: string; scope_type: string }>;
    teams: Array<{ team_number: number; team_name: string }>;
    matches: Array<{
      event_code: string;
      event_name?: string | null;
      display_name: string;
      match_type: string;
      red: number[];
      blue: number[];
      issues: string[];
      scheduled_time?: string | null;
    }>;
  };
  warnings: string[];
}

interface FtcScoutJsonImportProps {
  onImported: () => Promise<void>;
}

function SummaryLine({ label, values }: { label: string; values: ImportBucket }) {
  return (
    <div className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(values).map(([key, value]) => (
          <span key={key} className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300">
            {key.replaceAll('_', ' ')}: <strong className="text-white">{value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function JsonField({
  label,
  value,
  onChange,
  placeholder,
  required,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  helper?: ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-slate-400">{label}{required ? ' *' : ''}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-h-36 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:border-orange-500"
      />
      {helper}
    </label>
  );
}

function PreviewList({ result }: { result: ImportResult }) {
  const teams = result.preview.teams.slice(0, 24);
  const hiddenTeams = Math.max(0, result.preview.teams.length - teams.length);
  const matches = result.preview.matches.slice(0, 18);
  const hiddenMatches = Math.max(0, result.preview.matches.length - matches.length);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
      <div className="border border-slate-700 rounded-lg bg-slate-900/40 p-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Campeonatos</div>
        <div className="space-y-1.5">
          {result.preview.events.length === 0 && <p className="text-xs text-slate-500">Nenhum campeonato novo na previa.</p>}
          {result.preview.events.map(event => {
            const label = event.short_name || event.name || event.event_code;
            return (
              <div key={`${event.id}-${event.event_code}`} className="text-xs text-slate-300">
                <span className="font-semibold text-white">{label}</span>
                {event.event_code !== label && <span className="text-slate-500"> - {event.event_code}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-slate-700 rounded-lg bg-slate-900/40 p-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Equipes</div>
        <div className="flex flex-wrap gap-1.5">
          {teams.map(team => (
            <span key={team.team_number} className="text-xs px-2 py-1 rounded-md bg-slate-800 text-slate-300 max-w-full truncate">
              #{team.team_number}{team.team_name ? ` ${team.team_name}` : ''}
            </span>
          ))}
          {hiddenTeams > 0 && (
            <span className="text-xs px-2 py-1 rounded-md bg-slate-700 text-slate-300">+{hiddenTeams}</span>
          )}
        </div>
      </div>

      <div className="border border-slate-700 rounded-lg bg-slate-900/40 p-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Partidas</div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {matches.map((match, index) => (
            <div key={`${match.event_code}-${match.display_name}-${index}`} className="text-xs border border-slate-800 rounded-md p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{match.event_name || match.event_code} {match.display_name}</span>
                {match.issues.length > 0 && <span className="text-amber-300">{match.issues.length} aviso</span>}
              </div>
              <div className="mt-1 text-slate-400">Vermelha: {match.red.join(', ')} | Azul: {match.blue.join(', ')}</div>
              {match.issues.length > 0 && (
                <div className="mt-1 text-amber-200">{match.issues.join('; ')}</div>
              )}
            </div>
          ))}
          {hiddenMatches > 0 && <div className="text-xs text-slate-500">+{hiddenMatches} partidas na previa</div>}
        </div>
      </div>
    </div>
  );
}

export function FtcScoutJsonImport({ onImported }: FtcScoutJsonImportProps) {
  const [matchesJson, setMatchesJson] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<'preview' | 'import' | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<CopiedTarget>(null);

  const canSubmit = matchesJson.trim().length > 0;

  const copyEndpoint = async (target: Exclude<CopiedTarget, null>, value: string) => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(null), 1500);
  };

  const submit = async (dryRun: boolean) => {
    setError(null);
    setLoadingMode(dryRun ? 'preview' : 'import');
    try {
      const response = await fetchApi<ImportResult>('/ftcscout_import.php', {
        method: 'POST',
        body: JSON.stringify({
          dry_run: dryRun,
          matches_json: matchesJson,
        }),
      });
      setResult(response);
      if (!dryRun) await onImported();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-900/40 text-blue-300 flex items-center justify-center flex-shrink-0">
          <FileJson className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Importar JSON FTCScout</h3>
          <p className="text-sm text-slate-400 mt-1">Etapa 1 de 2: importe a tabela oficial de partidas. O sistema cria campeonato, equipes e inscrições pelo código do evento.</p>
        </div>
      </div>

      <JsonField
        label="Partidas"
        value={matchesJson}
        onChange={setMatchesJson}
        placeholder='Cole aqui o retorno de /events/{season}/{eventCode}/matches. Pode colar varias divisoes juntas, inclusive dentro de blocos ```json```.'
        required
        helper={
          <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-400">
            <div className="mb-3 rounded-md border border-blue-800/50 bg-blue-950/25 p-2.5 leading-relaxed text-blue-100"><strong>Onde achar o código:</strong> abra o evento no FTCScout; ele aparece na URL e tem formato como <code className="font-mono">FTCCMP1ROSS</code>. Substitua apenas <code className="font-mono">{`{season}`}</code> e <code className="font-mono">{`{eventCode}`}</code> na URL abaixo, abra-a no navegador e copie todo o JSON retornado.</div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="font-semibold text-slate-300">Cola rapida da API FTCScout</div>
                <div className="font-mono text-slate-500 break-all">{FTC_SCOUT_MATCHES_TEMPLATE}</div>
                <div className="font-mono text-blue-300 break-all">{FTC_SCOUT_MATCHES_EXAMPLE}</div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  title="Copiar URL base"
                  onClick={() => copyEndpoint('base', FTC_SCOUT_API_BASE)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedTarget === 'base' ? 'Copiado' : 'Base'}
                </button>
                <button
                  type="button"
                  title="Copiar exemplo de partidas"
                  onClick={() => copyEndpoint('example', FTC_SCOUT_MATCHES_EXAMPLE)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-900/50 hover:bg-blue-800/70 text-blue-100 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedTarget === 'example' ? 'Copiado' : 'Exemplo'}
                </button>
                <a
                  href="https://ftcscout.org/api/rest"
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir documentacao da API FTCScout"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Docs
                </a>
              </div>
            </div>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">Use <strong className="text-slate-300">Prévia</strong> primeiro. Placar oficial é ignorado; no-show e equipes fora de campo aparecem como aviso. Depois, na Etapa 2, vincule os vídeos no ClipFarm.</div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            disabled={!canSubmit || loadingMode !== null}
            onClick={() => submit(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loadingMode === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Previa
          </button>
          <button
            type="button"
            disabled={!canSubmit || loadingMode !== null}
            onClick={() => submit(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loadingMode === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            Importar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/30 border border-red-800/50 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            {result.dry_run ? 'Previa calculada sem gravar no banco.' : 'Importacao gravada no banco.'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SummaryLine label="Eventos" values={result.summary.events} />
            <SummaryLine label="Equipes" values={result.summary.teams} />
            <SummaryLine label="Inscricoes" values={result.summary.enrollments} />
            <SummaryLine label="Partidas" values={result.summary.matches} />
          </div>
          <PreviewList result={result} />
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map(warning => (
                <div key={warning} className="flex items-start gap-2 text-xs text-amber-200 bg-amber-950/20 border border-amber-800/40 rounded-lg p-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
