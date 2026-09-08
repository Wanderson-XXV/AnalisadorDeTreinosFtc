<?php

function assertCriSeed($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cri_2026_seed_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
define('FTC_CRI_IMPORT_LIBRARY_ONLY', true);
require_once __DIR__ . '/../import_cri_2026_once.php';

$db = getDB();
$first = importCri2026($db);
$second = importCri2026($db);

assertCriSeed($first['championship_created'] === true, 'first run must create the CRI championship');
assertCriSeed($first['official_teams'] === 38, 'official snapshot must contain 38 teams');
assertCriSeed($second['championship_created'] === false, 'second run must reuse the championship');
assertCriSeed($second['teams_created'] === 0 && $second['enrollments_created'] === 0, 'second run must be idempotent');

$championship = $db->query("SELECT * FROM championships WHERE event_code = 'FPECRI'")->fetch(PDO::FETCH_ASSOC);
assertCriSeed((int)$championship['alliance_size'] === 3, 'CRI must be created as 3x3 before matches exist');
assertCriSeed($championship['timezone'] === 'America/Chicago', 'CRI must preserve the event timezone');
assertCriSeed((int)$db->query("SELECT COUNT(*) FROM championship_teams WHERE championship_id = '" . $championship['id'] . "'")->fetchColumn() === 38, 'all official teams must be enrolled');
assertCriSeed((int)$db->query('SELECT COUNT(*) FROM matches')->fetchColumn() === 0, 'seed must not invent matches');
assertCriSeed($db->query('SELECT team_name FROM teams WHERE team_number = 23055')->fetchColumn() === 'Tech Fenix', 'official team names must be imported');

@unlink($tmpDb);
echo "cri_2026_seed_test passed\n";

