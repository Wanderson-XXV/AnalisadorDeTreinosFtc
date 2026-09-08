<?php
require_once 'config.php';
require_once 'comparison_profiles_lib.php';

$db = getDB();
$championshipId = $_GET['championship_id'] ?? null;
$includeChildren = ($_GET['include_children'] ?? '0') === '1';

$stmtTeams = $db->query("SELECT * FROM teams ORDER BY team_number ASC");
$teams = $stmtTeams->fetchAll();

if (empty($teams)) {
    jsonResponse(['teams' => []]);
}

$where = ["sr.is_locked = 0"];
$params = [];
appendChampionshipScopeFilter($db, $where, $params, $championshipId, $includeChildren, 'm.championship_id');

$stmtRounds = $db->prepare("
    SELECT sr.team_number, sr.id as round_id
    FROM scouting_rounds sr
    INNER JOIN matches m ON m.id = sr.match_id
    WHERE " . implode(' AND ', $where) . "
");
$stmtRounds->execute($params);
$rounds = $stmtRounds->fetchAll();

if (empty($rounds)) {
    jsonResponse(['teams' => []]);
}

$roundIds = array_column($rounds, 'round_id');
$placeholders = implode(',', array_fill(0, count($roundIds), '?'));

$stmtCycles = $db->prepare("
    SELECT scouting_round_id, is_autonomous, hits, misses, duration, zone
    FROM scouting_cycles
    WHERE scouting_round_id IN ($placeholders)
");
$stmtCycles->execute($roundIds);
$allCycles = $stmtCycles->fetchAll();

$cyclesByRound = [];
foreach ($allCycles as $c) {
    $cyclesByRound[$c['scouting_round_id']][] = $c;
}

$roundsByTeam = [];
foreach ($rounds as $r) {
    $roundsByTeam[$r['team_number']][] = [
        'round_id' => $r['round_id'],
        'cycles'   => $cyclesByRound[$r['round_id']] ?? [],
    ];
}

$result = [];
foreach ($teams as $team) {
    $tn = $team['team_number'];
    $teamRounds = $roundsByTeam[$tn] ?? [];

    if (empty($teamRounds)) continue;

    $totalScores  = [];
    $autoScores   = [];
    $teleopScores = [];
    $hitRates     = [];
    $comparisonRounds = [];

    foreach ($teamRounds as $rd) {
        $cycles = $rd['cycles'];
        $autoHits   = 0; $autoMisses   = 0;
        $teleopHits = 0; $teleopMisses = 0;
        $totalDuration = 0;

        foreach ($cycles as $c) {
            $totalDuration += (float)($c['duration'] ?? 0);
            if ($c['is_autonomous']) {
                $autoHits   += $c['hits'];
                $autoMisses += $c['misses'];
            } else {
                $teleopHits   += $c['hits'];
                $teleopMisses += $c['misses'];
            }
        }

        $total    = $autoHits + $teleopHits;
        $attempts = $total + $autoMisses + $teleopMisses;

        $totalScores[]  = $total;
        $autoScores[]   = $autoHits;
        $teleopScores[] = $teleopHits;
        $hitRates[]     = $attempts > 0 ? ($total / $attempts) * 100 : 0;
        if (!empty($cycles)) {
            $comparisonRounds[] = [
                'cycles_count' => count($cycles),
                'total_hits' => $total,
                'total_misses' => $autoMisses + $teleopMisses,
                'total_duration' => $totalDuration,
                'auto_hits' => $autoHits,
                'teleop_hits' => $teleopHits,
            ];
        }
    }

    $count = count($totalScores);
    $avg   = array_sum($totalScores) / $count;

    $variance = 0;
    foreach ($totalScores as $s) {
        $variance += ($s - $avg) ** 2;
    }
    $stddev = $count > 1 ? sqrt($variance / $count) : 0;
    $consistency = max(0, 100 - ($avg > 0 ? ($stddev / $avg) * 100 : 0));

    $result[] = [
        'team_number'    => $tn,
        'team_name'      => $team['team_name'],
        'logo_url'       => $team['logo_url'],
        'logo_position'  => $team['logo_position'],
        'matches_scouted'=> $count,
        'avg_score'      => round($avg, 2),
        'max_score'      => max($totalScores),
        'avg_auto'       => round(array_sum($autoScores)   / $count, 2),
        'max_auto'       => max($autoScores),
        'avg_teleop'     => round(array_sum($teleopScores) / $count, 2),
        'max_teleop'     => max($teleopScores),
        'avg_hit_rate'   => round(array_sum($hitRates) / $count, 2),
        'consistency'    => round($consistency, 2),
        'scores'         => $totalScores,
        'comparison_metrics' => summarizeComparisonRounds($comparisonRounds),
    ];
}

jsonResponse(['teams' => $result]);
