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

function runMediaEndpoint(string $dbPath, string $method, array $query, array $body = []): array {
    $runner = tempnam(sys_get_temp_dir(), 'ftc_media_endpoint_');
    $endpoint = realpath(__DIR__ . '/../media.php');
    $input = json_encode($body);
    $code = "<?php\n"
        . "putenv('FTC_DB_PATH=' . " . var_export($dbPath, true) . ");\n"
        . "\$_SERVER['REQUEST_METHOD'] = " . var_export($method, true) . ";\n"
        . "\$_SERVER['CONTENT_TYPE'] = 'application/json';\n"
        . "\$_GET = " . var_export($query, true) . ";\n"
        . "\$GLOBALS['FTC_TEST_INPUT'] = " . var_export($input, true) . ";\n"
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

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'media_offset_endpoint_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../config.php';

$db = getDB();
$now = date('c');

$db->prepare("
    INSERT INTO championships (id, parent_id, name, short_name, season, event_code, scope_type, status, created_at, updated_at)
    VALUES (?, NULL, 'Ross', 'Ross', '2025', 'FTCCMP1ROSS', 'division', 'active', ?, ?)
")->execute(['ross', $now, $now]);

$db->prepare("
    INSERT INTO matches (
        id, championship_id, match_type, match_number, display_name,
        red_team1_number, red_team2_number, blue_team1_number, blue_team2_number,
        status, created_at, updated_at
    ) VALUES (?, ?, 'qualification', 9, 'Q9', 100, 200, 300, 400, 'completed', ?, ?)
")->execute(['match-9', 'ross', $now, $now]);

$db->prepare("
    INSERT INTO match_media (
        id, match_id, filename, original_filename, file_path, file_type, file_size, mime_type,
        category, title, tagged_teams, uploaded_at
    ) VALUES (?, ?, 'video.mp4', 'video.mp4', 'uploads/matches/match-9/video.mp4', 'video', 123, 'video/mp4',
        'full_match', 'Original title', '[100,200]', ?)
")->execute(['media-9', 'match-9', $now]);

$updated = runMediaEndpoint($tmpDb, 'PATCH', ['id' => 'media-9'], [
    'video_match_start_ms' => 37250,
]);

assertTrue((int)$updated['video_match_start_ms'] === 37250, 'PATCH should return the updated match-start offset');
assertTrue($updated['title'] === 'Original title', 'PATCH should not clear unrelated metadata');

$row = fetchOne($db, "SELECT title, video_match_start_ms FROM match_media WHERE id = ?", ['media-9']);
assertTrue((int)$row['video_match_start_ms'] === 37250, 'PATCH should persist the match-start offset');
assertTrue($row['title'] === 'Original title', 'PATCH should preserve existing title');

$reset = runMediaEndpoint($tmpDb, 'PATCH', ['id' => 'media-9'], [
    'video_match_start_ms' => 0,
]);
assertTrue((int)$reset['video_match_start_ms'] === 0, 'PATCH should allow resetting offset to zero');

$negative = runMediaEndpoint($tmpDb, 'PATCH', ['id' => 'media-9'], [
    'video_match_start_ms' => -3500,
]);
assertTrue((int)$negative['video_match_start_ms'] === -3500, 'PATCH should allow negative offset when video starts after the match');

@unlink($tmpDb);
echo "media_offset_endpoint_test passed\n";
