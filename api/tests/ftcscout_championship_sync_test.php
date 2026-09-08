<?php

function assertSync($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_championship_sync_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../ftcscout_championship_sync_lib.php';

$db = getDB();
$id = generateId();
$now = date('c');
$db->prepare("INSERT INTO championships (id, name, season, event_code, scope_type, timezone, status, sort_order, alliance_size, created_at, updated_at) VALUES (?, ?, ?, ?, 'standalone', ?, 'active', 0, 2, ?, ?)")
    ->execute([$id, 'Evento antigo', '2025', 'TESTEVENT', 'America/Sao_Paulo', $now, $now]);

$fetcher = function (string $path) {
    if ($path !== 'events/2025/TESTEVENT') return null;
    return [
        'season' => 2025, 'code' => 'TESTEVENT', 'name' => 'Evento oficial', 'type' => 'LeagueTournament',
        'timezone' => 'America/Chicago', 'start' => '2026-07-24', 'end' => '2026-07-26',
        'city' => 'Chicago', 'state' => 'IL', 'country' => 'USA',
    ];
};

$preview = syncExistingChampionshipsFromFtcScout($db, true, $fetcher);
assertSync($preview['summary']['updated'] === 1, 'prévia deve encontrar uma atualização');
assertSync($db->query("SELECT timezone FROM championships WHERE id = '$id'")->fetchColumn() === 'America/Sao_Paulo', 'prévia não pode gravar');

$result = syncExistingChampionshipsFromFtcScout($db, false, $fetcher);
$championship = $db->query("SELECT * FROM championships WHERE id = '$id'")->fetch(PDO::FETCH_ASSOC);
assertSync($result['summary']['updated'] === 1, 'sincronização deve atualizar uma linha');
assertSync($championship['timezone'] === 'America/Chicago', 'fuso deve vir do FTCScout');
assertSync($championship['name'] === 'Evento oficial', 'nome deve vir do FTCScout');
assertSync($championship['location'] === 'Chicago, IL, USA', 'local deve vir do FTCScout');

@unlink($tmpDb);
echo "ftcscout_championship_sync_test passed\n";
