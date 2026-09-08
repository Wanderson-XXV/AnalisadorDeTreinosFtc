<?php
require_once __DIR__ . '/config.php';

function clipFarmStringOrNull($value): ?string {
    if ($value === null) return null;
    $value = trim((string)$value);
    return $value === '' ? null : $value;
}

function clipFarmIntOrNull($value): ?int {
    if ($value === null || $value === '') return null;
    return (int)$value;
}

function clipFarmExtractEventId(string $value): string {
    $value = trim($value);
    if ($value === '') return '';

    if (preg_match('~/events/([^/?#]+)~', $value, $m)) {
        return $m[1];
    }

    return $value;
}

function clipFarmTrpcInput(array $payload, bool $batch): string {
    $input = $batch ? (object)['0' => ['json' => $payload]] : ['json' => $payload];
    return rawurlencode(json_encode($input));
}

function clipFarmHttpGet(string $url): string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => 'FTCScout-ClipFarm-Importer/1.0',
        ]);
        $raw = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($raw === false) {
            throw new Exception('Falha HTTP ao buscar ClipFarm: ' . $error);
        }
        if ($status >= 400) {
            throw new Exception('ClipFarm retornou HTTP ' . $status);
        }
        return $raw;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Accept: application/json\r\nUser-Agent: FTCScout-ClipFarm-Importer/1.0\r\n",
            'timeout' => 30,
        ],
    ]);

    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) {
        throw new Exception('Falha HTTP ao buscar ClipFarm.');
    }
    return $raw;
}

function clipFarmFetchTrpc(string $procedure, array $payload, bool $batch = true) {
    $query = ($batch ? 'batch=1&' : '') . 'input=' . clipFarmTrpcInput($payload, $batch);
    $url = 'https://www.clipfarm.watch/api/trpc/' . $procedure . '?' . $query;

    $raw = clipFarmHttpGet($url);

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new Exception('Resposta invalida do ClipFarm: ' . $procedure);
    }

    $envelope = $batch ? ($decoded[0] ?? null) : $decoded;
    if (isset($envelope['error'])) {
        throw new Exception($envelope['error']['message'] ?? ('Erro ClipFarm em ' . $procedure));
    }

    return $envelope['result']['data']['json'] ?? null;
}

function clipFarmFetchEventBundle(string $eventId): array {
    $event = clipFarmFetchTrpc('events.getById', ['id' => $eventId], false);
    $matches = clipFarmFetchTrpc('events.getEventMatches', ['eventId' => $eventId], true);

    if (!is_array($event)) throw new Exception('Evento ClipFarm nao encontrado.');
    if (!is_array($matches)) throw new Exception('Partidas ClipFarm nao encontradas.');

    return [$event, $matches];
}

function clipFarmDivisionMap(array $event): array {
    $map = [];
    foreach (($event['divisions'] ?? []) as $division) {
        if (!is_array($division) || empty($division['id'])) continue;
        $map[(string)$division['id']] = $division;
    }
    return $map;
}

function clipFarmEventCodeForMatch(array $event, array $divisionMap, array $match): ?string {
    $divisionId = clipFarmStringOrNull($match['divisionId'] ?? null);
    $division = $divisionId ? ($divisionMap[$divisionId] ?? null) : null;
    if (is_array($division)) {
        return clipFarmStringOrNull($division['ftcScoutEventCode'] ?? ($division['code'] ?? null));
    }
    return clipFarmStringOrNull($event['ftcScoutEventCode'] ?? ($event['code'] ?? null));
}

function clipFarmSeason(array $event): ?string {
    $season = $event['ftcScoutSeason'] ?? ($event['season'] ?? null);
    return $season === null ? null : (string)$season;
}

function clipFarmMatchType(array $match): string {
    $type = strtolower((string)($match['type'] ?? 'qualification'));
    if ($type === 'qualification') return 'qualification';
    if ($type === 'practice') return 'practice';
    return 'elimination';
}

function clipFarmLocalMatchNumber(array $match, string $matchType): int {
    $raw = (int)($match['number'] ?? 0);
    return $matchType === 'elimination' ? normalizeStoredPlayoffMatchNumber($raw) : $raw;
}

function clipFarmTeams(array $match): array {
    $teams = [];
    foreach (['red', 'blue'] as $alliance) {
        foreach (($match[$alliance] ?? []) as $team) {
            $num = (int)$team;
            if ($num > 0 && !in_array($num, $teams, true)) $teams[] = $num;
        }
    }
    return $teams;
}

function clipFarmLocalMatchMatchesTeams(array $row, array $clipFarmMatch): bool {
    $red = array_map('intval', $clipFarmMatch['red'] ?? []);
    $blue = array_map('intval', $clipFarmMatch['blue'] ?? []);

    $localRed = [(int)($row['red_team1_number'] ?? 0), (int)($row['red_team2_number'] ?? 0), (int)($row['red_team3_number'] ?? 0)];
    $localBlue = [(int)($row['blue_team1_number'] ?? 0), (int)($row['blue_team2_number'] ?? 0), (int)($row['blue_team3_number'] ?? 0)];
    $localRed = array_values(array_filter($localRed));
    $localBlue = array_values(array_filter($localBlue));

    foreach ($localRed as $team) {
        if ($team > 0 && !in_array($team, $red, true)) return false;
    }
    foreach ($localBlue as $team) {
        if ($team > 0 && !in_array($team, $blue, true)) return false;
    }
    return true;
}

function clipFarmFindLocalMatch(PDO $pdo, string $season, string $eventCode, string $matchType, int $matchNumber, array $clipFarmMatch): array {
    $stmt = $pdo->prepare("
        SELECT m.*, c.event_code, c.season
        FROM matches m
        JOIN championships c ON c.id = m.championship_id
        WHERE c.season = ? AND c.event_code = ? AND m.match_type = ? AND m.match_number = ?
    ");
    $stmt->execute([$season, $eventCode, $matchType, $matchNumber]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($rows) <= 1) return $rows;

    $teamMatches = array_values(array_filter($rows, fn($row) => clipFarmLocalMatchMatchesTeams($row, $clipFarmMatch)));
    return count($teamMatches) === 1 ? $teamMatches : $rows;
}

function clipFarmYoutubeId(string $url): ?string {
    if (preg_match('/(?:youtu\.be\/|[?&]v=|\/embed\/|\/v\/)([A-Za-z0-9_-]{11})/', $url, $m)) {
        return $m[1];
    }
    return null;
}

function clipFarmSourceType(string $url, ?string $clipType = null): string {
    if (clipFarmYoutubeId($url)) return 'youtube';
    $type = strtolower((string)$clipType);
    if ($type === 'hls') return 'hls';
    if ($type === 'direct-cdn') return 'direct-cdn';
    return 'external';
}

function clipFarmThumbnailUrl(string $url): ?string {
    $youtubeId = clipFarmYoutubeId($url);
    return $youtubeId ? 'https://img.youtube.com/vi/' . $youtubeId . '/mqdefault.jpg' : null;
}

function clipFarmExternalFilename(string $url, string $sourceType): string {
    $youtubeId = clipFarmYoutubeId($url);
    if ($youtubeId) return $youtubeId . '.youtube';

    $path = parse_url($url, PHP_URL_PATH);
    $basename = $path ? basename($path) : '';
    return $basename !== '' ? $basename : ($sourceType . '-link');
}

function clipFarmFindExistingMedia(PDO $pdo, string $matchId, ?string $externalProvider, ?string $externalClipId, ?string $externalUrl): ?array {
    if ($externalProvider && $externalClipId) {
        $stmt = $pdo->prepare("SELECT * FROM match_media WHERE external_provider = ? AND external_clip_id = ? LIMIT 1");
        $stmt->execute([$externalProvider, $externalClipId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    if ($externalProvider && $externalUrl) {
        $stmt = $pdo->prepare("SELECT * FROM match_media WHERE match_id = ? AND external_provider = ? AND external_url = ? LIMIT 1");
        $stmt->execute([$matchId, $externalProvider, $externalUrl]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    return null;
}

function externalMediaCleanTeamNumbers(array $values): array {
    $teams = [];
    foreach ($values as $value) {
        $num = (int)$value;
        if ($num > 0 && !in_array($num, $teams, true)) $teams[] = $num;
    }
    return $teams;
}

function externalMediaTaggedTeamsFromPayload($value): ?array {
    if ($value === null || $value === '') return null;
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) return externalMediaCleanTeamNumbers($decoded);
        return externalMediaCleanTeamNumbers(array_map('trim', explode(',', $value)));
    }
    return is_array($value) ? externalMediaCleanTeamNumbers($value) : null;
}

function externalMediaFindMatch(PDO $pdo, string $matchId): array {
    $stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
    $stmt->execute([$matchId]);
    $match = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$match) throw new Exception('Partida nao encontrada para vincular midia externa.');
    return $match;
}

function externalMediaMatchTeams(array $match): array {
    return externalMediaCleanTeamNumbers([
        $match['red_team1_number'] ?? null,
        $match['red_team2_number'] ?? null,
        $match['red_team3_number'] ?? null,
        $match['blue_team1_number'] ?? null,
        $match['blue_team2_number'] ?? null,
        $match['blue_team3_number'] ?? null,
    ]);
}

function saveExternalMatchMedia(PDO $pdo, array $payload): array {
    $matchId = clipFarmStringOrNull($payload['match_id'] ?? null);
    $url = clipFarmStringOrNull($payload['url'] ?? ($payload['external_url'] ?? null));
    if (!$matchId) throw new Exception('match_id obrigatorio.');
    if (!$url) throw new Exception('url obrigatoria.');

    $match = externalMediaFindMatch($pdo, $matchId);

    $category = clipFarmStringOrNull($payload['category'] ?? null) ?: 'full_match';
    if (!in_array($category, ['full_match', 'key_moment', 'other'], true)) {
        throw new Exception('category invalida.');
    }

    $provider = clipFarmStringOrNull($payload['external_provider'] ?? ($payload['provider'] ?? null)) ?: 'manual';
    $sourceType = clipFarmSourceType($url, clipFarmStringOrNull($payload['source_type'] ?? null));
    $youtubeId = clipFarmYoutubeId($url);
    $title = clipFarmStringOrNull($payload['title'] ?? null) ?: (($match['display_name'] ?? null) ?: 'Video da partida');
    $taggedTeams = externalMediaTaggedTeamsFromPayload($payload['tagged_teams'] ?? null) ?: externalMediaMatchTeams($match);
    $hasStartOffset = array_key_exists('video_match_start_ms', $payload);

    $metadata = [
        'origin' => 'manual_external_link',
        'match_id' => $matchId,
        'url' => $url,
    ];

    $mediaRow = [
        'match_id' => $matchId,
        'filename' => clipFarmExternalFilename($url, $sourceType),
        'original_filename' => $title,
        'file_path' => $url,
        'file_type' => 'video',
        'file_size' => 0,
        'mime_type' => 'text/uri-list',
        'category' => $category,
        'title' => $title,
        'description' => clipFarmStringOrNull($payload['description'] ?? null) ?: 'Link externo da partida',
        'tagged_teams' => json_encode($taggedTeams),
        'uploaded_by' => clipFarmStringOrNull($payload['uploaded_by'] ?? null) ?: 'manual_link',
        'thumbnail_path' => null,
        'source_type' => $sourceType,
        'external_provider' => $provider,
        'external_url' => $url,
        'external_id' => $youtubeId ?: sha1($url),
        'external_event_id' => clipFarmStringOrNull($payload['external_event_id'] ?? null),
        'external_match_id' => clipFarmStringOrNull($payload['external_match_id'] ?? null),
        'external_clip_id' => null,
        'video_match_start_ms' => $hasStartOffset ? clipFarmIntOrNull($payload['video_match_start_ms']) : null,
        'video_duration_ms' => clipFarmIntOrNull($payload['video_duration_ms'] ?? null),
        'thumbnail_url' => clipFarmStringOrNull($payload['thumbnail_url'] ?? null) ?: clipFarmThumbnailUrl($url),
        'metadata_json' => json_encode($metadata, JSON_UNESCAPED_UNICODE),
    ];

    clipFarmUpsertExternalMedia($pdo, $mediaRow, false, !$hasStartOffset);

    $saved = clipFarmFindExistingMedia($pdo, $matchId, $provider, null, $url);
    if (!$saved) throw new Exception('Falha ao salvar link externo.');
    return $saved;
}

function clipFarmBuildMediaRow(string $matchId, array $clip, array $clipFarmMatch, array $event, string $externalProvider = 'clipfarm'): array {
    $url = clipFarmStringOrNull($clip['url'] ?? null);
    if (!$url) throw new Exception('Clip sem URL.');

    $sourceType = clipFarmSourceType($url, clipFarmStringOrNull($clip['type'] ?? null));
    $title = clipFarmStringOrNull($clip['title'] ?? null);
    if (!$title) {
        $displayType = clipFarmMatchType($clipFarmMatch) === 'qualification' ? 'Q' : 'M';
        $title = $displayType . clipFarmLocalMatchNumber($clipFarmMatch, clipFarmMatchType($clipFarmMatch));
    }

    $metadata = [
        'event' => [
            'id' => $event['id'] ?? null,
            'name' => $event['name'] ?? null,
            'ftcScoutSeason' => $event['ftcScoutSeason'] ?? null,
        ],
        'match' => $clipFarmMatch,
        'clip' => $clip,
    ];

    return [
        'match_id' => $matchId,
        'filename' => clipFarmExternalFilename($url, $sourceType),
        'original_filename' => $title,
        'file_path' => $url,
        'file_type' => 'video',
        'file_size' => 0,
        'mime_type' => 'text/uri-list',
        'category' => 'full_match',
        'title' => $title,
        'description' => 'Link importado do ClipFarm',
        'tagged_teams' => json_encode(clipFarmTeams($clipFarmMatch)),
        'uploaded_by' => 'clipfarm_import',
        'thumbnail_path' => null,
        'source_type' => $sourceType,
        'external_provider' => $externalProvider,
        'external_url' => $url,
        'external_id' => clipFarmStringOrNull($clip['id'] ?? null),
        'external_event_id' => clipFarmStringOrNull($event['id'] ?? null),
        'external_match_id' => clipFarmStringOrNull($clipFarmMatch['id'] ?? null),
        'external_clip_id' => clipFarmStringOrNull($clip['id'] ?? null),
        'video_match_start_ms' => null,
        'video_duration_ms' => clipFarmIntOrNull($clip['duration'] ?? null),
        'thumbnail_url' => clipFarmThumbnailUrl($url),
        'metadata_json' => json_encode($metadata, JSON_UNESCAPED_UNICODE),
    ];
}

function clipFarmUpsertExternalMedia(PDO $pdo, array $mediaRow, bool $dryRun = false, bool $preserveStartMsOnUpdate = true): string {
    $existing = clipFarmFindExistingMedia(
        $pdo,
        $mediaRow['match_id'],
        $mediaRow['external_provider'],
        $mediaRow['external_clip_id'],
        $mediaRow['external_url']
    );

    if ($dryRun) return $existing ? 'updated' : 'created';

    $now = date('c');
    if ($existing) {
        $startOffsetSql = $preserveStartMsOnUpdate ? '' : 'video_match_start_ms = ?,';
        $stmt = $pdo->prepare("
            UPDATE match_media
            SET filename = ?, original_filename = ?, file_path = ?, file_type = ?, file_size = ?, mime_type = ?,
                category = ?, title = ?, description = ?, tagged_teams = ?, uploaded_by = ?, thumbnail_path = ?,
                source_type = ?, external_provider = ?, external_url = ?, external_id = ?, external_event_id = ?,
                external_match_id = ?, external_clip_id = ?, {$startOffsetSql} video_duration_ms = ?, thumbnail_url = ?, metadata_json = ?
            WHERE id = ?
        ");
        $params = [
            $mediaRow['filename'], $mediaRow['original_filename'], $mediaRow['file_path'], $mediaRow['file_type'],
            $mediaRow['file_size'], $mediaRow['mime_type'], $mediaRow['category'], $mediaRow['title'],
            $mediaRow['description'], $mediaRow['tagged_teams'], $mediaRow['uploaded_by'], $mediaRow['thumbnail_path'],
            $mediaRow['source_type'], $mediaRow['external_provider'], $mediaRow['external_url'], $mediaRow['external_id'],
            $mediaRow['external_event_id'], $mediaRow['external_match_id'], $mediaRow['external_clip_id'],
        ];
        if (!$preserveStartMsOnUpdate) $params[] = $mediaRow['video_match_start_ms'];
        $params[] = $mediaRow['video_duration_ms'];
        $params[] = $mediaRow['thumbnail_url'];
        $params[] = $mediaRow['metadata_json'];
        $params[] = $existing['id'];
        $stmt->execute($params);
        return 'updated';
    }

    $stmt = $pdo->prepare("
        INSERT INTO match_media (
            id, match_id, filename, original_filename, file_path, file_type, file_size, mime_type,
            category, title, description, tagged_teams, uploaded_by, thumbnail_path,
            source_type, external_provider, external_url, external_id, external_event_id, external_match_id,
            external_clip_id, video_match_start_ms, video_duration_ms, thumbnail_url, metadata_json, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        generateId(), $mediaRow['match_id'], $mediaRow['filename'], $mediaRow['original_filename'],
        $mediaRow['file_path'], $mediaRow['file_type'], $mediaRow['file_size'], $mediaRow['mime_type'],
        $mediaRow['category'], $mediaRow['title'], $mediaRow['description'], $mediaRow['tagged_teams'],
        $mediaRow['uploaded_by'], $mediaRow['thumbnail_path'], $mediaRow['source_type'], $mediaRow['external_provider'],
        $mediaRow['external_url'], $mediaRow['external_id'], $mediaRow['external_event_id'], $mediaRow['external_match_id'],
        $mediaRow['external_clip_id'], $mediaRow['video_match_start_ms'], $mediaRow['video_duration_ms'],
        $mediaRow['thumbnail_url'], $mediaRow['metadata_json'], $now,
    ]);
    return 'created';
}

function importClipFarmMatches(PDO $pdo, array $event, array $clipFarmMatches, array $options = []): array {
    $dryRun = !empty($options['dry_run']);
    $eventCodeFilter = clipFarmStringOrNull($options['event_code'] ?? null);
    $season = clipFarmSeason($event);
    if (!$season) throw new Exception('Evento ClipFarm sem temporada FTCScout.');

    $divisionMap = clipFarmDivisionMap($event);
    $summary = [
        'matches_found' => 0,
        'matched' => 0,
        'unmatched' => 0,
        'ambiguous' => 0,
        'matches_without_clips' => 0,
        'clips_found' => 0,
        'media_created' => 0,
        'media_updated' => 0,
    ];
    $preview = [];
    $warnings = [];

    foreach ($clipFarmMatches as $clipFarmMatch) {
        if (!is_array($clipFarmMatch)) continue;

        $eventCode = clipFarmEventCodeForMatch($event, $divisionMap, $clipFarmMatch);
        if (!$eventCode) {
            $warnings[] = 'Partida ClipFarm sem codigo de evento.';
            continue;
        }
        if ($eventCodeFilter && $eventCode !== $eventCodeFilter) continue;

        $summary['matches_found']++;
        $matchType = clipFarmMatchType($clipFarmMatch);
        $rawNumber = (int)($clipFarmMatch['number'] ?? 0);
        $matchNumber = clipFarmLocalMatchNumber($clipFarmMatch, $matchType);
        $clips = array_values(array_filter(($clipFarmMatch['clips'] ?? []), fn($clip) => is_array($clip) && !empty($clip['url'])));
        if (empty($clips)) $summary['matches_without_clips']++;
        $summary['clips_found'] += count($clips);

        $localMatches = clipFarmFindLocalMatch($pdo, $season, $eventCode, $matchType, $matchNumber, $clipFarmMatch);
        if (count($localMatches) === 0) {
            $summary['unmatched']++;
            $preview[] = [
                'status' => 'unmatched',
                'event_code' => $eventCode,
                'source_match_id' => $clipFarmMatch['id'] ?? null,
                'source_match_number' => $rawNumber,
                'match_type' => $matchType,
                'match_number' => $matchNumber,
                'clips' => count($clips),
            ];
            continue;
        }
        if (count($localMatches) > 1) {
            $summary['ambiguous']++;
            $preview[] = [
                'status' => 'ambiguous',
                'event_code' => $eventCode,
                'source_match_id' => $clipFarmMatch['id'] ?? null,
                'source_match_number' => $rawNumber,
                'match_type' => $matchType,
                'match_number' => $matchNumber,
                'local_candidates' => array_map(fn($row) => $row['id'], $localMatches),
                'clips' => count($clips),
            ];
            continue;
        }

        $local = $localMatches[0];
        $summary['matched']++;

        if (!$dryRun) {
            $stmt = $pdo->prepare("
                UPDATE matches
                SET source_match_id = ?, source_match_number = ?, source_system = ?, updated_at = ?
                WHERE id = ?
            ");
            $stmt->execute([
                clipFarmStringOrNull($clipFarmMatch['id'] ?? null),
                $rawNumber > 0 ? $rawNumber : null,
                'clipfarm',
                date('c'),
                $local['id'],
            ]);
        }

        $mediaStatuses = [];
        foreach ($clips as $clip) {
            $mediaRow = clipFarmBuildMediaRow($local['id'], $clip, $clipFarmMatch, $event, 'clipfarm');
            $status = clipFarmUpsertExternalMedia($pdo, $mediaRow, $dryRun);
            $mediaStatuses[] = $status;
            if ($status === 'created') $summary['media_created']++;
            if ($status === 'updated') $summary['media_updated']++;
        }

        $preview[] = [
            'status' => 'matched',
            'event_code' => $eventCode,
            'local_match_id' => $local['id'],
            'display_name' => $local['display_name'] ?? formatMatchDisplayName($matchType, $matchNumber),
            'source_match_id' => $clipFarmMatch['id'] ?? null,
            'source_match_number' => $rawNumber,
            'match_type' => $matchType,
            'match_number' => $matchNumber,
            'clips' => count($clips),
            'media_statuses' => $mediaStatuses,
        ];
    }

    return [
        'success' => true,
        'dry_run' => $dryRun,
        'summary' => $summary,
        'preview' => $preview,
        'warnings' => $warnings,
    ];
}

function importClipFarmEvent(PDO $pdo, string $eventUrlOrId, array $options = []): array {
    $eventId = clipFarmExtractEventId($eventUrlOrId);
    if ($eventId === '') throw new Exception('Informe a URL ou ID do evento ClipFarm.');

    [$event, $matches] = clipFarmFetchEventBundle($eventId);
    return importClipFarmMatches($pdo, $event, $matches, $options);
}
