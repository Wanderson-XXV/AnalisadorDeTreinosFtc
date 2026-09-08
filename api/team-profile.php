<?php
require_once 'config.php';
require_once 'team_profile_lib.php';

$teamNumber = intval($_GET['team_number'] ?? 0);
$championshipId = $_GET['championship_id'] ?? null;
$includeChildren = ($_GET['include_children'] ?? '0') === '1';
if (!$teamNumber) jsonError('team_number obrigatório', 400);

$db = getDB();

$stmt = $db->prepare("SELECT * FROM teams WHERE team_number = ?");
$stmt->execute([$teamNumber]);
$team = $stmt->fetch() ?: null;

if (!$team) {
    $stmt = $db->prepare("SELECT CASE
        WHEN red_team1_number = ? THEN red_team1_name WHEN red_team2_number = ? THEN red_team2_name WHEN red_team3_number = ? THEN red_team3_name
        WHEN blue_team1_number = ? THEN blue_team1_name WHEN blue_team2_number = ? THEN blue_team2_name WHEN blue_team3_number = ? THEN blue_team3_name END team_name
        FROM matches WHERE ? IN (red_team1_number, red_team2_number, red_team3_number, blue_team1_number, blue_team2_number, blue_team3_number)
        ORDER BY COALESCE(actual_start_time, scheduled_time, created_at) DESC LIMIT 1");
    $stmt->execute([$teamNumber, $teamNumber, $teamNumber, $teamNumber, $teamNumber, $teamNumber, $teamNumber]);
    $fallback = $stmt->fetch();
    if ($fallback) {
        $team = [
            'id' => null,
            'team_number' => $teamNumber,
            'team_name' => $fallback['team_name'] ?: 'Equipe sem cadastro',
            'logo_url' => null,
            'logo_position' => 'center',
            'instagram' => null,
            'incomplete' => true,
        ];
    }
}

$career = buildTeamCareer($db, $teamNumber);

$where = [
    "(m.red_team1_number = ? OR m.red_team2_number = ? OR m.red_team3_number = ? OR m.blue_team1_number = ? OR m.blue_team2_number = ? OR m.blue_team3_number = ?)"
];
$params = [$teamNumber, $teamNumber, $teamNumber, $teamNumber, $teamNumber, $teamNumber];
appendChampionshipScopeFilter($db, $where, $params, $championshipId, $includeChildren, 'm.championship_id');

$stmt = $db->prepare("
    SELECT m.*, COALESCE(parent.timezone, c.timezone) AS championship_timezone, c.alliance_size,
        (SELECT COALESCE(mm.thumbnail_path, mm.thumbnail_url)
         FROM match_media mm
         WHERE mm.match_id = m.id AND mm.file_type = 'video' AND COALESCE(mm.thumbnail_path, mm.thumbnail_url) IS NOT NULL
         ORDER BY mm.uploaded_at ASC LIMIT 1) AS first_video_thumb
    FROM matches m
    LEFT JOIN championships c ON c.id = m.championship_id
    LEFT JOIN championships parent ON parent.id = c.parent_id
    WHERE " . implode(' AND ', $where) . "
    ORDER BY m.match_type ASC, m.match_number ASC
");
$stmt->execute($params);
$matches = $stmt->fetchAll();

if (!empty($matches)) {
    $matchIds = array_column($matches, 'id');
    $placeholders = implode(',', array_fill(0, count($matchIds), '?'));

    $stmtR = $db->prepare("
        SELECT sr.*, s.username as scout_username
        FROM scouting_rounds sr
        LEFT JOIN scouts s ON sr.scout_id = s.id
        WHERE sr.match_id IN ($placeholders)
        ORDER BY sr.team_number ASC
    ");
    $stmtR->execute($matchIds);
    $allRounds = $stmtR->fetchAll();

    $roundIds = array_column($allRounds, 'id');
    $cyclesByRound = [];
    if (!empty($roundIds)) {
        $cPlaceholders = implode(',', array_fill(0, count($roundIds), '?'));
        $stmtC = $db->prepare("SELECT * FROM scouting_cycles WHERE scouting_round_id IN ($cPlaceholders) ORDER BY cycle_number ASC");
        $stmtC->execute($roundIds);
        $allCycles = $stmtC->fetchAll();
        foreach ($allCycles as $c) {
            $cyclesByRound[$c['scouting_round_id']][] = $c;
        }
        foreach ($allRounds as &$r) {
            $r['cycles'] = $cyclesByRound[$r['id']] ?? [];
        }
        unset($r);
    }

    $roundsByMatch = [];
    foreach ($allRounds as $r) {
        $roundsByMatch[$r['match_id']][] = $r;
    }

    foreach ($matches as &$m) {
        $m['scouting_rounds'] = $roundsByMatch[$m['id']] ?? [];
    }
    unset($m);
}

$mediaWhere = ["EXISTS (
    SELECT 1 FROM json_each(CASE WHEN json_valid(mm.tagged_teams) THEN mm.tagged_teams ELSE '[]' END)
    WHERE CAST(json_each.value AS INTEGER) = ?
)", "NOT (mm.file_type = 'video' AND mm.category = 'full_match')"];
$mediaParams = [$teamNumber];
appendChampionshipScopeFilter($db, $mediaWhere, $mediaParams, $championshipId, $includeChildren, 'm.championship_id');

$stmtM = $db->prepare("
    SELECT mm.* FROM match_media mm
    INNER JOIN matches m ON m.id = mm.match_id
    WHERE " . implode(' AND ', $mediaWhere) . "
    ORDER BY mm.uploaded_at DESC
");
$stmtM->execute($mediaParams);
$media = $stmtM->fetchAll();

foreach ($media as &$item) {
    if (!empty($item['tagged_teams']) && is_string($item['tagged_teams'])) {
        $decoded = json_decode($item['tagged_teams'], true);
        $item['tagged_teams'] = is_array($decoded) ? $decoded : [];
    }
}
unset($item);

jsonResponse([
    'team' => $team,
    'matches' => $matches,
    'media' => $media,
    'seasons' => $career['seasons'],
    'summary' => $career['summary'],
]);
