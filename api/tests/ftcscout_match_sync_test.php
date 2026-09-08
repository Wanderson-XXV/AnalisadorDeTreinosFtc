<?php

function assertMatchSync($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_match_sync_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../ftcscout_match_sync_lib.php';

$db = getDB();
$championshipId = generateId();
$now = date('c');
$db->prepare("INSERT INTO championships (id, name, season, event_code, scope_type, timezone, status, sort_order, alliance_size, created_at, updated_at) VALUES (?, ?, '2025', 'FPECRI', 'standalone', 'America/Chicago', 'active', 0, 3, ?, ?)")
    ->execute([$championshipId, 'CRI', $now, $now]);

$event = ['season' => 2025, 'code' => 'FPECRI', 'name' => 'CRI', 'type' => 'PremierEvent', 'timezone' => 'America/Chicago'];
$matches = [[
    'id' => 1001, 'eventCode' => 'FPECRI', 'eventSeason' => 2025, 'tournamentLevel' => 'Quals', 'scheduledStartTime' => '2026-07-24T14:00:00Z',
    'teams' => [
        ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 1], ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 2], ['alliance' => 'Red', 'station' => 'Three', 'teamNumber' => 3],
        ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 4], ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 5], ['alliance' => 'Blue', 'station' => 'Three', 'teamNumber' => 6],
    ],
]];
$fetcher = function (string $path) use ($event, $matches) {
    if ($path === 'events/2025/FPECRI') return $event;
    if ($path === 'events/2025/FPECRI/matches') return $matches;
    if (preg_match('#^teams/(\d+)$#', $path, $found)) return ['number' => (int)$found[1], 'name' => 'Team ' . $found[1]];
    return null;
};

$result = syncChampionshipMatchesFromFtcScout($db, $championshipId, false, $fetcher);
assertMatchSync($result['summary']['matches']['created'] === 1, 'deve criar a partida oficial');
assertMatchSync((int)$db->query('SELECT COUNT(*) FROM matches')->fetchColumn() === 1, 'não pode duplicar partida');

$second = syncChampionshipMatchesFromFtcScout($db, $championshipId, false, $fetcher);
assertMatchSync($second['summary']['matches']['updated'] === 1, 'reexecução deve atualizar a mesma partida');
assertMatchSync((int)$db->query('SELECT COUNT(*) FROM matches')->fetchColumn() === 1, 'reexecução não pode duplicar');

@unlink($tmpDb);
echo "ftcscout_match_sync_test passed\n";
