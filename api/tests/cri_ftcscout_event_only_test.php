<?php

function assertCriEventOnly($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cri_event_only_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../ftcscout_import_lib.php';

$db = getDB();
importFtcScoutManualJson($db, [
    'events_json' => json_encode([[
        'season' => 2025,
        'code' => 'FPECRI',
        'name' => 'Chicago Robotics Invitational Premier Event',
        'type' => 'PremierEvent',
        'timezone' => 'America/Chicago',
        'start' => '2026-07-24',
        'end' => '2026-07-26',
    ]]),
    'teams_json' => json_encode([['season' => 2025, 'eventCode' => 'FPECRI', 'teamNumber' => 23055]]),
    'team_details_json' => json_encode([['number' => 23055, 'name' => 'Tech Fenix']]),
    'matches_json' => '[]',
    'auto_enrich' => false,
]);

$championship = $db->query("SELECT * FROM championships WHERE event_code = 'FPECRI'")->fetch(PDO::FETCH_ASSOC);
assertCriEventOnly((bool)$championship, 'FTCScout event-only import must create CRI');
assertCriEventOnly((int)$championship['alliance_size'] === 3, 'FTCScout event-only import must create CRI as 3x3');
assertCriEventOnly($championship['timezone'] === 'America/Chicago', 'FTCScout event-only import must preserve Chicago timezone');
assertCriEventOnly((int)$db->query('SELECT COUNT(*) FROM matches')->fetchColumn() === 0, 'event-only import must not create matches');

@unlink($tmpDb);
echo "cri_ftcscout_event_only_test passed\n";

