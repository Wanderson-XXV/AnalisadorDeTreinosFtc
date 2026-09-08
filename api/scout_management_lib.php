<?php

function scoutManagementNormalizeChampionship(array $row): array {
    $row['sort_order'] = (int)($row['sort_order'] ?? 0);
    $row['alliance_size'] = normalizeAllianceSize($row['alliance_size'] ?? 2);
    return $row;
}

function scoutManagementEmptyTotals(): array {
    return [
        'matches' => 0,
        'pending' => 0,
        'assigned' => 0,
        'in_progress' => 0,
        'done' => 0,
    ];
}

function scoutManagementAddSlot(array &$totals, string $status): void {
    if (array_key_exists($status, $totals)) {
        $totals[$status]++;
    }
}

function scoutManagementScopeIds(PDO $db, array $context, bool $includeChildren): array {
    if (($context['scope_type'] ?? null) !== 'event_group') {
        return [$context['id']];
    }
    return $includeChildren ? getChampionshipScopeIds($db, $context['id'], true) : [$context['id']];
}

function scoutManagementFetchMatches(PDO $db, array $scopeIds): array {
    if (empty($scopeIds)) return [];
    $placeholders = implode(',', array_fill(0, count($scopeIds), '?'));
    $stmt = $db->prepare("
        SELECT m.*, c.name AS championship_name, c.short_name AS championship_short_name,
               c.scope_type AS championship_scope_type, c.sort_order AS championship_sort_order,
               c.alliance_size AS alliance_size
        FROM matches m
        LEFT JOIN championships c ON c.id = m.championship_id
        WHERE m.championship_id IN ($placeholders)
        ORDER BY c.sort_order ASC, m.match_type ASC, m.match_number ASC
    ");
    $stmt->execute($scopeIds);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function scoutManagementFetchSlotState(PDO $db, array $matchIds): array {
    if (empty($matchIds)) return ['rounds' => [], 'assignments' => []];
    $placeholders = implode(',', array_fill(0, count($matchIds), '?'));

    $stmt = $db->prepare("
        SELECT sr.id, sr.match_id, sr.team_number, sr.scout_id, sr.is_locked,
               s.username AS scout_username
        FROM scouting_rounds sr
        LEFT JOIN scouts s ON s.id = sr.scout_id
        WHERE sr.match_id IN ($placeholders)
        ORDER BY sr.start_time DESC
    ");
    $stmt->execute($matchIds);
    $rounds = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $round) {
        $key = $round['match_id'] . '|' . (int)$round['team_number'];
        if (!isset($rounds[$key])) $rounds[$key] = $round;
    }

    $stmt = $db->prepare("
        SELECT sa.id, sa.match_id, sa.team_number, sa.scout_id,
               s.username AS scout_username
        FROM scout_assignments sa
        LEFT JOIN scouts s ON s.id = sa.scout_id
        WHERE sa.match_id IN ($placeholders)
    ");
    $stmt->execute($matchIds);
    $assignments = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $assignment) {
        $assignments[$assignment['match_id'] . '|' . (int)$assignment['team_number']] = $assignment;
    }

    return ['rounds' => $rounds, 'assignments' => $assignments];
}

function scoutManagementMatchSlots(array $match, array $state): array {
    $definitions = matchTeamFieldDefinitions(matchAllianceSize($match));
    $slots = [];
    foreach ($definitions as $definition) {
        $teamNumber = (int)($match[$definition['field']] ?? 0);
        if ($teamNumber <= 0) continue;
        $key = $match['id'] . '|' . $teamNumber;
        $round = $state['rounds'][$key] ?? null;
        $assignment = $state['assignments'][$key] ?? null;
        $status = $round
            ? (!empty($round['is_locked']) ? 'in_progress' : 'done')
            : ($assignment ? 'assigned' : 'pending');
        $scoutId = $round['scout_id'] ?? ($assignment['scout_id'] ?? null);
        $scoutUsername = $round['scout_username'] ?? ($assignment['scout_username'] ?? null);
        $slots[] = [
            'match_id' => $match['id'],
            'team_number' => $teamNumber,
            'team_name' => $match[$definition['name']] ?? null,
            'alliance' => $definition['alliance'],
            'position' => $definition['position'],
            'status' => $status,
            'scout_id' => $scoutId,
            'scout_username' => $scoutUsername,
            'assignment_id' => $assignment['id'] ?? null,
            'round_id' => $round['id'] ?? null,
        ];
    }
    return $slots;
}

function scoutManagementDecorateMatches(array $matches, array $state): array {
    foreach ($matches as &$match) {
        $match['slots'] = scoutManagementMatchSlots($match, $state);
        $pending = count(array_filter($match['slots'], fn($slot) => $slot['status'] === 'pending'));
        $match['coverage'] = $pending === count($match['slots']) ? 'unassigned' : ($pending > 0 ? 'partial' : 'covered');
    }
    unset($match);
    return $matches;
}

function scoutManagementTotals(array $matches): array {
    $totals = scoutManagementEmptyTotals();
    $totals['matches'] = count($matches);
    foreach ($matches as $match) {
        foreach ($match['slots'] as $slot) scoutManagementAddSlot($totals, $slot['status']);
    }
    return $totals;
}

function scoutManagementChildSummaries(PDO $db, array $context, array $matches): array {
    if (($context['scope_type'] ?? null) !== 'event_group') return [];
    $stmt = $db->prepare("
        SELECT * FROM championships
        WHERE parent_id = ? AND scope_type IN ('division', 'final')
        ORDER BY sort_order ASC, name ASC
    ");
    $stmt->execute([$context['id']]);
    $summaries = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $child) {
        $childMatches = array_values(array_filter($matches, fn($match) => $match['championship_id'] === $child['id']));
        $summaries[] = [
            'championship' => scoutManagementNormalizeChampionship($child),
            'totals' => scoutManagementTotals($childMatches),
        ];
    }
    return $summaries;
}

function scoutManagementMatchContains(array $match, string $search): bool {
    if ($search === '') return true;
    $haystack = implode(' ', [
        $match['display_name'] ?? '', $match['match_number'] ?? '',
        $match['red_team1_number'] ?? '', $match['red_team1_name'] ?? '',
        $match['red_team2_number'] ?? '', $match['red_team2_name'] ?? '',
        $match['red_team3_number'] ?? '', $match['red_team3_name'] ?? '',
        $match['blue_team1_number'] ?? '', $match['blue_team1_name'] ?? '',
        $match['blue_team2_number'] ?? '', $match['blue_team2_name'] ?? '',
        $match['blue_team3_number'] ?? '', $match['blue_team3_name'] ?? '',
    ]);
    return stripos($haystack, $search) !== false;
}

function scoutManagementWorkloads(PDO $db, array $matches): array {
    $scouts = $db->query("SELECT id, username, photo_path FROM scouts ORDER BY username ASC")->fetchAll(PDO::FETCH_ASSOC);
    $workloads = [];
    foreach ($scouts as $scout) {
        $counts = ['assigned' => 0, 'in_progress' => 0, 'done' => 0, 'total' => 0];
        $items = [];
        foreach ($matches as $match) {
            foreach ($match['slots'] as $slot) {
                if (($slot['scout_id'] ?? null) !== $scout['id']) continue;
                $counts['total']++;
                if (isset($counts[$slot['status']])) $counts[$slot['status']]++;
                $items[] = [
                    'match_id' => $match['id'],
                    'match_display_name' => $match['display_name'],
                    'championship_name' => $match['championship_short_name'] ?: $match['championship_name'],
                    'team_number' => $slot['team_number'],
                    'team_name' => $slot['team_name'],
                    'status' => $slot['status'],
                ];
            }
        }
        $workloads[] = ['scout' => $scout, 'counts' => $counts, 'items' => $items];
    }
    return $workloads;
}

function getScoutManagementData(PDO $db, array $params): array {
    $championshipId = trim((string)($params['championship_id'] ?? ''));
    if ($championshipId === '') throw new InvalidArgumentException('championship_id e obrigatorio');

    $stmt = $db->prepare("SELECT * FROM championships WHERE id = ?");
    $stmt->execute([$championshipId]);
    $context = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$context) throw new InvalidArgumentException('Campeonato nao encontrado');

    $includeChildren = ($params['include_children'] ?? '0') === '1';
    $scopeIds = scoutManagementScopeIds($db, $context, $includeChildren);
    $matches = scoutManagementFetchMatches($db, $scopeIds);
    $state = scoutManagementFetchSlotState($db, array_column($matches, 'id'));
    $matches = scoutManagementDecorateMatches($matches, $state);

    $totals = scoutManagementTotals($matches);
    $children = scoutManagementChildSummaries($db, $context, $matches);
    $workloads = scoutManagementWorkloads($db, $matches);

    $listMatches = ($context['scope_type'] ?? null) === 'event_group' ? [] : $matches;
    $search = trim((string)($params['search'] ?? ''));
    $matchType = (string)($params['match_type'] ?? 'all');
    $coverage = (string)($params['coverage'] ?? 'all');
    $filtered = array_values(array_filter($listMatches, function ($match) use ($search, $matchType, $coverage) {
        if ($matchType !== 'all' && $match['match_type'] !== $matchType) return false;
        if ($coverage !== 'all' && $match['coverage'] !== $coverage) return false;
        return scoutManagementMatchContains($match, $search);
    }));

    $pageSize = max(1, min(100, (int)($params['page_size'] ?? 20)));
    $totalItems = count($filtered);
    $pageCount = max(1, (int)ceil($totalItems / $pageSize));
    $page = max(1, min($pageCount, (int)($params['page'] ?? 1)));
    $items = array_slice($filtered, ($page - 1) * $pageSize, $pageSize);

    return [
        'context' => scoutManagementNormalizeChampionship($context),
        'totals' => $totals,
        'children' => $children,
        'matches' => [
            'items' => $items,
            'page' => $page,
            'page_size' => $pageSize,
            'total_items' => $totalItems,
            'total_pages' => $pageCount,
        ],
        'workloads' => $workloads,
    ];
}
