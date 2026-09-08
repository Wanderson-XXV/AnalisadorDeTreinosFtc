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

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_hierarchy_repair_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../config.php';

$db = getDB();
$now = date('c');

$db->prepare("
    INSERT INTO championships (id, parent_id, name, short_name, season, event_code, scope_type, level, status, sort_order, created_at, updated_at)
    VALUES (?, NULL, 'FIRST Championship - FIRST Tech Challenge', 'Mundial', '2025', 'FTCCMP1', 'event_group', 'FIRSTChampionship', 'active', 0, ?, ?),
           (?, NULL, 'FTCScout FTCCMP1ROSS', 'FTCCMP1ROSS', '2025', 'FTCCMP1ROSS', 'standalone', NULL, 'active', 10, ?, ?)
")->execute([
    'parent-ftccmp1', $now, $now,
    'child-ross', $now, $now,
]);

$db->prepare("
    INSERT INTO teams (team_number, team_name, created_at, updated_at)
    VALUES (14270, 'Quantum Robot', ?, ?)
")->execute([$now, $now]);

$db->prepare("
    INSERT INTO championship_teams (id, championship_id, team_number, status, created_at, updated_at)
    VALUES ('ross-team', 'child-ross', 14270, 'active', ?, ?)
")->execute([$now, $now]);

$db->prepare("
    INSERT INTO matches (
        id, championship_id, match_type, match_number, display_name,
        red_team1_number, red_team2_number, blue_team1_number, blue_team2_number,
        created_at, updated_at
    ) VALUES ('ross-playoff-encoded', 'child-ross', 'elimination', 21001, 'E21001', 14270, 3565, 15993, 11212, ?, ?)
")->execute([$now, $now]);

runMigrations($db);

$ross = fetchOne($db, "SELECT * FROM championships WHERE id = 'child-ross'");
assertTrue($ross['scope_type'] === 'division', 'repair should convert FTCCMP1ROSS from standalone to division');
assertTrue($ross['parent_id'] === 'parent-ftccmp1', 'repair should nest FTCCMP1ROSS under FTCCMP1');

$team = fetchOne($db, "SELECT * FROM championship_teams WHERE championship_id = 'child-ross' AND team_number = 14270");
assertTrue((bool)$team, 'repair should preserve existing Ross team memberships');

$playoff = fetchOne($db, "SELECT * FROM matches WHERE id = 'ross-playoff-encoded'");
assertTrue((int)$playoff['match_number'] === 1, 'repair should decode FTCScout playoff match numbers');
assertTrue($playoff['display_name'] === 'M1', 'repair should rename old playoff displays to M prefix');

@unlink($tmpDb);
echo "championship_hierarchy_repair_test passed\n";
