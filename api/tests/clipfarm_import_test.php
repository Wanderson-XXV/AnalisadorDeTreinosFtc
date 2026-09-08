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

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clipfarm_import_test_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../clipfarm_import_lib.php';

assertTrue(
    clipFarmExtractEventId('https://www.clipfarm.watch/en/events/cmnqxlbzy0000rv9klfqfpgiq') === 'cmnqxlbzy0000rv9klfqfpgiq',
    'ClipFarm event URL should be normalized to event id'
);
assertTrue(
    rawurldecode(clipFarmTrpcInput(['eventId' => 'abc'], true)) === '{"0":{"json":{"eventId":"abc"}}}',
    'ClipFarm batch input should keep tRPC numeric object key'
);

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
    ) VALUES
        ('ross-q1', ?, 'qualification', 1, 'Q1', 14270, 23840, 32240, 4848, 'completed', ?, ?),
        ('ross-m1', ?, 'elimination', 1, 'M1', 14270, 3565, 15993, 11212, 'completed', ?, ?)
")->execute([$championshipId, $now, $now, $championshipId, $now, $now]);

$event = [
    'id' => 'cmnqxlbzy0000rv9klfqfpgiq',
    'name' => '2026 FIRST World Championships',
    'ftcScoutSeason' => 2025,
    'divisions' => [
        [
            'id' => 'ross-div',
            'name' => 'Ross',
            'ftcScoutEventCode' => 'FTCCMP1ROSS',
        ],
    ],
];

$matches = [
    [
        'id' => 'ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1ROSS-1',
        'number' => 1,
        'type' => 'qualification',
        'divisionId' => 'ross-div',
        'red' => [14270, 23840],
        'blue' => [32240, 4848],
        'clips' => [
            [
                'id' => 'clip-q1',
                'title' => 'Q1',
                'type' => 'youtube',
                'url' => 'https://youtu.be/1IK6fEby1sg?si=hndsw8daAG-prEN4',
                'duration' => 0,
            ],
        ],
    ],
    [
        'id' => 'ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1ROSS-21001',
        'number' => 21001,
        'type' => 'playoff',
        'divisionId' => 'ross-div',
        'red' => [14270, 3565, 7149],
        'blue' => [15993, 11212, 27188],
        'clips' => [
            [
                'id' => 'clip-m1',
                'title' => 'M1',
                'type' => 'youtube',
                'url' => 'https://youtu.be/b3AAF5vQSho?si=3ioA6GqutNaLIiAw',
                'duration' => 0,
            ],
        ],
    ],
];

$dryRun = importClipFarmMatches($db, $event, $matches, ['dry_run' => true, 'event_code' => 'FTCCMP1ROSS']);
assertTrue($dryRun['summary']['matches_found'] === 2, 'dry run should inspect both Ross matches');
assertTrue($dryRun['summary']['matched'] === 2, 'dry run should match qualification and normalized playoff');
assertTrue($dryRun['summary']['media_created'] === 2, 'dry run should preview two new media records');
assertTrue($dryRun['summary']['media_updated'] === 0, 'dry run should not update existing media');

$existingMedia = fetchOne($db, "SELECT COUNT(*) AS total FROM match_media");
assertTrue((int)$existingMedia['total'] === 0, 'dry run must not write media rows');

$result = importClipFarmMatches($db, $event, $matches, ['event_code' => 'FTCCMP1ROSS']);
assertTrue($result['success'] === true, 'import should succeed');
assertTrue($result['summary']['matched'] === 2, 'import should match both rows');
assertTrue($result['summary']['media_created'] === 2, 'import should create two media rows');

$q1 = fetchOne($db, "SELECT * FROM match_media WHERE match_id = 'ross-q1'");
assertTrue((bool)$q1, 'qualification media should be created');
assertTrue($q1['source_type'] === 'youtube', 'youtube URL should be normalized as youtube source');
assertTrue($q1['external_provider'] === 'clipfarm', 'media should record ClipFarm as provider');
assertTrue($q1['external_match_id'] === 'ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1ROSS-1', 'media should keep ClipFarm match id');
assertTrue($q1['external_clip_id'] === 'clip-q1', 'media should keep ClipFarm clip id');
assertTrue($q1['file_path'] === 'https://youtu.be/1IK6fEby1sg?si=hndsw8daAG-prEN4', 'file_path should preserve the external URL for current UI compatibility');
assertTrue($q1['thumbnail_url'] === 'https://img.youtube.com/vi/1IK6fEby1sg/mqdefault.jpg', 'youtube thumbnail should be inferred');
assertTrue(json_decode($q1['tagged_teams'], true) === [14270, 23840, 32240, 4848], 'tagged teams should include match teams');

$playoff = fetchOne($db, "SELECT * FROM matches WHERE id = 'ross-m1'");
assertTrue((int)$playoff['source_match_number'] === 21001, 'normalized local playoff should keep raw ClipFarm/FTCScout number');
assertTrue($playoff['source_match_id'] === 'ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1ROSS-21001', 'match should keep raw external match id');

$repeat = importClipFarmMatches($db, $event, $matches, ['event_code' => 'FTCCMP1ROSS']);
assertTrue($repeat['summary']['media_created'] === 0, 'repeat import should not duplicate media');
assertTrue($repeat['summary']['media_updated'] === 2, 'repeat import should update existing media');

$mediaCount = fetchOne($db, "SELECT COUNT(*) AS total FROM match_media");
assertTrue((int)$mediaCount['total'] === 2, 'repeat import should keep media count stable');

@unlink($tmpDb);
echo "clipfarm_import_test passed\n";
