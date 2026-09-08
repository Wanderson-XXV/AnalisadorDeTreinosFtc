import type { ComparisonMetrics } from './types';

export interface ComparisonParticipant { key: string; label: string; metrics: ComparisonMetrics; }

export interface ComparisonMetricDefinition {
  key: keyof ComparisonMetrics;
  label: string;
  shortLabel: string;
  description: string;
  unit: string;
  higherIsBetter: boolean;
  value: (metrics: ComparisonMetrics) => number;
  format: (value: number) => string;
}

/** Metrics available for detailed, non-ranking comparison views. */
export const COMPARISON_METRICS: ComparisonMetricDefinition[] = [
  { key: 'hit_rate', label: 'Taxa de acerto', shortLabel: 'Acerto', description: 'Acertos ÷ tentativas', unit: '%', higherIsBetter: true, value: m => m.hit_rate, format: value => `${value.toFixed(1)}%` },
  { key: 'avg_hits_per_round', label: 'Acertos por round', shortLabel: 'Acertos/round', description: 'Bolas acertadas, em média, por round', unit: 'acertos', higherIsBetter: true, value: m => m.avg_hits_per_round, format: value => value.toFixed(1) },
  { key: 'avg_cycles_per_round', label: 'Ciclos por round', shortLabel: 'Ciclos/round', description: 'Ciclos concluídos, em média, por round', unit: 'ciclos', higherIsBetter: true, value: m => m.avg_cycles_per_round, format: value => value.toFixed(1) },
  { key: 'avg_cycle_duration_ms', label: 'Tempo médio por ciclo', shortLabel: 'Tempo/ciclo', description: 'Segundos gastos, em média, para concluir um ciclo', unit: 'segundos', higherIsBetter: false, value: m => m.avg_cycle_duration_ms / 1000, format: value => `${value.toFixed(1)} s` },
  { key: 'avg_auto_hits_per_round', label: 'Acertos no autônomo', shortLabel: 'Acertos auto', description: 'Bolas acertadas no período autônomo, por round', unit: 'acertos', higherIsBetter: true, value: m => m.avg_auto_hits_per_round, format: value => value.toFixed(1) },
  { key: 'avg_teleop_hits_per_round', label: 'Acertos no teleoperado', shortLabel: 'Acertos teleop', description: 'Bolas acertadas no período teleoperado, por round', unit: 'acertos', higherIsBetter: true, value: m => m.avg_teleop_hits_per_round, format: value => value.toFixed(1) },
];

/** The direct comparison must mirror the six metrics presented in the ranking. */
export const RANKING_COMPARISON_METRICS: ComparisonMetricDefinition[] = [
  { key: 'avg_hits_per_round', label: 'Média de acertos', shortLabel: 'Média', description: 'Média de bolas acertadas por round', unit: 'acertos', higherIsBetter: true, value: m => m.avg_hits_per_round, format: value => value.toFixed(1) },
  { key: 'max_hits_per_round', label: 'Máximo de acertos', shortLabel: 'Máx.', description: 'Maior quantidade de bolas acertadas em um round', unit: 'acertos', higherIsBetter: true, value: m => m.max_hits_per_round, format: value => value.toFixed(0) },
  { key: 'avg_auto_hits_per_round', label: 'Média no autônomo', shortLabel: 'Auto', description: 'Média de bolas acertadas no período autônomo por round', unit: 'acertos', higherIsBetter: true, value: m => m.avg_auto_hits_per_round, format: value => value.toFixed(1) },
  { key: 'avg_teleop_hits_per_round', label: 'Média no teleoperado', shortLabel: 'Teleop', description: 'Média de bolas acertadas no período teleoperado por round', unit: 'acertos', higherIsBetter: true, value: m => m.avg_teleop_hits_per_round, format: value => value.toFixed(1) },
  { key: 'hit_rate', label: 'Taxa de acerto', shortLabel: 'Acerto', description: 'Média das taxas de acerto dos rounds', unit: '%', higherIsBetter: true, value: m => m.hit_rate, format: value => `${value.toFixed(1)}%` },
  { key: 'consistency', label: 'Consistência', shortLabel: 'Consist.', description: 'Regularidade dos acertos entre os rounds', unit: 'índice', higherIsBetter: true, value: m => m.consistency, format: value => value.toFixed(1) },
];

export function toggleComparisonSelection(selected: string[], key: string, limit = 4): string[] {
  if (selected.includes(key)) return selected.filter(item => item !== key);
  return selected.length < limit ? [...selected, key] : selected;
}

export function buildComparisonChartData(participants: ComparisonParticipant[], definitions = RANKING_COMPARISON_METRICS): Array<Record<string, string | number>> {
  return definitions.map(definition => ({
    metric: definition.label,
    shortMetric: definition.shortLabel,
    description: definition.description,
    unit: definition.unit,
    higherIsBetter: definition.higherIsBetter ? 1 : 0,
    ...Object.fromEntries(participants.map(p => [p.key, Number(definition.value(p.metrics).toFixed(2))])),
  }));
}

/**
 * Returns the highest real value for each metric in the active ranking scope.
 * The direct-comparison charts use these values as their shared 100-point scale.
 */
export function buildComparisonMetricBenchmarks(
  participants: ComparisonParticipant[],
  definitions = RANKING_COMPARISON_METRICS,
): Partial<Record<keyof ComparisonMetrics, number>> {
  return Object.fromEntries(definitions.map(definition => [
    definition.key,
    Math.max(0, ...participants.map(participant => definition.value(participant.metrics))),
  ]));
}
