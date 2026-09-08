<?php

function teamSeasonLabel(?string $season): string {
    $value = trim((string)$season);
    if (preg_match('/^\d{4}$/', $value)) {
        return $value . '–' . ((int)$value + 1);
    }
    return $value !== '' ? $value : 'Sem temporada';
}

function teamProfileChampionshipMap(PDO $db): array {
    $rows = $db->query("SELECT * FROM championships")->fetchAll();
    $map = [];
    foreach ($rows as $row) $map[$row['id']] = $row;
    return $map;
}

function teamProfileRootId(?string $championshipId, array $map): ?string {
    if (!$championshipId || !isset($map[$championshipId])) return $championshipId;
    $current = $map[$championshipId];
    $seen = [];
    while (!empty($current['parent_id']) && isset($map[$current['parent_id']]) && !isset($seen[$current['id']])) {
        $seen[$current['id']] = true;
        $current = $map[$current['parent_id']];
    }
    return $current['id'];
}

function teamProfileMatchCondition(string $alias = 'm'): string {
    return "({$alias}.red_team1_number = ? OR {$alias}.red_team2_number = ? OR {$alias}.red_team3_number = ? OR {$alias}.blue_team1_number = ? OR {$alias}.blue_team2_number = ? OR {$alias}.blue_team3_number = ?)";
}

function buildTeamCareer(PDO $db, int $teamNumber): array {
    $championships = teamProfileChampionshipMap($db);
    $events = [];

    $ensure = function (?string $championshipId) use (&$events, $championships): array {
        $rootId = teamProfileRootId($championshipId, $championships);
        $root = $rootId && isset($championships[$rootId]) ? $championships[$rootId] : null;
        $context = $championshipId && isset($championships[$championshipId]) ? $championships[$championshipId] : null;
        $key = $rootId ?: '__unassigned__';
        if (!isset($events[$key])) {
            $season = $root['season'] ?? null;
            $events[$key] = [
                'id' => $rootId,
                'name' => $root['name'] ?? 'Sem campeonato',
                'short_name' => $root['short_name'] ?? null,
                'season' => $season,
                'season_label' => teamSeasonLabel($season),
                'starts_at' => $root['starts_at'] ?? $context['starts_at'] ?? null,
                'ends_at' => $root['ends_at'] ?? $context['ends_at'] ?? null,
                'location' => $root['location'] ?? $context['location'] ?? null,
                'registered' => false,
                'matches_count' => 0,
                'scouted_matches_count' => 0,
                'media_count' => 0,
                'divisions' => [],
            ];
        }
        if (empty($events[$key]['starts_at']) && !empty($context['starts_at'])) $events[$key]['starts_at'] = $context['starts_at'];
        if (empty($events[$key]['ends_at']) && !empty($context['ends_at'])) $events[$key]['ends_at'] = $context['ends_at'];
        if (empty($events[$key]['location']) && !empty($context['location'])) $events[$key]['location'] = $context['location'];
        return [$key, $rootId];
    };

    $division = function (string $eventKey, ?string $championshipId) use (&$events, $championships): string {
        $key = $championshipId ?: '__unassigned__';
        if (!isset($events[$eventKey]['divisions'][$key])) {
            $item = $championshipId && isset($championships[$championshipId]) ? $championships[$championshipId] : null;
            $events[$eventKey]['divisions'][$key] = [
                'id' => $championshipId,
                'name' => $item['name'] ?? 'Sem divisão',
                'short_name' => $item['short_name'] ?? null,
                'scope_type' => $item['scope_type'] ?? 'standalone',
                'registered' => false,
                'matches_count' => 0,
                'scouted_matches_count' => 0,
                'media_count' => 0,
            ];
        }
        return $key;
    };

    $stmt = $db->prepare("SELECT championship_id FROM championship_teams WHERE team_number = ?");
    $stmt->execute([$teamNumber]);
    foreach ($stmt->fetchAll() as $row) {
        [$eventKey] = $ensure($row['championship_id']);
        $divisionKey = $division($eventKey, $row['championship_id']);
        $events[$eventKey]['registered'] = true;
        $events[$eventKey]['divisions'][$divisionKey]['registered'] = true;
    }

    $stmt = $db->prepare("SELECT m.championship_id, COUNT(DISTINCT m.id) matches_count,
        COUNT(DISTINCT CASE WHEN sr.id IS NOT NULL THEN m.id END) scouted_matches_count
        FROM matches m
        LEFT JOIN scouting_rounds sr ON sr.match_id = m.id AND sr.team_number = ?
        WHERE " . teamProfileMatchCondition('m') . "
        GROUP BY m.championship_id");
    $stmt->execute(array_fill(0, 7, $teamNumber));
    foreach ($stmt->fetchAll() as $row) {
        [$eventKey] = $ensure($row['championship_id']);
        $divisionKey = $division($eventKey, $row['championship_id']);
        foreach (['matches_count', 'scouted_matches_count'] as $field) {
            $value = (int)$row[$field];
            $events[$eventKey][$field] += $value;
            $events[$eventKey]['divisions'][$divisionKey][$field] += $value;
        }
    }

    $stmt = $db->prepare("SELECT m.championship_id, COUNT(DISTINCT mm.id) media_count
        FROM match_media mm INNER JOIN matches m ON m.id = mm.match_id
        WHERE EXISTS (
            SELECT 1 FROM json_each(CASE WHEN json_valid(mm.tagged_teams) THEN mm.tagged_teams ELSE '[]' END)
            WHERE CAST(json_each.value AS INTEGER) = ?
        ) AND NOT (mm.file_type = 'video' AND mm.category = 'full_match')
        GROUP BY m.championship_id");
    $stmt->execute([$teamNumber]);
    foreach ($stmt->fetchAll() as $row) {
        [$eventKey] = $ensure($row['championship_id']);
        $divisionKey = $division($eventKey, $row['championship_id']);
        $value = (int)$row['media_count'];
        $events[$eventKey]['media_count'] += $value;
        $events[$eventKey]['divisions'][$divisionKey]['media_count'] += $value;
    }

    $seasons = [];
    foreach ($events as $event) {
        $event['divisions'] = array_values($event['divisions']);
        usort($event['divisions'], fn($a, $b) => strcasecmp($a['short_name'] ?: $a['name'], $b['short_name'] ?: $b['name']));
        $seasonKey = trim((string)$event['season']) ?: '__unknown__';
        if (!isset($seasons[$seasonKey])) {
            $seasons[$seasonKey] = [
                'season' => $event['season'],
                'label' => $event['season_label'],
                'events' => [],
                'events_count' => 0,
                'matches_count' => 0,
                'scouted_matches_count' => 0,
                'media_count' => 0,
            ];
        }
        $seasons[$seasonKey]['events'][] = $event;
        $seasons[$seasonKey]['events_count']++;
        $seasons[$seasonKey]['matches_count'] += $event['matches_count'];
        $seasons[$seasonKey]['scouted_matches_count'] += $event['scouted_matches_count'];
        $seasons[$seasonKey]['media_count'] += $event['media_count'];
    }
    foreach ($seasons as &$season) {
        usort($season['events'], fn($a, $b) => strcmp((string)($a['starts_at'] ?? '9999'), (string)($b['starts_at'] ?? '9999')) ?: strcasecmp($a['name'], $b['name']));
    }
    unset($season);
    uasort($seasons, fn($a, $b) => strcmp((string)($b['season'] ?? ''), (string)($a['season'] ?? '')));

    $seasonValues = array_values($seasons);
    return [
        'seasons' => $seasonValues,
        'summary' => [
            'seasons_count' => count($seasonValues),
            'events_count' => array_sum(array_column($seasonValues, 'events_count')),
            'matches_count' => array_sum(array_column($seasonValues, 'matches_count')),
            'scouted_matches_count' => array_sum(array_column($seasonValues, 'scouted_matches_count')),
            'media_count' => array_sum(array_column($seasonValues, 'media_count')),
        ],
    ];
}

function buildTeamDirectory(PDO $db, ?string $season, ?string $championshipId, bool $hasScout): array {
    $championships = teamProfileChampionshipMap($db);
    $scopeIds = $championshipId ? getChampionshipScopeIds($db, $championshipId, true) : [];
    $teams = [];
    foreach ($db->query("SELECT * FROM teams ORDER BY team_number")->fetchAll() as $team) {
        $number = (int)$team['team_number'];
        $teams[$number] = array_merge($team, [
            'incomplete' => false, 'latest_season' => null, 'latest_season_label' => null,
            'events_count' => 0, 'matches_count' => 0, 'scouted_matches_count' => 0,
            'registered' => false,
        ]);
    }

    $sql = "SELECT championship_id, team_number, MAX(team_name) team_name,
        MAX(registered) registered, SUM(had_match) had_match, SUM(had_scout) had_scout
        FROM (
            SELECT championship_id, team_number, NULL team_name, 1 registered, 0 had_match, 0 had_scout FROM championship_teams
            UNION ALL SELECT m.championship_id, m.red_team1_number, m.red_team1_name, 0, 1, EXISTS(SELECT 1 FROM scouting_rounds sr WHERE sr.match_id=m.id AND sr.team_number=m.red_team1_number) FROM matches m
            UNION ALL SELECT m.championship_id, m.red_team2_number, m.red_team2_name, 0, 1, EXISTS(SELECT 1 FROM scouting_rounds sr WHERE sr.match_id=m.id AND sr.team_number=m.red_team2_number) FROM matches m
            UNION ALL SELECT m.championship_id, m.red_team3_number, m.red_team3_name, 0, 1, EXISTS(SELECT 1 FROM scouting_rounds sr WHERE sr.match_id=m.id AND sr.team_number=m.red_team3_number) FROM matches m
            UNION ALL SELECT m.championship_id, m.blue_team1_number, m.blue_team1_name, 0, 1, EXISTS(SELECT 1 FROM scouting_rounds sr WHERE sr.match_id=m.id AND sr.team_number=m.blue_team1_number) FROM matches m
            UNION ALL SELECT m.championship_id, m.blue_team2_number, m.blue_team2_name, 0, 1, EXISTS(SELECT 1 FROM scouting_rounds sr WHERE sr.match_id=m.id AND sr.team_number=m.blue_team2_number) FROM matches m
            UNION ALL SELECT m.championship_id, m.blue_team3_number, m.blue_team3_name, 0, 1, EXISTS(SELECT 1 FROM scouting_rounds sr WHERE sr.match_id=m.id AND sr.team_number=m.blue_team3_number) FROM matches m
        ) p WHERE team_number IS NOT NULL AND team_number > 0 GROUP BY championship_id, team_number";

    $eventSets = [];
    foreach ($db->query($sql)->fetchAll() as $row) {
        $number = (int)$row['team_number'];
        $champId = $row['championship_id'];
        $champ = $champId && isset($championships[$champId]) ? $championships[$champId] : null;
        $rowSeason = $champ['season'] ?? null;
        if ($season !== null && $season !== '' && (string)$rowSeason !== (string)$season) continue;
        if ($championshipId && !in_array($champId, $scopeIds, true)) continue;
        if (!isset($teams[$number])) {
            $teams[$number] = [
                'id' => null, 'team_number' => $number, 'team_name' => $row['team_name'] ?: 'Equipe sem cadastro',
                'logo_url' => null, 'logo_position' => 'center', 'instagram' => null,
                'incomplete' => true, 'latest_season' => null, 'latest_season_label' => null,
                'events_count' => 0, 'matches_count' => 0, 'scouted_matches_count' => 0, 'registered' => false,
            ];
        }
        if ($hasScout && !(int)$row['had_scout']) continue;
        $rootId = teamProfileRootId($champId, $championships) ?: '__unassigned__';
        $eventSets[$number][$rootId] = true;
        $teams[$number]['matches_count'] += (int)$row['had_match'];
        $teams[$number]['scouted_matches_count'] += (int)$row['had_scout'];
        $teams[$number]['registered'] = $teams[$number]['registered'] || (bool)$row['registered'];
        if ($rowSeason !== null && ($teams[$number]['latest_season'] === null || strcmp((string)$rowSeason, (string)$teams[$number]['latest_season']) > 0)) {
            $teams[$number]['latest_season'] = (string)$rowSeason;
            $teams[$number]['latest_season_label'] = teamSeasonLabel((string)$rowSeason);
        }
    }

    foreach ($teams as $number => &$team) $team['events_count'] = count($eventSets[$number] ?? []);
    unset($team);
    if ($season !== null || $championshipId || $hasScout) {
        $teams = array_filter($teams, fn($team) => $team['events_count'] > 0);
    }
    ksort($teams, SORT_NUMERIC);
    return array_values($teams);
}
