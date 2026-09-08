<?php

function assertTrue($condition, string $message): void {
    if (!$condition) {
        throw new Exception($message);
    }
}

function fetchOne(PDO $db, string $sql, array $params = []) {
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_championship_test_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../config.php';

assertTrue(DB_PATH === $tmpDb, 'config.php must honor FTC_DB_PATH for isolated tests');

$db = getDB();
$now = date('c');

$stmt = $db->prepare("
    INSERT INTO teams (team_number, team_name, created_at, updated_at)
    VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)
");
$stmt->execute([
    1, 'Alpha', $now, $now,
    2, 'Beta', $now, $now,
    3, 'Gamma', $now, $now,
    4, 'Delta', $now, $now,
]);

$stmt = $db->prepare("
    INSERT INTO matches (
        id, match_type, match_number, display_name,
        red_team1_number, red_team2_number, blue_team1_number, blue_team2_number,
        created_at, updated_at
    ) VALUES (?, 'qualification', 1, 'Q1', 1, 2, 3, 4, ?, ?)
");
$stmt->execute(['match-1', $now, $now]);

runMigrations($db);

$championship = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'BRCMP'");
assertTrue((bool)$championship, 'BRCMP championship should be created by migration');
assertTrue($championship['name'] === 'Nacional Brasil 2026', 'BRCMP championship should have the expected name');
assertTrue($championship['season'] === '2025', 'BRCMP championship should preserve FTCScout/FIRST season code 2025');
assertTrue($championship['scope_type'] === 'standalone', 'BRCMP championship should be standalone');

$linked = fetchOne($db, "SELECT championship_id FROM matches WHERE id = 'match-1'");
assertTrue($linked['championship_id'] === $championship['id'], 'existing matches without championship should migrate to BRCMP');

$teamCount = fetchOne($db, "SELECT COUNT(*) as total FROM championship_teams WHERE championship_id = ?", [$championship['id']]);
assertTrue((int)$teamCount['total'] === 4, 'teams appearing in migrated matches should be enrolled in BRCMP');

$idsStandalone = getChampionshipScopeIds($db, $championship['id'], false);
assertTrue($idsStandalone === [$championship['id']], 'standalone scope should only include itself without children');

$parentId = 'world-parent';
$childId = 'world-child';
$db->prepare("
    INSERT INTO championships (id, parent_id, name, short_name, season, event_code, scope_type, level, status, created_at, updated_at)
    VALUES (?, NULL, 'Mundial', 'Mundial', '2025', 'WORLD', 'event_group', 'world', 'active', ?, ?),
           (?, ?, 'Franklin', 'Franklin', '2025', 'WORLD-FRK', 'division', 'division', 'active', ?, ?)
")->execute([$parentId, $now, $now, $childId, $parentId, $now, $now]);

$idsWithChildren = getChampionshipScopeIds($db, $parentId, true);
sort($idsWithChildren);
assertTrue($idsWithChildren === [$childId, $parentId], 'parent scope with children should include descendants');

@unlink($tmpDb);
echo "championships_integration_test passed\n";
