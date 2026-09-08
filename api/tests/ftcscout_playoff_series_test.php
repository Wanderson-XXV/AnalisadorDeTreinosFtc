<?php

function assertTrue($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'playoff_series_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../ftcscout_import_lib.php';
$db = getDB();

$teams = [
    ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 1, 'onField' => true],
    ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 2, 'onField' => true],
    ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 3, 'onField' => true],
    ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 4, 'onField' => true],
];
$payload = [
    'events_json' => json_encode([[
        'season' => 2025,
        'code' => 'FTCCMP1',
        'name' => 'FIRST World Championship - Finals Division',
    ]]),
    'matches_json' => json_encode([
        ['eventSeason' => 2025, 'eventCode' => 'FTCCMP1', 'id' => 36001, 'tournamentLevel' => 'DoubleElim', 'series' => 16, 'teams' => $teams],
        ['eventSeason' => 2025, 'eventCode' => 'FTCCMP1', 'id' => 36002, 'tournamentLevel' => 'DoubleElim', 'series' => 16, 'teams' => $teams],
    ]),
    'teams_json' => '[]',
    'team_details_json' => '[]',
    'auto_enrich' => false,
];
$result = importFtcScoutManualJson($db, $payload);
assertTrue($result['summary']['matches']['created'] === 2, 'both matches in a playoff series must be created');
$rows = $db->query("SELECT match_number, display_name, source_match_id, source_system FROM matches ORDER BY match_number")->fetchAll(PDO::FETCH_ASSOC);
assertTrue(count($rows) === 2, 'series rematch must not overwrite the first match');
assertTrue((int)$rows[0]['match_number'] === 16 && $rows[0]['display_name'] === 'M16', 'first series match keeps the compact label');
assertTrue((int)$rows[1]['match_number'] === 16002 && $rows[1]['display_name'] === 'M16-2', 'second series match gets a unique readable label');
assertTrue($rows[0]['source_match_id'] === '36001' && $rows[1]['source_match_id'] === '36002', 'FTCScout source ids must be retained');
assertTrue($rows[0]['source_system'] === 'ftcscout', 'source system must identify FTCScout');

normalizeMatchDisplayNames($db);
$secondAfterMigration = $db->query("SELECT match_number, display_name FROM matches WHERE source_match_id = '36002'")->fetch(PDO::FETCH_ASSOC);
assertTrue((int)$secondAfterMigration['match_number'] === 16002 && $secondAfterMigration['display_name'] === 'M16-2', 'global normalization must preserve readable FTCScout rematch labels');

@unlink($tmpDb);
echo "ftcscout_playoff_series_test passed\n";
