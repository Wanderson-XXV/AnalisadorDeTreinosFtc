import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, ExternalLink, Eye, Link2, Loader2, UploadCloud, Video } from 'lucide-react';
import { fetchApi } from '../../lib/api';
import {
  CLIPFARM_EXAMPLE_EVENT_CODE,
  CLIPFARM_EXAMPLE_EVENT_URL,
  CLIPFARM_HOME_URL,
  getClipFarmExampleInputs,
} from '../../lib/clipFarmHelp';

interface ClipFarmSummary {
  matches_found: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  matches_without_clips: number;
  clips_found: number;
  media_created: number;
  media_updated: number;
}

interface ClipFarmPreviewItem {
  status: 'matched' | 'unmatched' | 'ambiguous';
  event_code: string;
  local_match_id?: string;
  display_name?: string;
  source_match_id?: string | null;
  source_match_number?: number;
  match_type: string;
  match_number: number;
  clips: number;
  media_statuses?: string[];
}

interface ClipFarmImportResult {
  success: boolean;
  dry_run: boolean;
  summary: ClipFarmSummary;
  preview: ClipFarmPreviewItem[];
  warnings: string[];
}

interface ClipFarmImportProps {
  onImported: () => Promise<void>;
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-xs px-2 py-1 rounded-md bg-slate-900/70 border border-slate-700 text-slate-300">
      {label}: <strong className="text-white">{value}</strong>
    </span>
  );
}

function HelpStep({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[11px] font-bold text-orange-300">
        {number}
      </span>
      <span>{children}</span>
    </div>
  );
}

function CodeExample({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <Clipboard className="h-3 w-3" />
          Copiar
        </button>
      </div>
      <code className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-200" title={value}>
        {value}
      </code>
    </div>
  );
}

export function ClipFarmImport({ onImported }: ClipFarmImportProps) {
  const [eventUrl, setEventUrl] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [result, setResult] = useState<ClipFarmImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<'preview' | 'import' | null>(null);

  const canSubmit = eventUrl.trim().length > 0;

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard is a convenience only; the visible example remains selectable.
    }
  };

  const fillExample = () => {
    const example = getClipFarmExampleInputs();
    setEventUrl(example.eventUrl);
    setEventCode(example.eventCode);
  };

  const submit = async (dryRun: boolean) => {
    setError(null);
    setLoadingMode(dryRun ? 'preview' : 'import');
    try {
      const response = await fetchApi<ClipFarmImportResult>('/clipfarm_import.php', {
        method: 'POST',
        body: JSON.stringify({
          clipfarm_event_url: eventUrl.trim(),
          event_code: eventCode.trim() || undefined,
          dry_run: dryRun,
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

  const preview = result?.preview.slice(0, 18) ?? [];
  const hiddenPreview = result ? Math.max(0, result.preview.length - preview.length) : 0;

  return (
    <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-orange-900/40 text-orange-300 flex items-center justify-center flex-shrink-0">
          <Video className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Importar videos ClipFarm</h3>
          <p className="text-sm text-slate-400 mt-1">Etapa 2 de 2: depois de importar as partidas pelo FTCScout, use o ClipFarm para vincular vídeos às partidas existentes.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-slate-100">
              <Video className="h-4 w-4 text-orange-300" />
              <span className="font-semibold">Como usar</span>
            </div>
            <div className="grid gap-2 text-slate-400">
              <HelpStep number={1}>Primeiro importe as partidas pelo cartão azul do FTCScout acima.</HelpStep>
              <HelpStep number={2}>Abra o mesmo evento no ClipFarm e copie a URL da página do evento.</HelpStep>
              <HelpStep number={3}>Informe o código da divisão somente se for necessário limitar o vínculo, como <span className="font-mono text-slate-200">FTCCMP1ROSS</span>; faça uma <span className="font-semibold text-slate-200">Prévia</span> antes de importar.</HelpStep>
            </div>
            <p className="rounded-lg border border-amber-700/40 bg-amber-950/25 p-2.5 text-xs leading-relaxed text-amber-100"><strong>Não use importação em massa do YouTube aqui.</strong> Mesmo quando o ClipFarm aponta para um vídeo do YouTube, a importação deve partir da página do evento no ClipFarm para que o sistema associe cada clipe à partida certa.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={CLIPFARM_HOME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              >
                Abrir ClipFarm
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={CLIPFARM_EXAMPLE_EVENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              >
                Ver exemplo Ross
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Exemplo rapido</div>
                <p className="text-xs text-slate-400">Mundial 2026, divisao Ross.</p>
              </div>
              <button
                type="button"
                onClick={fillExample}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-600"
              >
                Preencher
              </button>
            </div>
            <CodeExample label="URL do evento" value={CLIPFARM_EXAMPLE_EVENT_URL} onCopy={() => copyToClipboard(CLIPFARM_EXAMPLE_EVENT_URL)} />
            <CodeExample label="Codigo externo" value={CLIPFARM_EXAMPLE_EVENT_CODE} onCopy={() => copyToClipboard(CLIPFARM_EXAMPLE_EVENT_CODE)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <label className="space-y-1 lg:col-span-2">
          <span className="text-xs text-slate-400">URL ou ID do evento ClipFarm *</span>
          <div className="relative">
            <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={eventUrl}
              onChange={event => setEventUrl(event.target.value)}
              placeholder="https://www.clipfarm.watch/en/events/..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
            />
          </div>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-400">Codigo externo</span>
          <input
            value={eventCode}
            onChange={event => setEventCode(event.target.value)}
            placeholder="FTCCMP1ROSS"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {loadingMode === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          Importar
        </button>
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
            {result.dry_run ? 'Previa calculada sem gravar no banco.' : 'Videos vinculados as partidas.'}
          </div>
          <div className="flex flex-wrap gap-2">
            <SummaryChip label="ClipFarm" value={result.summary.matches_found} />
            <SummaryChip label="encontradas" value={result.summary.matched} />
            <SummaryChip label="sem par" value={result.summary.unmatched} />
            <SummaryChip label="clips" value={result.summary.clips_found} />
            <SummaryChip label="criados" value={result.summary.media_created} />
            <SummaryChip label="atualizados" value={result.summary.media_updated} />
          </div>

          {preview.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {preview.map((item, index) => (
                <div key={`${item.event_code}-${item.source_match_id ?? index}`} className="text-xs border border-slate-700 rounded-lg bg-slate-900/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {item.event_code} {item.display_name ?? `${item.match_type} ${item.match_number}`}
                    </span>
                    <span className={item.status === 'matched' ? 'text-emerald-300' : 'text-amber-300'}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-400">
                    bruto {item.source_match_number ?? '-'} | clips {item.clips}
                  </div>
                </div>
              ))}
              {hiddenPreview > 0 && <div className="text-xs text-slate-500">+{hiddenPreview} partidas na previa</div>}
            </div>
          )}

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
