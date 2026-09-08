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

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_inferred_division_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../ftcscout_import_lib.php';

$db = getDB();

$payload = [
    'events_json' => json_encode([
        [
            'season' => 2025,
            'code' => 'FTCCMP1',
            'name' => 'FIRST Championship - FIRST Tech Challenge',
            'type' => 'FIRSTChampionship',
            'timezone' => 'America/Chicago',
            'start' => '2026-04-29',
            'end' => '2026-05-02',
        ],
        [
            'season' => 2025,
            'code' => 'FTCCMP1ROSS',
            'name' => 'FIRST World Championship - Ross Division',
            'type' => 'FIRSTChampionship',
            'timezone' => 'America/Chicago',
            'start' => '2026-04-29',
            'end' => '2026-05-02',
        ],
    ]),
    'teams_json' => json_encode([
        ['season' => 2025, 'eventCode' => 'FTCCMP1ROSS', 'teamNumber' => 14270],
        ['season' => 2025, 'eventCode' => 'FTCCMP1ROSS', 'teamNumber' => 3565],
        ['season' => 2025, 'eventCode' => 'FTCCMP1ROSS', 'teamNumber' => 15993],
        ['season' => 2025, 'eventCode' => 'FTCCMP1ROSS', 'teamNumber' => 1112],
    ]),
    'team_details_json' => json_encode([]),
    'matches_json' => json_encode([
        [
            'eventSeason' => 2025,
            'eventCode' => 'FTCCMP1ROSS',
            'id' => 1,
            'tournamentLevel' => 'Quals',
            'teams' => [
                ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 14270],
                ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 3565],
                ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 15993],
                ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 1112],
            ],
        ],
    ]),
    'dry_run' => false,
    'auto_enrich' => false,
];

$result = importFtcScoutManualJson($db, $payload);
assertTrue($result['success'] === true, 'import should succeed');

$parent = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1' AND scope_type = 'event_group'");
assertTrue((bool)$parent, 'FTCCMP1 should become the parent event group');

$ross = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1ROSS'");
assertTrue((bool)$ross, 'Ross event should exist');
assertTrue($ross['scope_type'] === 'division', 'FTCCMP1ROSS should be imported as a division');
assertTrue($ross['parent_id'] === $parent['id'], 'FTCCMP1ROSS should be nested under FTCCMP1');

$standaloneRoss = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1ROSS' AND scope_type = 'standalone'");
assertTrue(!$standaloneRoss, 'FTCCMP1ROSS should not remain standalone');

$match = fetchOne($db, "SELECT * FROM matches WHERE championship_id = ? AND match_number = 1", [$ross['id']]);
assertTrue((bool)$match, 'Ross match should be linked to the Ross division');

@unlink($tmpDb);
echo "ftcscout_inferred_division_test passed\n";
