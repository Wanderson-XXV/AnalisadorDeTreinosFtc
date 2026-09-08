<?php

function assertTrue($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'scout_management_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../scout_management_lib.php';
require_once __DIR__ . '/../scout_assignments_lib.php';

$db = getDB();
$now = date('c');
$db->prepare("
    INSERT INTO championships (id, parent_id, name, short_name, season, event_code, scope_type, status, sort_order, created_at, updated_at)
    VALUES ('world', NULL, 'World Championship', 'Worlds', '2025', 'FTCCMP1:GROUP', 'event_group', 'active', 0, ?, ?),
           ('edison', 'world', 'Edison Division', 'Edison', '2025', 'FTCCMP1EDIS', 'division', 'active', 10, ?, ?),
           ('finals', 'world', 'Finals Division', 'Finals', '2025', 'FTCCMP1', 'final', 'active', 90, ?, ?),
           ('empty', 'world', 'Empty Division', 'Empty', '2025', 'FTCCMP1EMPTY', 'division', 'active', 20, ?, ?)
")->execute([$now, $now, $now, $now, $now, $now, $now, $now]);
$db->prepare("INSERT INTO scouts (id, username, created_at) VALUES ('scout-a', 'Alicia', ?), ('scout-b', 'Dudu', ?)")
    ->execute([$now, $now]);

$insertMatch = $db->prepare("
    INSERT INTO matches (
        id, championship_id, match_type, match_number, display_name,
        red_team1_number, red_team1_name, red_team2_number, red_team2_name,
        blue_team1_number, blue_team1_name, blue_team2_number, blue_team2_name,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, 'Alpha', 2, 'Beta', 3, 'Gamma', 4, 'Delta', ?, ?)
");
for ($i = 1; $i <= 21; $i++) {
    $insertMatch->execute(["edison-$i", 'edison', $i === 21 ? 'elimination' : 'qualification', $i, ($i === 21 ? 'M' : 'Q') . $i, $now, $now]);
}
$insertMatch->execute(['final-1', 'finals', 'elimination', 1, 'M1', $now, $now]);
$db->prepare("INSERT INTO scout_assignments (id, match_id, team_number, scout_id, created_at, updated_at) VALUES ('assigned-1', 'edison-1', 1, 'scout-a', ?, ?)")
    ->execute([$now, $now]);
$db->prepare("INSERT INTO scouting_rounds (id, match_id, team_number, scout_id, start_time, is_locked) VALUES ('round-1', 'edison-1', 2, 'scout-b', ?, 0)")
    ->execute([$now]);

$parent = getScoutManagementData($db, ['championship_id' => 'world', 'include_children' => '1']);
assertTrue($parent['matches']['total_items'] === 0, 'parent must not mix child matches into the queue');
assertTrue(count($parent['children']) === 3, 'parent must expose divisions, finals and empty children');
assertTrue($parent['totals']['matches'] === 22, 'parent totals must aggregate children');
assertTrue($parent['children'][1]['totals']['matches'] === 0, 'empty child must stay visible');

$page = getScoutManagementData($db, ['championship_id' => 'edison', 'page_size' => 20, 'page' => 1]);
assertTrue(count($page['matches']['items']) === 20, 'first page must contain 20 matches');
assertTrue($page['matches']['total_pages'] === 2, '21 matches must produce two pages');
assertTrue($page['totals']['assigned'] === 1 && $page['totals']['done'] === 1, 'slot totals must reflect assignments and completed rounds');
assertTrue($page['workloads'][0]['items'][0]['match_display_name'] === 'Q1', 'workload labels must come from the match');

$searched = getScoutManagementData($db, ['championship_id' => 'edison', 'search' => 'M21']);
assertTrue($searched['matches']['total_items'] === 1, 'search must find a display name');
$eliminations = getScoutManagementData($db, ['championship_id' => 'edison', 'match_type' => 'elimination']);
assertTrue($eliminations['matches']['total_items'] === 1, 'match type filter must work');
$partial = getScoutManagementData($db, ['championship_id' => 'edison', 'coverage' => 'partial']);
assertTrue($partial['matches']['total_items'] === 1, 'coverage filter must detect a partially covered match');

$batch = batchAssignScoutSlots($db, [
    'scout_id' => 'scout-a',
    'slots' => [
        ['match_id' => 'edison-1', 'team_number' => 1],
        ['match_id' => 'edison-2', 'team_number' => 1],
        ['match_id' => 'edison-2', 'team_number' => 1],
        ['match_id' => 'edison-2', 'team_number' => 2],
    ],
]);
assertTrue($batch['assigned'] === 2, 'batch must assign pending slots');
assertTrue($batch['skipped'] === 2, 'batch must report existing assignments and duplicates');

$before = (int)$db->query("SELECT COUNT(*) FROM scout_assignments")->fetchColumn();
try {
    batchAssignScoutSlots($db, [
        'scout_id' => 'scout-a',
        'slots' => [
            ['match_id' => 'edison-3', 'team_number' => 1],
            ['match_id' => 'missing', 'team_number' => 1],
        ],
    ]);
    throw new Exception('invalid batch should fail');
} catch (InvalidArgumentException $e) {
    assertTrue(strpos($e->getMessage(), 'Partida nao encontrada') !== false, 'invalid match must be reported');
}
$after = (int)$db->query("SELECT COUNT(*) FROM scout_assignments")->fetchColumn();
assertTrue($after === $before, 'invalid batch must roll back without partial assignments');

@unlink($tmpDb);
echo "scout_management_test passed\n";

