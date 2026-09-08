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

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'external_media_test_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../clipfarm_import_lib.php';

$db = getDB();
$now = date('c');

$championshipId = 'ross-division';
$db->prepare("
    INSERT INTO championships (id, parent_id, name, short_name, season, event_code, scope_type, status, created_at, updated_at)
    VALUES (?, NULL, 'Ross', 'Ross', '2025', 'FTCCMP1ROSS', 'division', 'active', ?, ?)
")->execute([$championshipId, $now, $now]);

$db->prepare("
    INSERT INTO matches (
        id, championship_id, match_type, match_number, display_name,
        red_team1_number, red_team2_number, blue_team1_number, blue_team2_number,
        status, created_at, updated_at
    ) VALUES (?, ?, 'qualification', 7, 'Q7', 14270, 23840, 32240, 4848, 'completed', ?, ?)
")->execute(['ross-q7', $championshipId, $now, $now]);

$payload = [
    'match_id' => 'ross-q7',
    'url' => 'https://www.youtube.com/watch?v=1IK6fEby1sg',
    'title' => 'Q7 manual',
    'category' => 'full_match',
    'uploaded_by' => 'operator',
    'video_match_start_ms' => 12345,
];

$created = saveExternalMatchMedia($db, $payload);
assertTrue($created['source_type'] === 'youtube', 'manual YouTube link should be saved as youtube media');
assertTrue($created['external_provider'] === 'manual', 'manual links should keep manual provider');
assertTrue($created['file_path'] === $payload['url'], 'file_path should keep URL for current UI compatibility');
assertTrue($created['category'] === 'full_match', 'manual link should keep category');
assertTrue($created['thumbnail_url'] === 'https://img.youtube.com/vi/1IK6fEby1sg/mqdefault.jpg', 'youtube thumbnail should be inferred');
assertTrue((int)$created['video_match_start_ms'] === 12345, 'manual link should keep optional match-start offset');
assertTrue(json_decode($created['tagged_teams'], true) === [14270, 23840, 32240, 4848], 'manual link should default to the four match teams');

$repeat = saveExternalMatchMedia($db, [
    'match_id' => 'ross-q7',
    'url' => 'https://www.youtube.com/watch?v=1IK6fEby1sg',
    'title' => 'Q7 manual updated',
    'category' => 'full_match',
    'video_match_start_ms' => 20000,
]);

$mediaCount = fetchOne($db, "SELECT COUNT(*) AS total FROM match_media WHERE match_id = 'ross-q7'");
assertTrue((int)$mediaCount['total'] === 1, 're-saving the same manual URL should update instead of duplicate');
assertTrue($repeat['title'] === 'Q7 manual updated', 'repeat manual save should update metadata');
assertTrue((int)$repeat['video_match_start_ms'] === 20000, 'repeat manual save should update explicit offset');

@unlink($tmpDb);
echo "external_media_test passed\n";
