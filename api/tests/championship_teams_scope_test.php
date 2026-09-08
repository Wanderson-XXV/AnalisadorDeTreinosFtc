<?php

function assertTrue($condition, string $message): void {
    if (!$condition) {
        throw new Exception($message);
    }
}

function runChampionshipTeamsEndpoint(string $dbPath, array $query): array {
    $runner = tempnam(sys_get_temp_dir(), 'ftc_championship_teams_endpoint_');
    $endpoint = realpath(__DIR__ . '/../championship_teams.php');
    $code = "<?php\n"
        . "putenv('FTC_DB_PATH=' . " . var_export($dbPath, true) . ");\n"
        . "\$_SERVER['REQUEST_METHOD'] = 'GET';\n"
        . "\$_GET = " . var_export($query, true) . ";\n"
        . "require " . var_export($endpoint, true) . ";\n";
    file_put_contents($runner, $code);

    $output = shell_exec(PHP_BINARY . ' ' . escapeshellarg($runner));
    @unlink($runner);

    $decoded = json_decode($output ?? '', true);
    if (!is_array($decoded)) {
        throw new Exception('Endpoint did not return valid JSON: ' . ($output ?? ''));
    }

    return $decoded;
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_championship_teams_scope_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../config.php';

$db = getDB();
$now = date('c');

$db->prepare("
    INSERT INTO teams (team_number, team_name, created_at, updated_at)
    VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)
")->execute([
    100, 'Alpha', $now, $now,
    200, 'Beta', $now, $now,
    300, 'Gamma', $now, $now,
]);

$db->prepare("
    INSERT INTO championships (id, parent_id, name, short_name, season, event_code, scope_type, level, status, sort_order, created_at, updated_at)
    VALUES (?, NULL, 'World Championship', 'Worlds', '2025', 'WORLD', 'event_group', 'world', 'active', 0, ?, ?),
           (?, ?, 'Edison Division', 'Edison', '2025', 'WORLD-EDI', 'division', 'division', 'active', 1, ?, ?),
           (?, ?, 'Franklin Division', 'Franklin', '2025', 'WORLD-FRK', 'division', 'division', 'active', 2, ?, ?)
")->execute([
    'world', $now, $now,
    'edison', 'world', $now, $now,
    'franklin', 'world', $now, $now,
]);

$db->prepare("
    INSERT INTO championship_teams (id, championship_id, team_number, status, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?), (?, ?, ?, 'active', ?, ?), (?, ?, ?, 'active', ?, ?)
")->execute([
    'entry-1', 'edison', 100, $now, $now,
    'entry-2', 'franklin', 200, $now, $now,
    'entry-3', 'franklin', 300, $now, $now,
]);

$rows = runChampionshipTeamsEndpoint($tmpDb, [
    'championship_id' => 'world',
    'include_children' => '1',
]);

$teamNumbers = array_map(fn($row) => (int)$row['team_number'], $rows);
sort($teamNumbers);

assertTrue($teamNumbers === [100, 200, 300], 'parent scope should return child division team memberships');

@unlink($tmpDb);
echo "championship_teams_scope_test passed\n";
