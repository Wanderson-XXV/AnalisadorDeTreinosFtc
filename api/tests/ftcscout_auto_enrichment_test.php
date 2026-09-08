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

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_auto_enrichment_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../ftcscout_import_lib.php';

$db = getDB();
$requestedPaths = [];
$fetcher = function (string $path) use (&$requestedPaths) {
    $requestedPaths[] = $path;

    $responses = [
        'events/2025/FTCCMP1ROSS' => [
            'season' => 2025,
            'code' => 'FTCCMP1ROSS',
            'divisionCode' => 'FTCCMP1',
            'name' => 'FIRST World Championship - Ross Division',
            'type' => 'FIRSTChampionship',
            'timezone' => 'America/Chicago',
            'start' => '2026-04-29',
            'end' => '2026-05-02',
            'city' => 'Houston',
            'state' => 'TX',
            'country' => 'USA',
        ],
        'teams/3565' => ['number' => 3565, 'name' => 'Ghost Robotics'],
        'teams/14270' => ['number' => 14270, 'name' => 'Quantum Quacks'],
        'teams/15993' => ['number' => 15993, 'name' => 'CyberKnights'],
        'teams/1112' => ['number' => 1112, 'name' => 'RoboLancers'],
    ];

    return $responses[$path] ?? null;
};

$payload = [
    'matches_json' => json_encode([
        [
            'eventSeason' => 2025,
            'eventCode' => 'FTCCMP1ROSS',
            'id' => 1,
            'tournamentLevel' => 'Quals',
            'teams' => [
                ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 3565],
                ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 14270],
                ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 15993],
                ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 1112],
            ],
        ],
    ]),
    'dry_run' => false,
    'ftcscout_fetcher' => $fetcher,
];

$result = importFtcScoutManualJson($db, $payload);
assertTrue($result['success'] === true, 'import should succeed');

assertTrue(in_array('events/2025/FTCCMP1ROSS', $requestedPaths, true), 'missing event details should be fetched automatically');
assertTrue(in_array('teams/3565', $requestedPaths, true), 'missing team details should be fetched automatically');
assertTrue($result['summary']['teams']['placeholders'] === 0, 'auto-enriched teams should not count as placeholders');

$parent = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1' AND scope_type = 'event_group'");
assertTrue((bool)$parent, 'FTCCMP1 should become the parent event group');
assertTrue($parent['name'] === 'FIRST World Championship', 'parent event should use the friendly world championship name');
assertTrue($parent['short_name'] === 'World Championship', 'parent event short name should not be the raw event code');

$ross = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1ROSS' AND scope_type = 'division'");
assertTrue((bool)$ross, 'Ross division should exist');
assertTrue($ross['name'] === 'FIRST World Championship - Ross Division', 'division should keep the official event name');
assertTrue($ross['short_name'] === 'Ross', 'division short name should be friendly');

$ghost = fetchOne($db, "SELECT * FROM teams WHERE team_number = 3565");
assertTrue($ghost['team_name'] === 'Ghost Robotics', 'team name should come from FTCScout automatically');

$match = fetchOne($db, "SELECT * FROM matches WHERE championship_id = ? AND match_number = 1", [$ross['id']]);
assertTrue((bool)$match, 'match should be imported');
assertTrue($match['red_team1_name'] === 'Ghost Robotics', 'match slot should store the enriched team name');

@unlink($tmpDb);
echo "ftcscout_auto_enrichment_test passed\n";
