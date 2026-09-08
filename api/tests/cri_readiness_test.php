<?php

function assertCri($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cri_readiness_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../ftcscout_import_lib.php';
require_once __DIR__ . '/../scout_management_lib.php';
require_once __DIR__ . '/../scout_assignments_lib.php';

$db = getDB();
$payload = [
    'events_json' => json_encode([[
        'season' => 2025,
        'code' => 'FPECRI',
        'name' => 'Chicago Robotics Invitational Premier Event',
        'type' => 'PremierEvent',
        'timezone' => 'America/Chicago',
        'start' => '2026-07-24',
        'end' => '2026-07-26',
    ]]),
    'teams_json' => '[]',
    'team_details_json' => '[]',
    'matches_json' => json_encode([[
        'eventSeason' => 2025,
        'eventCode' => 'FPECRI',
        'id' => 1,
        'matchNum' => 1,
        'tournamentLevel' => 'Quals',
        'teams' => [
            ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 101],
            ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 102],
            ['alliance' => 'Red', 'station' => 'Three', 'teamNumber' => 103],
            ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 201],
            ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 202],
            ['alliance' => 'Blue', 'station' => 'Three', 'teamNumber' => 203],
        ],
    ]]),
];

$result = importFtcScoutManualJson($db, $payload);
assertCri($result['summary']['matches']['created'] === 1, 'CRI import must create the 3x3 match');
$championship = $db->query("SELECT * FROM championships WHERE event_code = 'FPECRI'")->fetch(PDO::FETCH_ASSOC);
assertCri((int)$championship['alliance_size'] === 3, 'CRI import must promote alliance_size to 3');
$match = $db->query("SELECT * FROM matches WHERE championship_id = '" . $championship['id'] . "'")->fetch(PDO::FETCH_ASSOC);
assertCri((int)$match['red_team3_number'] === 103 && (int)$match['blue_team3_number'] === 203, 'third alliance stations must be persisted');

$now = date('c');
for ($i = 1; $i <= 6; $i++) {
    $db->prepare("INSERT INTO scouts (id, username, created_at) VALUES (?, ?, ?)")
        ->execute(["scout-$i", "Scout $i", $now]);
}

$management = getScoutManagementData($db, ['championship_id' => $championship['id']]);
assertCri(count($management['matches']['items'][0]['slots']) === 6, 'CRI match must expose six scout slots');
assertCri($management['matches']['items'][0]['coverage'] === 'unassigned', '0/6 must be unassigned');

foreach ([101, 102, 103, 201, 202, 203] as $index => $teamNumber) {
    $batch = batchAssignScoutSlots($db, [
        'scout_id' => 'scout-' . ($index + 1),
        'slots' => [['match_id' => $match['id'], 'team_number' => $teamNumber]],
    ]);
    assertCri($batch['assigned'] === 1, 'each of the six robots must accept an independent scout');

    if ($index === 2) {
        $partial = getScoutManagementData($db, ['championship_id' => $championship['id']]);
        assertCri($partial['matches']['items'][0]['coverage'] === 'partial', '3/6 must be partial coverage');
        assertCri($partial['totals']['assigned'] === 3, 'partial coverage totals must count three assignments');
    }

}

$covered = getScoutManagementData($db, ['championship_id' => $championship['id']]);
assertCri($covered['matches']['items'][0]['coverage'] === 'covered', '6/6 must be covered');
assertCri($covered['totals']['assigned'] === 6, 'coverage totals must include all six assignments');

foreach ([101, 102, 103, 201, 202, 203] as $index => $teamNumber) {
    $roundId = 'round-' . ($index + 1);
    $db->prepare("INSERT INTO scouting_rounds (id, match_id, team_number, scout_id, start_time, is_locked, locked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)")
        ->execute([$roundId, $match['id'], $teamNumber, 'scout-' . ($index + 1), $now, $now, $now, $now]);
    $db->prepare("INSERT INTO scouting_cycles (id, scouting_round_id, cycle_number, duration, timestamp, time_interval, hits, misses, zone) VALUES (?, ?, 1, ?, ?, '0-30s', ?, ?, ?)")
        ->execute(['cycle-' . ($index + 1), $roundId, 1000 + $index, 1000 + $index, $index, 5 - $index, $index % 2 === 0 ? 'near' : 'far']);
}

$roundIsolation = $db->query("SELECT COUNT(*) AS round_count, COUNT(DISTINCT sr.scout_id) AS scout_count, COUNT(DISTINCT sr.team_number) AS team_count, COUNT(DISTINCT sc.scouting_round_id) AS cycle_round_count FROM scouting_rounds sr LEFT JOIN scouting_cycles sc ON sc.scouting_round_id = sr.id WHERE sr.match_id = '" . $match['id'] . "'")->fetch(PDO::FETCH_ASSOC);
assertCri((int)$roundIsolation['round_count'] === 6, 'six scouts must be able to open independent rounds for the same match');
assertCri((int)$roundIsolation['scout_count'] === 6 && (int)$roundIsolation['team_count'] === 6, 'rounds must not mix scout or robot assignments');
assertCri((int)$roundIsolation['cycle_round_count'] === 6, 'each robot cycle must remain attached to its own scouting round');

$defaults = normalizeKeyboardShortcuts(null);
assertCri($defaults['toggle_zone'] === 'KeyQ' && $defaults['mark_cycle'] === 'Space', 'shortcut defaults must match the scout UI');
try {
    normalizeKeyboardShortcuts(['mark_cycle' => 'KeyQ', 'toggle_zone' => 'KeyQ']);
    throw new Exception('duplicate shortcuts should fail');
} catch (InvalidArgumentException $e) {
    assertCri(strpos($e->getMessage(), 'tecla diferente') !== false, 'duplicate shortcuts must return a clear validation error');
}

$custom = normalizeKeyboardShortcuts(['toggle_zone' => 'KeyZ']);
$db->prepare("UPDATE scouts SET keyboard_shortcuts_json = ? WHERE id = 'scout-1'")
    ->execute([json_encode($custom)]);
$row = $db->query("SELECT * FROM scouts WHERE id = 'scout-1'")->fetch(PDO::FETCH_ASSOC);
$normalized = normalizeScoutRow($row);
assertCri($normalized['keyboard_shortcuts']['toggle_zone'] === 'KeyZ', 'shortcuts must persist per account');

@unlink($tmpDb);
echo "cri_readiness_test passed\n";
