import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparisonChartData, buildComparisonMetricBenchmarks, toggleComparisonSelection } from './comparisonProfiles.ts';

const metrics = {
  rounds_count: 2,
  cycles_count: 4,
  total_hits: 10,
  total_misses: 2,
  hit_rate: 83.33,
  avg_hits_per_round: 5,
  avg_cycles_per_round: 2,
  avg_cycle_duration_ms: 8000,
  avg_auto_hits_per_round: 2,
  avg_teleop_hits_per_round: 3,
  max_hits_per_round: 7,
  consistency: 91.5,
};

test('selection accepts teams and profiles up to four unique entries', () => {
  let selected: string[] = [];
  selected = toggleComparisonSelection(selected, 'team:23055');
  selected = toggleComparisonSelection(selected, 'profile:new');
  selected = toggleComparisonSelection(selected, 'team:100');
  selected = toggleComparisonSelection(selected, 'team:200');
  selected = toggleComparisonSelection(selected, 'team:300');
  assert.deepEqual(selected, ['team:23055', 'profile:new', 'team:100', 'team:200']);
  assert.deepEqual(toggleComparisonSelection(selected, 'profile:new'), ['team:23055', 'team:100', 'team:200']);
});

test('comparison chart exposes the shared performance metrics', () => {
  const data = buildComparisonChartData([
    { key: 'team:23055', label: 'Tech Fenix', metrics },
    { key: 'profile:new', label: 'Robo novo', metrics: { ...metrics, hit_rate: 90 } },
  ]);
  assert.equal(data.length, 6);
  assert.equal(data.find(row => row.metric === 'Taxa de acerto')?.['profile:new'], 90);
  assert.equal(data.find(row => row.metric === 'Média de acertos')?.['team:23055'], 5);
});

test('metric benchmarks use every team in the active ranking scope', () => {
  const benchmarks = buildComparisonMetricBenchmarks([
    { key: 'team:1', label: 'A', metrics },
    { key: 'team:2', label: 'B', metrics: { ...metrics, avg_hits_per_round: 12, hit_rate: 91 } },
  ]);
  assert.equal(benchmarks.avg_hits_per_round, 12);
  assert.equal(benchmarks.hit_rate, 91);
});
