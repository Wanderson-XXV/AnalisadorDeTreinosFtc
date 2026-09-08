<?php

function assertTrue($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_comparison_profiles_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../comparison_profiles_lib.php';

$db = getDB();
$now = date('c');

$db->prepare("INSERT INTO championships (id, name, short_name, event_code, scope_type, status) VALUES
    ('national', 'Nacional', 'Nacional', 'NAT', 'standalone', 'active'),
    ('world', 'Mundial', 'Mundial', 'WORLD', 'event_group', 'active'),
    ('division', 'Divisao', 'Divisao', 'WORLD-DIV', 'division', 'active')")->execute();
$db->prepare("UPDATE championships SET parent_id = 'world' WHERE id = 'division'")->execute();
$db->prepare("INSERT INTO teams (team_number, team_name) VALUES (100, 'Alpha'), (200, 'Beta')")->execute();

$insertRound = $db->prepare("INSERT INTO rounds (id, start_time, end_time, round_type) VALUES (?, ?, ?, ?)");
$insertCycle = $db->prepare("INSERT INTO cycles (id, round_id, cycle_number, duration, hits, misses, timestamp, time_interval, is_autonomous) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
$insertRound->execute(['train-in', '2026-07-02T10:00:00Z', '2026-07-02T10:03:00Z', 'full_match']);
$insertRound->execute(['train-out', '2026-06-20T10:00:00Z', '2026-06-20T10:03:00Z', 'full_match']);
$insertRound->execute(['train-open', '2026-07-03T10:00:00Z', null, 'full_match']);
$insertCycle->execute(['tc1', 'train-in', 1, 10000, 3, 1, 20000, 'auto', 1]);
$insertCycle->execute(['tc2', 'train-in', 2, 8000, 2, 0, 60000, '0-30s', 0]);
$insertCycle->execute(['tc3', 'train-out', 1, 5000, 9, 0, 10000, 'auto', 1]);
$insertCycle->execute(['tc4', 'train-open', 1, 5000, 9, 0, 10000, 'auto', 1]);

$training = calculateTrainingPeriodMetrics($db, '2026-07-01', null);
assertTrue($training['rounds_count'] === 1, 'training profile should include only completed rounds in range');
assertTrue($training['cycles_count'] === 2, 'training profile should count cycles');
assertTrue($training['total_hits'] === 5 && $training['total_misses'] === 1, 'training totals should be aggregated');
assertTrue($training['hit_rate'] === 83.33, 'training hit rate should be weighted by attempts');
assertTrue($training['avg_auto_hits_per_round'] === 3.0, 'training autonomous average should be calculated');

$insertMatch = $db->prepare("INSERT INTO matches (id, championship_id, match_type, match_number, red_team1_number, red_team2_number, blue_team1_number, blue_team2_number) VALUES (?, ?, 'qualification', ?, 100, 200, 300, 400)");
$insertScout = $db->prepare("INSERT INTO scouting_rounds (id, match_id, team_number, start_time, end_time, is_locked) VALUES (?, ?, ?, ?, ?, 0)");
$insertScoutCycle = $db->prepare("INSERT INTO scouting_cycles (id, scouting_round_id, cycle_number, duration, timestamp, time_interval, is_autonomous, hits, misses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
$insertMatch->execute(['m1', 'national', 1]);
$insertScout->execute(['sr1', 'm1', 100, $now, $now]);
$insertScout->execute(['sr2', 'm1', 200, $now, $now]);
$insertScoutCycle->execute(['sc1', 'sr1', 1, 10000, 10000, 'auto', 1, 9, 1]);
$insertScoutCycle->execute(['sc2', 'sr2', 1, 5000, 20000, '0-30s', 0, 1, 9]);

$national = calculateChampionshipAverageMetrics($db, 'national', false);
assertTrue($national['rounds_count'] === 2, 'championship average should include all valid scouted rounds');
assertTrue($national['hit_rate'] === 50.0, 'championship rate should weight all attempts, not average team rates');
assertTrue($national['avg_cycle_duration_ms'] === 7500.0, 'cycle duration should be weighted by cycles');

$insertMatch->execute(['m2', 'division', 2]);
$insertScout->execute(['sr3', 'm2', 100, $now, $now]);
$insertScoutCycle->execute(['sc3', 'sr3', 1, 4000, 10000, 'auto', 1, 4, 0]);
$world = calculateChampionshipAverageMetrics($db, 'world', true);
assertTrue($world['total_hits'] === 4, 'parent profile should include child championship data');

$profile = createComparisonProfile($db, [
    'source_type' => 'training_period',
    'name' => 'Robo novo',
    'nickname' => 'V2',
    'start_date' => '2026-07-01',
]);
assertTrue($profile['name'] === 'Robo novo', 'profile should be created');
assertTrue($profile['metrics']['total_hits'] === 5, 'created profile should include computed metrics');

$updated = updateComparisonProfile($db, $profile['id'], ['name' => 'Robo atual', 'end_date' => '2026-07-31']);
assertTrue($updated['name'] === 'Robo atual' && $updated['end_date'] === '2026-07-31', 'profile should be updated');
assertTrue(count(listComparisonProfiles($db)) === 1, 'profile should persist in the shared list');
deleteComparisonProfile($db, $profile['id']);
assertTrue(count(listComparisonProfiles($db)) === 0, 'profile should be deleted');

$failed = false;
try {
    createComparisonProfile($db, ['source_type' => 'training_period', 'name' => 'Invalid', 'start_date' => '2026-08-01', 'end_date' => '2026-07-01']);
} catch (InvalidArgumentException $e) {
    $failed = true;
}
assertTrue($failed, 'inverted date range should be rejected');

@unlink($tmpDb);
echo "comparison_profiles_test passed\n";
