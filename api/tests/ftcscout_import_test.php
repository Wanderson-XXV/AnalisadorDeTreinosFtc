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

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_import_test_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../ftcscout_import_lib.php';

$db = getDB();

$payload = [
    'events_json' => json_encode([
        [
            'season' => 2025,
            'code' => 'FTCCMP1',
            'divisionCode' => null,
            'name' => 'FIRST World Championship - Finals Division',
            'type' => 'FIRSTChampionship',
            'timezone' => 'America/Chicago',
            'start' => '2026-04-29',
            'end' => '2026-05-02',
            'city' => 'Houston',
            'state' => 'TX',
            'country' => 'USA',
        ],
        [
            'season' => 2025,
            'code' => 'FTCCMP1EDIS',
            'divisionCode' => 'FTCCMP1',
            'name' => 'FIRST World Championship - Edison Division',
            'type' => 'FIRSTChampionship',
            'timezone' => 'America/Chicago',
            'start' => '2026-04-29',
            'end' => '2026-05-02',
        ],
    ]),
    'teams_json' => json_encode([
        ['season' => 2025, 'eventCode' => 'FTCCMP1EDIS', 'teamNumber' => 23055, 'stats' => ['rank' => 1]],
        ['season' => 2025, 'eventCode' => 'FTCCMP1EDIS', 'teamNumber' => 9999, 'stats' => null],
    ]),
    'team_details_json' => json_encode([
        ['number' => 23055, 'name' => 'Tech Fenix'],
    ]),
    'matches_json' => json_encode([
        [
            'eventSeason' => 2025,
            'eventCode' => 'FTCCMP1EDIS',
            'id' => 1,
            'hasBeenPlayed' => true,
            'scheduledStartTime' => '2026-04-30T14:00:00.000Z',
            'actualStartTime' => '2026-04-30T14:10:02.200Z',
            'tournamentLevel' => 'Quals',
            'scores' => [
                'red' => ['autoPoints' => 99, 'dcPoints' => 88, 'totalPoints' => 300],
                'blue' => ['autoPoints' => 77, 'dcPoints' => 66, 'totalPoints' => 200],
            ],
            'teams' => [
                ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 23055, 'onField' => true],
                ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 9999, 'onField' => true],
                ['alliance' => 'Red', 'station' => 'NotOnField', 'teamNumber' => 11111, 'onField' => false],
                ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 22222, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 33333, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'NotOnField', 'teamNumber' => 44444, 'onField' => false],
            ],
        ],
        [
            'eventSeason' => 2025,
            'eventCode' => 'FTCCMP1EDIS',
            'id' => 2,
            'hasBeenPlayed' => true,
            'scheduledStartTime' => '2026-04-30T14:06:30.000Z',
            'tournamentLevel' => 'Quals',
            'teams' => [
                ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 23055, 'onField' => true],
                ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 9999, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 22222, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 33333, 'onField' => false, 'noShow' => true],
            ],
        ],
        [
            'eventSeason' => 2025,
            'eventCode' => 'FTCCMP1EDIS',
            'id' => 21001,
            'hasBeenPlayed' => true,
            'scheduledStartTime' => '2026-05-02T14:30:00.000Z',
            'tournamentLevel' => 'DoubleElim',
            'series' => 1,
            'teams' => [
                ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 23055, 'onField' => true],
                ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 9999, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 22222, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 33333, 'onField' => true],
            ],
        ],
        [
            'eventSeason' => 2025,
            'eventCode' => 'FTCCMP1EDIS',
            'id' => 22001,
            'hasBeenPlayed' => true,
            'scheduledStartTime' => '2026-05-02T14:36:00.000Z',
            'tournamentLevel' => 'DoubleElim',
            'series' => 2,
            'teams' => [
                ['alliance' => 'Red', 'station' => 'One', 'teamNumber' => 22222, 'onField' => true],
                ['alliance' => 'Red', 'station' => 'Two', 'teamNumber' => 33333, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'One', 'teamNumber' => 23055, 'onField' => true],
                ['alliance' => 'Blue', 'station' => 'Two', 'teamNumber' => 9999, 'onField' => true],
            ],
        ],
    ]),
    'dry_run' => false,
    'auto_enrich' => false,
];

$result = importFtcScoutManualJson($db, $payload);
assertTrue($result['success'] === true, 'import should succeed');
assertTrue($result['summary']['events']['created'] === 3, 'group, final and division should be created');
assertTrue($result['summary']['matches']['created'] === 4, 'qualification and playoff matches should be imported');
assertTrue($result['summary']['matches']['ignored_scores'] === 1, 'official alliance scores should be ignored');
assertTrue($result['summary']['matches']['off_field_teams'] === 3, 'off-field and no-show teams should be counted');
assertTrue($result['summary']['matches']['no_show_teams'] === 1, 'no-show teams should be counted');
assertTrue(count($result['preview']['matches']) === 4, 'preview should list imported matches');
assertTrue($result['preview']['matches'][1]['issues'][0] === '33333 nao apresentou', 'preview should show no-show issue');
assertTrue($result['preview']['matches'][2]['display_name'] === 'M1', 'preview should display first playoff as M1');
assertTrue($result['preview']['matches'][3]['display_name'] === 'M2', 'preview should display second playoff as M2');

$group = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1:GROUP'");
assertTrue((bool)$group, 'synthetic parent group should exist');

$final = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1' AND scope_type = 'final'");
assertTrue((bool)$final, 'FTCCMP1 should be a playable final scope');
assertTrue($final['parent_id'] === $group['id'], 'final should be nested under the synthetic parent group');

$division = fetchOne($db, "SELECT * FROM championships WHERE event_code = 'FTCCMP1EDIS' AND scope_type = 'division'");
assertTrue((bool)$division, 'division should be created');
assertTrue($division['parent_id'] === $group['id'], 'division should be nested under the synthetic parent group');

$team = fetchOne($db, "SELECT * FROM teams WHERE team_number = 23055");
assertTrue($team['team_name'] === 'Tech Fenix', 'provided team details should name the team');

$placeholder = fetchOne($db, "SELECT * FROM teams WHERE team_number = 9999");
assertTrue($placeholder['team_name'] === 'Equipe #9999', 'missing team details should create a safe placeholder');

$match = fetchOne($db, "SELECT * FROM matches WHERE championship_id = ? AND match_number = 1", [$division['id']]);
assertTrue((bool)$match, 'match should be linked to the imported division');
assertTrue((int)$match['red_team1_number'] === 23055, 'red on-field team one should be imported');
assertTrue((int)$match['red_team2_number'] === 9999, 'red on-field team two should be imported');
assertTrue((int)$match['blue_team1_number'] === 22222, 'blue on-field team one should be imported');
assertTrue((int)$match['blue_team2_number'] === 33333, 'blue on-field team two should be imported');
assertTrue((int)$match['red_score_auto'] === 0, 'official red auto score must not be imported');
assertTrue((int)$match['red_score_teleop'] === 0, 'official red teleop score must not be imported');
assertTrue((int)$match['red_total'] === 0, 'official red total score must not be imported');
assertTrue((int)$match['blue_total'] === 0, 'official blue total score must not be imported');

$noShowMatch = fetchOne($db, "SELECT * FROM matches WHERE championship_id = ? AND match_number = 2", [$division['id']]);
assertTrue((bool)$noShowMatch, 'no-show match should still be imported');
assertTrue((int)$noShowMatch['blue_team2_number'] === 33333, 'no-show team should keep its expected slot');
assertTrue(strpos($noShowMatch['notes'], '33333 nao apresentou') !== false, 'no-show should be visible in match notes');

$playoffOne = fetchOne($db, "SELECT * FROM matches WHERE championship_id = ? AND match_type = 'elimination' AND match_number = 1", [$division['id']]);
assertTrue((bool)$playoffOne, 'first playoff match should use the bracket series as match number');
assertTrue($playoffOne['display_name'] === 'M1', 'first playoff match should display as M1');

$playoffTwo = fetchOne($db, "SELECT * FROM matches WHERE championship_id = ? AND match_type = 'elimination' AND match_number = 2", [$division['id']]);
assertTrue((bool)$playoffTwo, 'second playoff match should use the bracket series as match number');
assertTrue($playoffTwo['display_name'] === 'M2', 'second playoff match should display as M2');

$repeat = importFtcScoutManualJson($db, $payload);
assertTrue($repeat['summary']['events']['updated'] === 3, 'repeat import should update existing event scopes');
assertTrue($repeat['summary']['matches']['updated'] === 4, 'repeat import should update the same matches instead of duplicating');

$matchCount = fetchOne($db, "SELECT COUNT(*) AS total FROM matches WHERE championship_id = ?", [$division['id']]);
assertTrue((int)$matchCount['total'] === 4, 'repeat import should not duplicate matches');

@unlink($tmpDb);
echo "ftcscout_import_test passed\n";
