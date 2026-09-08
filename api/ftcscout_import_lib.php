<?php

require_once __DIR__ . '/config.php';

function ftcScoutEmptySummary(): array {
    return [
        'events' => ['found' => 0, 'enriched' => 0, 'created' => 0, 'updated' => 0],
        'teams' => [
            'found' => 0,
            'details_provided' => 0,
            'enriched' => 0,
            'created' => 0,
            'updated' => 0,
            'existing' => 0,
            'placeholders' => 0,
        ],
        'enrollments' => ['created' => 0, 'existing' => 0],
        'matches' => [
            'found' => 0,
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'ignored_scores' => 0,
            'off_field_teams' => 0,
            'no_show_teams' => 0,
        ],
    ];
}

function ftcScoutEmptyPreview(): array {
    return [
        'events' => [],
        'teams' => [],
        'matches' => [],
    ];
}

function ftcScoutDecodeFragments(?string $text, string $label): array {
    $text = trim((string)$text);
    if ($text === '') return [];

    $decoded = json_decode($text, true);
    if (json_last_error() === JSON_ERROR_NONE) return [$decoded];

    $fragments = [];
    if (preg_match_all('/```(?:json)?\s*(.*?)```/is', $text, $matches)) {
        foreach ($matches[1] as $index => $block) {
            $block = trim($block);
            if ($block === '') continue;
            $decoded = json_decode($block, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new InvalidArgumentException("$label bloco " . ($index + 1) . ': JSON invalido - ' . json_last_error_msg());
            }
            $fragments[] = $decoded;
        }
    }

    if (!empty($fragments)) return $fragments;
    throw new InvalidArgumentException("$label: JSON invalido - " . json_last_error_msg());
}

function ftcScoutForEachNode($node, callable $callback): void {
    if (!is_array($node)) return;
    $callback($node);
    foreach ($node as $value) {
        if (is_array($value)) ftcScoutForEachNode($value, $callback);
    }
}

function ftcScoutSeason($value, $fallback = null): string {
    $season = $value ?? $fallback ?? date('Y');
    return (string)$season;
}

function ftcScoutStringOrNull($value): ?string {
    if ($value === null) return null;
    $value = trim((string)$value);
    return $value === '' ? null : $value;
}

function ftcScoutLocationFromEvent(array $event): ?string {
    $parts = [];
    foreach (['venue', 'city', 'state', 'country'] as $key) {
        $value = ftcScoutStringOrNull($event[$key] ?? null);
        if ($value !== null) $parts[] = $value;
    }
    return empty($parts) ? null : implode(', ', array_unique($parts));
}

function ftcScoutDivisionNameFromCode(string $eventCode): ?string {
    if (!preg_match('/^FTCCMP\d+([A-Z]{3,})$/', $eventCode, $matches)) return null;

    $known = [
        'EDIS' => 'Edison',
        'FRAN' => 'Franklin',
        'JEMI' => 'Jemison',
        'JOHN' => 'Johnson',
        'MILS' => 'Milstein',
        'MIL' => 'Milstein',
        'OCHO' => 'Ochoa',
        'ROSS' => 'Ross',
        'ROS' => 'Ross',
    ];

    $suffix = $matches[1];
    return $known[$suffix] ?? ucfirst(strtolower($suffix));
}

function ftcScoutLooksLikeGeneratedEventName(string $name, string $code): bool {
    $normalized = trim($name);
    return $normalized === $code || $normalized === ('FTCScout ' . $code) || $normalized === ('Evento ' . $code);
}

function ftcScoutShortName(string $name, string $code, string $scopeType): string {
    if ($scopeType === 'final') return 'Finais';
    $short = preg_replace('/^FIRST World Championship\s*-\s*/i', '', $name);
    $short = preg_replace('/\s+Division$/i', '', (string)$short);
    $short = trim((string)$short);
    if ($short !== '' && !ftcScoutLooksLikeGeneratedEventName($short, $code)) return $short;

    return ftcScoutDivisionNameFromCode($code) ?? $code;
}

function ftcScoutGroupName(array $event, string $parentCode): string {
    $name = ftcScoutStringOrNull($event['name'] ?? null) ?? ('Evento ' . $parentCode);
    $name = preg_replace('/\s*-\s*[^-]+?\s+Division$/i', '', $name);
    $name = trim((string)$name);
    if ($name !== '' && !ftcScoutLooksLikeGeneratedEventName($name, $parentCode)) return $name;

    return strpos($parentCode, 'FTCCMP') === 0 ? 'FIRST World Championship' : ('Evento ' . $parentCode);
}

function ftcScoutGroupShortName(string $name, string $parentCode): string {
    $short = preg_replace('/^FIRST\s+/i', '', $name);
    $short = preg_replace('/\s*-\s*FIRST Tech Challenge$/i', '', (string)$short);
    $short = trim((string)$short);
    if ($short !== '' && !ftcScoutLooksLikeGeneratedEventName($short, $parentCode)) return $short;
    return strpos($parentCode, 'FTCCMP') === 0 ? 'World Championship' : $parentCode;
}

function ftcScoutIsFinalDivisionEvent(?array $event): bool {
    if (!$event) return false;
    return (bool)preg_match('/Finals?\s+Division/i', (string)($event['name'] ?? ''));
}

function ftcScoutRegisterParentCode(array &$parentCodes, string $season, string $eventCode, ?string $divisionCode = null): void {
    $parentCode = $divisionCode ?: inferFtcScoutDivisionParentCode($eventCode);
    if ($parentCode && $parentCode !== $eventCode) {
        $parentCodes[$season . '|' . $parentCode] = true;
    }
}

function ftcScoutEventFromNode(array $node, ?string $fallbackSeason = null, ?string $fallbackCode = null): ?array {
    $code = ftcScoutStringOrNull($node['code'] ?? $fallbackCode);
    if ($code === null) return null;
    $season = ftcScoutSeason($node['season'] ?? null, $fallbackSeason);

    return [
        'season' => $season,
        'code' => $code,
        'division_code' => ftcScoutStringOrNull($node['divisionCode'] ?? null),
        'name' => ftcScoutStringOrNull($node['name'] ?? null) ?? $code,
        'type' => ftcScoutStringOrNull($node['type'] ?? null),
        'timezone' => ftcScoutStringOrNull($node['timezone'] ?? null) ?? 'America/Sao_Paulo',
        'start' => ftcScoutStringOrNull($node['start'] ?? null),
        'end' => ftcScoutStringOrNull($node['end'] ?? null),
        'location' => ftcScoutLocationFromEvent($node),
        'raw' => $node,
    ];
}

function ftcScoutCollectEvents(array $fragments): array {
    $events = [];
    foreach ($fragments as $fragment) {
        ftcScoutForEachNode($fragment, function ($node) use (&$events) {
            if (!isset($node['code']) || !isset($node['season'])) return;
            $event = ftcScoutEventFromNode($node);
            if (!$event) return;
            $events[$event['season'] . '|' . $event['code']] = $event;
        });
    }
    return $events;
}

function ftcScoutCollectTeamDetails(array $fragments): array {
    $details = [];
    foreach ($fragments as $fragment) {
        ftcScoutForEachNode($fragment, function ($node) use (&$details) {
            if (!isset($node['number']) || !isset($node['name'])) return;
            $number = (int)$node['number'];
            if ($number <= 0) return;
            $details[$number] = [
                'number' => $number,
                'name' => ftcScoutStringOrNull($node['name'] ?? null) ?? ('Equipe #' . $number),
            ];
        });
    }
    return $details;
}

function ftcScoutCollectParticipations(array $fragments): array {
    $participations = [];
    foreach ($fragments as $fragment) {
        ftcScoutForEachNode($fragment, function ($node) use (&$participations) {
            if (!isset($node['teamNumber']) || !isset($node['eventCode']) || isset($node['matchId'])) return;
            $teamNumber = (int)$node['teamNumber'];
            $eventCode = ftcScoutStringOrNull($node['eventCode'] ?? null);
            if ($teamNumber <= 0 || $eventCode === null) return;
            $season = ftcScoutSeason($node['season'] ?? null);
            $key = $season . '|' . $eventCode;
            $participations[$key][$teamNumber] = true;
        });
    }
    return $participations;
}

function ftcScoutCollectMatches(array $fragments): array {
    $matches = [];
    foreach ($fragments as $fragment) {
        ftcScoutForEachNode($fragment, function ($node) use (&$matches) {
            if (!isset($node['id']) || !isset($node['eventCode']) || !isset($node['teams']) || !is_array($node['teams'])) return;
            $eventCode = ftcScoutStringOrNull($node['eventCode'] ?? null);
            if ($eventCode === null) return;
            $season = ftcScoutSeason($node['eventSeason'] ?? ($node['season'] ?? null));
            $matches[$season . '|' . $eventCode . '|' . $node['id']] = $node;
        });
    }
    return array_values($matches);
}

function ftcScoutAutoEnrichEnabled(array $body): bool {
    if (array_key_exists('auto_enrich', $body)) return !empty($body['auto_enrich']);
    $env = getenv('FTCSCOUT_AUTO_ENRICH');
    if ($env === false) return true;
    return !in_array(strtolower((string)$env), ['0', 'false', 'off', 'no'], true);
}

function ftcScoutFetchJson(string $path, ?callable $fetcher = null): ?array {
    $path = ltrim($path, '/');
    if ($fetcher) {
        $data = $fetcher($path);
        return is_array($data) ? $data : null;
    }

    $baseUrl = rtrim(getenv('FTCSCOUT_API_BASE') ?: 'https://api.ftcscout.org/rest/v1', '/');
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 6,
            'header' => "Accept: application/json\r\nUser-Agent: FTCScout-Importer/1.0\r\n",
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($baseUrl . '/' . $path, false, $context);
    if ($raw === false || trim($raw) === '') return null;

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function ftcScoutReferencedEventKeys(array $participations, array $matches): array {
    $keys = [];
    foreach (array_keys($participations) as $eventKey) {
        [$season, $eventCode] = explode('|', $eventKey, 2);
        $keys[$eventKey] = ['season' => $season, 'code' => $eventCode];
    }
    foreach ($matches as $match) {
        $eventCode = ftcScoutStringOrNull($match['eventCode'] ?? null);
        if ($eventCode === null) continue;
        $season = ftcScoutSeason($match['eventSeason'] ?? ($match['season'] ?? null));
        $keys[$season . '|' . $eventCode] = ['season' => $season, 'code' => $eventCode];
    }
    return $keys;
}

function ftcScoutFallbackEventFromCode(string $season, string $eventCode): ?array {
    $division = ftcScoutDivisionNameFromCode($eventCode);
    if ($division === null) return null;

    return [
        'season' => $season,
        'code' => $eventCode,
        'division_code' => inferFtcScoutDivisionParentCode($eventCode),
        'name' => 'FIRST World Championship - ' . $division . ' Division',
        'type' => 'FIRSTChampionship',
        'timezone' => 'America/Sao_Paulo',
        'start' => null,
        'end' => null,
        'location' => null,
        'raw' => [],
    ];
}

function ftcScoutEnrichEventsFromApi(array &$events, array $eventKeys, ?callable $fetcher, array &$summary, array &$warnings): void {
    $failed = 0;
    foreach ($eventKeys as $key => $eventRef) {
        if (isset($events[$key])) continue;

        $season = (string)$eventRef['season'];
        $eventCode = (string)$eventRef['code'];
        $data = ftcScoutFetchJson('events/' . rawurlencode($season) . '/' . rawurlencode($eventCode), $fetcher);
        $event = $data ? ftcScoutEventFromNode($data, $season, $eventCode) : null;
        if (!$event) {
            $event = ftcScoutFallbackEventFromCode($season, $eventCode);
        }

        if ($event) {
            $events[$event['season'] . '|' . $event['code']] = $event;
            $summary['events']['enriched']++;
        } else {
            $failed++;
        }
    }

    if ($failed > 0) {
        $warnings[] = 'Alguns eventos nao tiveram detalhes encontrados no FTCScout e ficaram com nome inferido pelo codigo.';
    }
}

function ftcScoutReferencedTeamNumbers(array $participations, array $matches): array {
    $numbers = [];
    foreach ($participations as $teams) {
        foreach (array_keys($teams) as $teamNumber) {
            $number = (int)$teamNumber;
            if ($number > 0) $numbers[$number] = true;
        }
    }
    foreach ($matches as $match) {
        foreach (ftcScoutAllMatchTeamNumbers($match) as $teamNumber) {
            $number = (int)$teamNumber;
            if ($number > 0) $numbers[$number] = true;
        }
    }
    ksort($numbers);
    return array_keys($numbers);
}

function ftcScoutExistingTeamHasGoodName(PDO $pdo, int $teamNumber): bool {
    $name = ftcScoutTeamName($pdo, $teamNumber);
    return !ftcScoutIsPlaceholderName($name, $teamNumber);
}

function ftcScoutTeamDetailFromApiNode(array $node, int $fallbackNumber): ?array {
    $number = (int)($node['number'] ?? $fallbackNumber);
    if ($number <= 0) return null;
    $name = ftcScoutStringOrNull($node['name'] ?? null);
    if ($name === null) return null;
    return ['number' => $number, 'name' => $name];
}

function ftcScoutEnrichTeamDetailsFromApi(PDO $pdo, array &$teamDetails, array $teamNumbers, ?callable $fetcher, array &$summary, array &$warnings): void {
    $failed = 0;
    foreach ($teamNumbers as $teamNumber) {
        $teamNumber = (int)$teamNumber;
        $existingDetail = $teamDetails[$teamNumber] ?? null;
        if ($existingDetail && !ftcScoutIsPlaceholderName($existingDetail['name'] ?? null, $teamNumber)) continue;
        if (ftcScoutExistingTeamHasGoodName($pdo, $teamNumber)) continue;

        $data = ftcScoutFetchJson('teams/' . rawurlencode((string)$teamNumber), $fetcher);
        $detail = $data ? ftcScoutTeamDetailFromApiNode($data, $teamNumber) : null;
        if ($detail) {
            $teamDetails[$teamNumber] = $detail;
            $summary['teams']['enriched']++;
        } else {
            $failed++;
        }
    }

    if ($failed > 0) {
        $warnings[] = 'Algumas equipes nao tiveram nome encontrado no FTCScout e foram mantidas apenas pelo numero.';
    }
}

function ftcScoutFindChampionship(PDO $pdo, string $season, string $eventCode, string $scopeType): ?array {
    $stmt = $pdo->prepare("SELECT * FROM championships WHERE season = ? AND event_code = ? AND scope_type = ? LIMIT 1");
    $stmt->execute([$season, $eventCode, $scopeType]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function ftcScoutUpsertChampionship(PDO $pdo, array $data, array &$summary): array {
    $existing = ftcScoutFindChampionship($pdo, $data['season'], $data['event_code'], $data['scope_type']);
    $now = date('c');
    $allianceSize = strtoupper((string)$data['event_code']) === 'FPECRI'
        ? 3
        : normalizeAllianceSize($data['alliance_size'] ?? ($existing['alliance_size'] ?? 2));

    if ($existing) {
        $stmt = $pdo->prepare("
            UPDATE championships
            SET parent_id = ?, name = ?, short_name = ?, level = ?, starts_at = ?, ends_at = ?,
                timezone = ?, location = ?, status = 'active', sort_order = ?, alliance_size = ?, updated_at = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $data['parent_id'] ?? null,
            $data['name'],
            $data['short_name'] ?? null,
            $data['level'] ?? null,
            $data['starts_at'] ?? null,
            $data['ends_at'] ?? null,
            $data['timezone'] ?? 'America/Sao_Paulo',
            $data['location'] ?? null,
            (int)($data['sort_order'] ?? 0),
            $allianceSize,
            $now,
            $existing['id'],
        ]);
        $summary['events']['updated']++;
        $id = $existing['id'];
    } else {
        $id = generateId();
        $stmt = $pdo->prepare("
            INSERT INTO championships (
                id, parent_id, name, short_name, season, event_code, scope_type, level,
                starts_at, ends_at, timezone, location, status, sort_order, alliance_size, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
        ");
        $stmt->execute([
            $id,
            $data['parent_id'] ?? null,
            $data['name'],
            $data['short_name'] ?? null,
            $data['season'],
            $data['event_code'],
            $data['scope_type'],
            $data['level'] ?? null,
            $data['starts_at'] ?? null,
            $data['ends_at'] ?? null,
            $data['timezone'] ?? 'America/Sao_Paulo',
            $data['location'] ?? null,
            (int)($data['sort_order'] ?? 0),
            $allianceSize,
            $now,
            $now,
        ]);
        $summary['events']['created']++;
    }

    $stmt = $pdo->prepare("SELECT * FROM championships WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function ftcScoutEnsureGroup(PDO $pdo, string $season, string $parentCode, ?array $event, array &$summary): array {
    $isFinalEvent = ftcScoutIsFinalDivisionEvent($event);
    $groupCode = $isFinalEvent ? ($parentCode . ':GROUP') : $parentCode;
    if ($isFinalEvent) {
        $stmt = $pdo->prepare("
            SELECT id FROM championships
            WHERE season = ? AND event_code = ? AND scope_type = 'event_group'
            LIMIT 1
        ");
        $stmt->execute([$season, $groupCode]);
        $syntheticGroup = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$syntheticGroup) {
            $stmt->execute([$season, $parentCode]);
            $legacyGroup = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($legacyGroup) {
                $update = $pdo->prepare("
                    UPDATE championships
                    SET event_code = ?, updated_at = ?
                    WHERE id = ?
                ");
                $update->execute([$groupCode, date('c'), $legacyGroup['id']]);
            }
        }
    }
    $groupName = $event ? ftcScoutGroupName($event, $parentCode) : (strpos($parentCode, 'FTCCMP') === 0 ? 'FIRST World Championship' : ('Evento ' . $parentCode));
    return ftcScoutUpsertChampionship($pdo, [
        'parent_id' => null,
        'name' => $groupName,
        'short_name' => ftcScoutGroupShortName($groupName, $parentCode),
        'season' => $season,
        'event_code' => $groupCode,
        'scope_type' => 'event_group',
        'level' => 'event_group',
        'starts_at' => $event['start'] ?? null,
        'ends_at' => $event['end'] ?? null,
        'timezone' => $event['timezone'] ?? 'America/Sao_Paulo',
        'location' => $event['location'] ?? null,
        'sort_order' => 0,
    ], $summary);
}

function ftcScoutEnsurePlayableChampionship(
    PDO $pdo,
    string $season,
    string $eventCode,
    array $events,
    array $parentCodes,
    array &$summary,
    array &$groups
): array {
    $key = $season . '|' . $eventCode;
    $event = $events[$key] ?? [
        'season' => $season,
        'code' => $eventCode,
        'division_code' => null,
        'name' => 'FTCScout ' . $eventCode,
        'type' => null,
        'timezone' => 'America/Sao_Paulo',
        'start' => null,
        'end' => null,
        'location' => null,
    ];

    $divisionCode = $event['division_code'] ?? null;
    $inferredParentCode = $divisionCode ?: inferFtcScoutDivisionParentCode($eventCode);
    $isFinal = ftcScoutIsFinalDivisionEvent($event);
    $isParentEventGroup = isset($parentCodes[$key]) && !$inferredParentCode && !$isFinal;
    if ($isParentEventGroup) {
        if (!isset($groups[$key])) {
            $groups[$key] = ftcScoutEnsureGroup($pdo, $season, $eventCode, $event, $summary);
        }
        return $groups[$key];
    }

    $scopeType = $inferredParentCode ? 'division' : ($isFinal ? 'final' : 'standalone');
    $parentId = null;

    if ($inferredParentCode || $isFinal) {
        $parentCode = $inferredParentCode ?: $eventCode;
        $groupKey = $season . '|' . $parentCode;
        if (!isset($groups[$groupKey])) {
            $groups[$groupKey] = ftcScoutEnsureGroup($pdo, $season, $parentCode, $events[$groupKey] ?? $event, $summary);
        }
        $parentId = $groups[$groupKey]['id'];
    }

    return ftcScoutUpsertChampionship($pdo, [
        'parent_id' => $parentId,
        'name' => $event['name'],
        'short_name' => ftcScoutShortName($event['name'], $eventCode, $scopeType),
        'season' => $season,
        'event_code' => $eventCode,
        'scope_type' => $scopeType,
        'level' => $event['type'] ?? null,
        'starts_at' => $event['start'] ?? null,
        'ends_at' => $event['end'] ?? null,
        'timezone' => $event['timezone'] ?? 'America/Sao_Paulo',
        'location' => $event['location'] ?? null,
        'sort_order' => $scopeType === 'final' ? 90 : 10,
    ], $summary);
}

function ftcScoutIsPlaceholderName(?string $name, int $teamNumber): bool {
    return $name === null || trim($name) === '' || trim($name) === ('Equipe #' . $teamNumber);
}

function ftcScoutEnsureTeam(PDO $pdo, int $teamNumber, ?array $detail, array &$summary): void {
    if ($teamNumber <= 0) return;
    $name = $detail['name'] ?? ('Equipe #' . $teamNumber);
    $now = date('c');

    $stmt = $pdo->prepare("SELECT * FROM teams WHERE team_number = ?");
    $stmt->execute([$teamNumber]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing) {
        $stmt = $pdo->prepare("
            INSERT INTO teams (team_number, team_name, logo_position, created_at, updated_at)
            VALUES (?, ?, 'center', ?, ?)
        ");
        $stmt->execute([$teamNumber, $name, $now, $now]);
        $summary['teams']['created']++;
        if (!$detail) $summary['teams']['placeholders']++;
        return;
    }

    if ($detail && ftcScoutIsPlaceholderName($existing['team_name'] ?? null, $teamNumber)) {
        $stmt = $pdo->prepare("UPDATE teams SET team_name = ?, updated_at = ? WHERE team_number = ?");
        $stmt->execute([$detail['name'], $now, $teamNumber]);
        $summary['teams']['updated']++;
        return;
    }

    $summary['teams']['existing']++;
}

function ftcScoutEnrollTeam(PDO $pdo, string $championshipId, int $teamNumber, array &$summary): void {
    if ($teamNumber <= 0) return;
    $stmt = $pdo->prepare("SELECT id FROM championship_teams WHERE championship_id = ? AND team_number = ?");
    $stmt->execute([$championshipId, $teamNumber]);
    if ($stmt->fetch()) {
        $summary['enrollments']['existing']++;
        return;
    }

    $now = date('c');
    $stmt = $pdo->prepare("
        INSERT INTO championship_teams (id, championship_id, team_number, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
    ");
    $stmt->execute([generateId(), $championshipId, $teamNumber, $now, $now]);
    $summary['enrollments']['created']++;
}

function ftcScoutTeamName(PDO $pdo, int $teamNumber): ?string {
    $stmt = $pdo->prepare("SELECT team_name FROM teams WHERE team_number = ?");
    $stmt->execute([$teamNumber]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? ($row['team_name'] ?? null) : null;
}

function ftcScoutMatchType(array $match): string {
    $level = strtolower((string)($match['tournamentLevel'] ?? ''));
    if (strpos($level, 'qual') !== false) return 'qualification';
    if (strpos($level, 'practice') !== false) return 'practice';
    return 'elimination';
}

function ftcScoutMatchNumber(array $match, string $matchType): int {
    $id = (int)($match['id'] ?? 0);

    if ($matchType === 'elimination') {
        $series = (int)($match['series'] ?? 0);
        if ($series > 0) {
            $matchInSeries = $id % 1000;
            return $matchInSeries > 1 ? ($series * 1000 + $matchInSeries) : $series;
        }

        return normalizeStoredPlayoffMatchNumber($id);
    }

    return $id;
}

function ftcScoutDisplayName(string $matchType, int $matchNumber, ?array $sourceMatch = null): string {
    if ($matchType === 'elimination' && $sourceMatch) {
        $series = (int)($sourceMatch['series'] ?? 0);
        $matchInSeries = (int)($sourceMatch['id'] ?? 0) % 1000;
        if ($series > 0 && $matchInSeries > 1) return 'M' . $series . '-' . $matchInSeries;
    }
    return formatMatchDisplayName($matchType, $matchNumber);
}

function ftcScoutAllianceSlots(array $match, string $alliance): array {
    $slots = [];
    foreach (($match['teams'] ?? []) as $team) {
        if (!is_array($team)) continue;
        if (strtolower((string)($team['alliance'] ?? '')) !== strtolower($alliance)) continue;
        $number = (int)($team['teamNumber'] ?? 0);
        if ($number <= 0) continue;

        $station = strtolower((string)($team['station'] ?? ''));
        $role = strtolower((string)($team['allianceRole'] ?? ''));
        if ($station === 'notonfield') continue;

        $slot = null;
        if ($station === 'one' || $role === 'captain' || $role === 'one') $slot = 0;
        if ($station === 'two' || $role === 'firstpick' || $role === 'two') $slot = 1;
        if ($station === 'three' || $role === 'secondpick' || $role === 'three') $slot = 2;
        if ($slot === null) $slot = count($slots);
        if ($slot > 2) continue;

        $slots[$slot] = [
            'team_number' => $number,
            'on_field' => array_key_exists('onField', $team) ? (bool)$team['onField'] : true,
            'no_show' => !empty($team['noShow']),
            'dq' => !empty($team['dq']),
        ];
    }
    ksort($slots);
    return array_values($slots);
}

function ftcScoutAllMatchTeamNumbers(array $match): array {
    $numbers = [];
    foreach (($match['teams'] ?? []) as $team) {
        if (!is_array($team)) continue;
        $number = (int)($team['teamNumber'] ?? 0);
        if ($number > 0) $numbers[$number] = true;
    }
    return array_keys($numbers);
}

function ftcScoutOffFieldCount(array $match): int {
    $count = 0;
    foreach (($match['teams'] ?? []) as $team) {
        if (!is_array($team)) continue;
        $onField = array_key_exists('onField', $team)
            ? (bool)$team['onField']
            : (strtolower((string)($team['station'] ?? '')) !== 'notonfield');
        if (!$onField) $count++;
    }
    return $count;
}

function ftcScoutNoShowIssues(array $slots, string $alliance): array {
    $issues = [];
    foreach ($slots as $slot) {
        if (!empty($slot['no_show'])) {
            $issues[] = $slot['team_number'] . ' nao apresentou';
        } elseif (isset($slot['on_field']) && !$slot['on_field']) {
            $issues[] = $slot['team_number'] . ' fora de campo';
        } elseif (!empty($slot['dq'])) {
            $issues[] = $slot['team_number'] . ' desclassificada';
        }
    }
    return $issues;
}

function ftcScoutAddPreviewEvent(array &$preview, array $championship): void {
    $preview['events'][$championship['id']] = [
        'id' => $championship['id'],
        'name' => $championship['name'],
        'short_name' => $championship['short_name'] ?? null,
        'event_code' => $championship['event_code'],
        'scope_type' => $championship['scope_type'],
    ];
}

function ftcScoutAddPreviewTeam(array &$preview, int $teamNumber, ?string $teamName): void {
    $preview['teams'][$teamNumber] = [
        'team_number' => $teamNumber,
        'team_name' => $teamName ?: ('Equipe #' . $teamNumber),
    ];
}

function ftcScoutUpsertMatch(PDO $pdo, array $match, array $championship, array $teamDetails, array &$summary, array &$warnings, array &$ensuredTeams, array &$preview): void {
    $matchType = ftcScoutMatchType($match);
    $matchNumber = ftcScoutMatchNumber($match, $matchType);
    if ($matchNumber <= 0) {
        $summary['matches']['skipped']++;
        $warnings[] = 'Partida sem id numerico ignorada.';
        return;
    }

    $redSlots = ftcScoutAllianceSlots($match, 'Red');
    $blueSlots = ftcScoutAllianceSlots($match, 'Blue');
    $offField = ftcScoutOffFieldCount($match);
    $summary['matches']['off_field_teams'] += $offField;

    if (count($redSlots) < 2 || count($blueSlots) < 2) {
        $summary['matches']['skipped']++;
        $warnings[] = 'Partida ' . ($match['eventCode'] ?? '?') . '#' . $matchNumber . ' ignorada por nao ter dois times previstos por alianca.';
        return;
    }

    $red = [(int)$redSlots[0]['team_number'], (int)$redSlots[1]['team_number']];
    $blue = [(int)$blueSlots[0]['team_number'], (int)$blueSlots[1]['team_number']];
    if (isset($redSlots[2], $blueSlots[2])) {
        $red[] = (int)$redSlots[2]['team_number'];
        $blue[] = (int)$blueSlots[2]['team_number'];
        $pdo->prepare("UPDATE championships SET alliance_size = 3, updated_at = ? WHERE id = ?")
            ->execute([date('c'), $championship['id']]);
        $championship['alliance_size'] = 3;
    }
    $issues = array_merge(ftcScoutNoShowIssues($redSlots, 'red'), ftcScoutNoShowIssues($blueSlots, 'blue'));
    foreach (array_merge($redSlots, $blueSlots) as $slot) {
        if (!empty($slot['no_show'])) $summary['matches']['no_show_teams']++;
    }

    if (isset($match['scores'])) {
        $summary['matches']['ignored_scores']++;
    }

    foreach (ftcScoutAllMatchTeamNumbers($match) as $teamNumber) {
        if (!isset($ensuredTeams[(int)$teamNumber])) {
            ftcScoutEnsureTeam($pdo, (int)$teamNumber, $teamDetails[(int)$teamNumber] ?? null, $summary);
            $ensuredTeams[(int)$teamNumber] = true;
        }
        ftcScoutEnrollTeam($pdo, $championship['id'], (int)$teamNumber, $summary);
        ftcScoutAddPreviewTeam($preview, (int)$teamNumber, $teamDetails[(int)$teamNumber]['name'] ?? ftcScoutTeamName($pdo, (int)$teamNumber));
    }

    $displayName = ftcScoutDisplayName($matchType, $matchNumber, $match);
    $status = !empty($match['hasBeenPlayed']) ? 'completed' : 'scheduled';
    $now = date('c');
    $sourceMatchId = ftcScoutStringOrNull($match['id'] ?? null);
    $sourceMatchNumber = (int)($match['id'] ?? 0) ?: null;

    $existing = null;
    if ($sourceMatchId !== null) {
        $stmt = $pdo->prepare("
            SELECT id FROM matches
            WHERE championship_id = ? AND source_system = 'ftcscout' AND source_match_id = ?
            LIMIT 1
        ");
        $stmt->execute([$championship['id'], $sourceMatchId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    if (!$existing) {
        $stmt = $pdo->prepare("
            SELECT id FROM matches
            WHERE championship_id = ? AND match_type = ? AND match_number = ?
            LIMIT 1
        ");
        $stmt->execute([$championship['id'], $matchType, $matchNumber]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    $params = [
        $championship['id'],
        $matchType,
        $matchNumber,
        $displayName,
        $red[0],
        ftcScoutTeamName($pdo, $red[0]),
        $red[1],
        ftcScoutTeamName($pdo, $red[1]),
        $red[2] ?? null,
        isset($red[2]) ? ftcScoutTeamName($pdo, $red[2]) : null,
        $blue[0],
        ftcScoutTeamName($pdo, $blue[0]),
        $blue[1],
        ftcScoutTeamName($pdo, $blue[1]),
        $blue[2] ?? null,
        isset($blue[2]) ? ftcScoutTeamName($pdo, $blue[2]) : null,
        $sourceMatchId,
        $sourceMatchNumber,
        'ftcscout',
        ftcScoutStringOrNull($match['scheduledStartTime'] ?? null),
        ftcScoutStringOrNull($match['actualStartTime'] ?? null),
        $status,
        !empty($issues)
            ? 'FTCScout: ' . implode('; ', $issues) . '.'
            : ($offField > 0 ? 'FTCScout: membros fora de campo mantidos apenas como participantes do campeonato.' : null),
    ];

    $preview['matches'][] = [
        'event_code' => $match['eventCode'] ?? $championship['event_code'],
        'event_name' => $championship['short_name'] ?: $championship['name'],
        'display_name' => $displayName,
        'match_type' => $matchType,
        'red' => $red,
        'blue' => $blue,
        'issues' => $issues,
        'scheduled_time' => ftcScoutStringOrNull($match['scheduledStartTime'] ?? null),
    ];

    if ($existing) {
        $stmt = $pdo->prepare("
            UPDATE matches
            SET championship_id = ?, match_type = ?, match_number = ?, display_name = ?,
                red_team1_number = ?, red_team1_name = ?, red_team2_number = ?, red_team2_name = ?,
                red_team3_number = ?, red_team3_name = ?,
                blue_team1_number = ?, blue_team1_name = ?, blue_team2_number = ?, blue_team2_name = ?,
                blue_team3_number = ?, blue_team3_name = ?,
                source_match_id = ?, source_match_number = ?, source_system = ?,
                scheduled_time = ?, actual_start_time = ?, status = ?, notes = ?, updated_at = ?
            WHERE id = ?
        ");
        $stmt->execute(array_merge($params, [$now, $existing['id']]));
        $summary['matches']['updated']++;
        return;
    }

    $stmt = $pdo->prepare("
        INSERT INTO matches (
            id, championship_id, match_type, match_number, display_name,
            red_team1_number, red_team1_name, red_team2_number, red_team2_name,
            red_team3_number, red_team3_name,
            blue_team1_number, blue_team1_name, blue_team2_number, blue_team2_name,
            blue_team3_number, blue_team3_name,
            source_match_id, source_match_number, source_system,
            scheduled_time, actual_start_time, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute(array_merge([generateId()], $params, [$now, $now]));
    $summary['matches']['created']++;
}

function importFtcScoutManualJson(PDO $pdo, array $body): array {
    $summary = ftcScoutEmptySummary();
    $preview = ftcScoutEmptyPreview();
    $warnings = [];
    $dryRun = !empty($body['dry_run']);

    $events = ftcScoutCollectEvents(ftcScoutDecodeFragments($body['events_json'] ?? '', 'Eventos'));
    $teamDetails = ftcScoutCollectTeamDetails(ftcScoutDecodeFragments($body['team_details_json'] ?? '', 'Cadastros de equipes'));
    $participations = ftcScoutCollectParticipations(ftcScoutDecodeFragments($body['teams_json'] ?? '', 'Equipes do evento'));
    $matches = ftcScoutCollectMatches(ftcScoutDecodeFragments($body['matches_json'] ?? '', 'Partidas'));

    $summary['events']['found'] = count($events);
    $summary['teams']['details_provided'] = count($teamDetails);
    $summary['matches']['found'] = count($matches);
    $fetcher = isset($body['ftcscout_fetcher']) && is_callable($body['ftcscout_fetcher'])
        ? $body['ftcscout_fetcher']
        : null;

    if (ftcScoutAutoEnrichEnabled($body)) {
        ftcScoutEnrichEventsFromApi($events, ftcScoutReferencedEventKeys($participations, $matches), $fetcher, $summary, $warnings);
        ftcScoutEnrichTeamDetailsFromApi($pdo, $teamDetails, ftcScoutReferencedTeamNumbers($participations, $matches), $fetcher, $summary, $warnings);
    }

    $parentCodes = [];
    foreach ($events as $event) {
        ftcScoutRegisterParentCode($parentCodes, $event['season'], $event['code'], $event['division_code'] ?? null);
    }
    foreach (array_keys($participations) as $eventKey) {
        [$season, $eventCode] = explode('|', $eventKey, 2);
        ftcScoutRegisterParentCode($parentCodes, $season, $eventCode);
    }
    foreach ($matches as $match) {
        $eventCode = ftcScoutStringOrNull($match['eventCode'] ?? null);
        if ($eventCode === null) continue;
        $season = ftcScoutSeason($match['eventSeason'] ?? ($match['season'] ?? null));
        ftcScoutRegisterParentCode($parentCodes, $season, $eventCode);
    }

    $pdo->beginTransaction();
    try {
        $groups = [];
        $championships = [];
        $ensuredTeams = [];

        foreach (array_keys($parentCodes) as $parentKey) {
            [$season, $parentCode] = explode('|', $parentKey, 2);
            $groups[$parentKey] = ftcScoutEnsureGroup($pdo, $season, $parentCode, $events[$parentKey] ?? null, $summary);
            ftcScoutAddPreviewEvent($preview, $groups[$parentKey]);
        }

        foreach ($events as $key => $event) {
            $championships[$key] = ftcScoutEnsurePlayableChampionship(
                $pdo,
                $event['season'],
                $event['code'],
                $events,
                $parentCodes,
                $summary,
                $groups
            );
            ftcScoutAddPreviewEvent($preview, $championships[$key]);
        }

        foreach ($participations as $eventKey => $teams) {
            if (!isset($championships[$eventKey])) {
                [$season, $eventCode] = explode('|', $eventKey, 2);
                $championships[$eventKey] = ftcScoutEnsurePlayableChampionship($pdo, $season, $eventCode, $events, $parentCodes, $summary, $groups);
                ftcScoutAddPreviewEvent($preview, $championships[$eventKey]);
            }
            foreach (array_keys($teams) as $teamNumber) {
                $summary['teams']['found']++;
                if (!isset($ensuredTeams[(int)$teamNumber])) {
                    ftcScoutEnsureTeam($pdo, (int)$teamNumber, $teamDetails[(int)$teamNumber] ?? null, $summary);
                    $ensuredTeams[(int)$teamNumber] = true;
                }
                ftcScoutEnrollTeam($pdo, $championships[$eventKey]['id'], (int)$teamNumber, $summary);
                ftcScoutAddPreviewTeam($preview, (int)$teamNumber, $teamDetails[(int)$teamNumber]['name'] ?? ftcScoutTeamName($pdo, (int)$teamNumber));
            }
        }

        foreach ($teamDetails as $teamNumber => $detail) {
            if (!isset($ensuredTeams[(int)$teamNumber])) {
                ftcScoutEnsureTeam($pdo, (int)$teamNumber, $detail, $summary);
                $ensuredTeams[(int)$teamNumber] = true;
            }
            ftcScoutAddPreviewTeam($preview, (int)$teamNumber, $detail['name']);
        }

        foreach ($matches as $match) {
            $season = ftcScoutSeason($match['eventSeason'] ?? ($match['season'] ?? null));
            $eventCode = ftcScoutStringOrNull($match['eventCode'] ?? null);
            if ($eventCode === null) {
                $summary['matches']['skipped']++;
                continue;
            }
            $eventKey = $season . '|' . $eventCode;
            if (!isset($championships[$eventKey])) {
                $championships[$eventKey] = ftcScoutEnsurePlayableChampionship($pdo, $season, $eventCode, $events, $parentCodes, $summary, $groups);
                ftcScoutAddPreviewEvent($preview, $championships[$eventKey]);
            }
            ftcScoutUpsertMatch($pdo, $match, $championships[$eventKey], $teamDetails, $summary, $warnings, $ensuredTeams, $preview);
        }

        if ($summary['matches']['ignored_scores'] > 0) {
            $warnings[] = 'Scores oficiais de alianca foram encontrados e ignorados. As pontuacoes individuais continuam vindo apenas do scout.';
        }
        if ($summary['matches']['off_field_teams'] > 0) {
            $warnings[] = 'Times marcados como fora de campo ou no-show foram preservados na partida/participacao e aparecem como aviso na previa.';
        }
        if ($summary['teams']['placeholders'] > 0) {
            $warnings[] = 'Algumas equipes ficaram apenas pelo numero porque nao havia nome no JSON e a busca automatica no FTCScout nao retornou detalhes.';
        }

        if ($dryRun) {
            $pdo->rollBack();
        } else {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    return [
        'success' => true,
        'dry_run' => $dryRun,
        'summary' => $summary,
        'preview' => [
            'events' => array_values($preview['events']),
            'teams' => array_values($preview['teams']),
            'matches' => $preview['matches'],
        ],
        'warnings' => array_values(array_unique($warnings)),
    ];
}
