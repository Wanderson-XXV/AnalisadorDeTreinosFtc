<?php

require_once __DIR__ . '/config.php';

const COMPARISON_SOURCE_TRAINING = 'training_period';
const COMPARISON_SOURCE_CHAMPIONSHIP = 'championship_average';

function emptyComparisonMetrics(): array {
    return [
        'rounds_count' => 0, 'cycles_count' => 0, 'total_hits' => 0, 'total_misses' => 0,
        'hit_rate' => 0.0, 'avg_hits_per_round' => 0.0, 'avg_cycles_per_round' => 0.0,
        'avg_cycle_duration_ms' => 0.0, 'avg_auto_hits_per_round' => 0.0,
        'avg_teleop_hits_per_round' => 0.0, 'max_hits_per_round' => 0.0,
        'consistency' => 0.0,
    ];
}

function summarizeComparisonRounds(array $rounds): array {
    if (empty($rounds)) return emptyComparisonMetrics();
    $roundsCount = count($rounds);
    $totals = ['cycles_count' => 0, 'total_hits' => 0, 'total_misses' => 0, 'total_duration' => 0.0, 'auto_hits' => 0, 'teleop_hits' => 0];
    foreach ($rounds as $round) {
        foreach ($totals as $key => $value) $totals[$key] += (float)($round[$key] ?? 0);
    }
    $attempts = $totals['total_hits'] + $totals['total_misses'];
    $roundScores = array_map(fn($round) => (float)($round['total_hits'] ?? 0), $rounds);
    $avgScore = $totals['total_hits'] / $roundsCount;
    $variance = array_sum(array_map(fn($score) => ($score - $avgScore) ** 2, $roundScores)) / $roundsCount;
    $consistency = max(0, 100 - ($avgScore > 0 ? (sqrt($variance) / $avgScore) * 100 : 0));
    return [
        'rounds_count' => $roundsCount,
        'cycles_count' => (int)$totals['cycles_count'],
        'total_hits' => (int)$totals['total_hits'],
        'total_misses' => (int)$totals['total_misses'],
        'hit_rate' => round($attempts > 0 ? ($totals['total_hits'] / $attempts) * 100 : 0, 2),
        'avg_hits_per_round' => round($avgScore, 2),
        'avg_cycles_per_round' => round($totals['cycles_count'] / $roundsCount, 2),
        'avg_cycle_duration_ms' => round($totals['cycles_count'] > 0 ? $totals['total_duration'] / $totals['cycles_count'] : 0, 2),
        'avg_auto_hits_per_round' => round($totals['auto_hits'] / $roundsCount, 2),
        'avg_teleop_hits_per_round' => round($totals['teleop_hits'] / $roundsCount, 2),
        'max_hits_per_round' => round(max($roundScores), 2),
        'consistency' => round($consistency, 2),
    ];
}

function calculateTrainingPeriodMetrics(PDO $db, string $startDate, ?string $endDate): array {
    $where = ["r.end_time IS NOT NULL", "r.end_time != ''", "DATE(r.start_time) >= ?"];
    $params = [$startDate];
    if ($endDate) { $where[] = "DATE(r.start_time) <= ?"; $params[] = $endDate; }
    $stmt = $db->prepare("
        SELECT r.id, COUNT(c.id) cycles_count, SUM(COALESCE(c.hits,0)) total_hits,
               SUM(COALESCE(c.misses,0)) total_misses, SUM(COALESCE(c.duration,0)) total_duration,
               SUM(CASE WHEN COALESCE(c.is_autonomous,0)=1 THEN COALESCE(c.hits,0) ELSE 0 END) auto_hits,
               SUM(CASE WHEN COALESCE(c.is_autonomous,0)=0 THEN COALESCE(c.hits,0) ELSE 0 END) teleop_hits
        FROM rounds r INNER JOIN cycles c ON c.round_id=r.id
        WHERE " . implode(' AND ', $where) . " GROUP BY r.id HAVING COUNT(c.id)>0");
    $stmt->execute($params);
    return summarizeComparisonRounds($stmt->fetchAll());
}

function fetchScoutingMetricRounds(PDO $db, ?string $championshipId, bool $includeChildren, ?int $teamNumber = null): array {
    $where = ['sr.is_locked = 0', "sr.end_time IS NOT NULL", "sr.end_time != ''"]; $params = [];
    appendChampionshipScopeFilter($db, $where, $params, $championshipId, $includeChildren, 'm.championship_id');
    if ($teamNumber !== null) { $where[] = 'sr.team_number = ?'; $params[] = $teamNumber; }
    $stmt = $db->prepare("
        SELECT sr.id, COUNT(sc.id) cycles_count, SUM(COALESCE(sc.hits,0)) total_hits,
               SUM(COALESCE(sc.misses,0)) total_misses, SUM(COALESCE(sc.duration,0)) total_duration,
               SUM(CASE WHEN COALESCE(sc.is_autonomous,0)=1 THEN COALESCE(sc.hits,0) ELSE 0 END) auto_hits,
               SUM(CASE WHEN COALESCE(sc.is_autonomous,0)=0 THEN COALESCE(sc.hits,0) ELSE 0 END) teleop_hits
        FROM scouting_rounds sr INNER JOIN matches m ON m.id=sr.match_id
        INNER JOIN scouting_cycles sc ON sc.scouting_round_id=sr.id
        WHERE " . implode(' AND ', $where) . " GROUP BY sr.id HAVING COUNT(sc.id)>0");
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function calculateChampionshipAverageMetrics(PDO $db, string $championshipId, bool $includeChildren): array {
    return summarizeComparisonRounds(fetchScoutingMetricRounds($db, $championshipId, $includeChildren));
}

function calculateTeamComparisonMetrics(PDO $db, int $teamNumber, ?string $championshipId, bool $includeChildren): array {
    return summarizeComparisonRounds(fetchScoutingMetricRounds($db, $championshipId, $includeChildren, $teamNumber));
}

function validateComparisonProfile(PDO $db, array $data): array {
    $sourceType = trim((string)($data['source_type'] ?? ''));
    $name = trim((string)($data['name'] ?? ''));
    if (!in_array($sourceType, [COMPARISON_SOURCE_TRAINING, COMPARISON_SOURCE_CHAMPIONSHIP], true)) throw new InvalidArgumentException('Tipo de fonte invalido');
    if ($name === '') throw new InvalidArgumentException('Nome fantasia e obrigatorio');
    $startDate = !empty($data['start_date']) ? (string)$data['start_date'] : null;
    $endDate = !empty($data['end_date']) ? (string)$data['end_date'] : null;
    $championshipId = !empty($data['championship_id']) ? (string)$data['championship_id'] : null;
    if ($sourceType === COMPARISON_SOURCE_TRAINING) {
        if (!$startDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate)) throw new InvalidArgumentException('Data inicial e obrigatoria');
        if ($endDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) throw new InvalidArgumentException('Data final invalida');
        if ($endDate && $startDate > $endDate) throw new InvalidArgumentException('A data inicial nao pode ser posterior a data final');
        $championshipId = null;
    } else {
        if (!$championshipId) throw new InvalidArgumentException('Campeonato e obrigatorio');
        $stmt = $db->prepare('SELECT id FROM championships WHERE id=?'); $stmt->execute([$championshipId]);
        if (!$stmt->fetch()) throw new InvalidArgumentException('Campeonato nao encontrado');
        $startDate = null; $endDate = null;
    }
    return [
        'source_type' => $sourceType, 'name' => $name,
        'nickname' => trim((string)($data['nickname'] ?? '')) ?: null,
        'logo_url' => trim((string)($data['logo_url'] ?? '')) ?: null,
        'logo_position' => trim((string)($data['logo_position'] ?? 'center')) ?: 'center',
        'start_date' => $startDate, 'end_date' => $endDate, 'championship_id' => $championshipId,
        'include_children' => !empty($data['include_children']) ? 1 : 0,
    ];
}

function hydrateComparisonProfile(PDO $db, array $profile): array {
    $profile['include_children'] = (bool)$profile['include_children'];
    $profile['metrics'] = $profile['source_type'] === COMPARISON_SOURCE_TRAINING
        ? calculateTrainingPeriodMetrics($db, $profile['start_date'], $profile['end_date'] ?: null)
        : calculateChampionshipAverageMetrics($db, $profile['championship_id'], $profile['include_children']);
    return $profile;
}

function getComparisonProfile(PDO $db, string $id): array {
    $stmt = $db->prepare("SELECT cp.*, c.name championship_name, c.short_name championship_short_name FROM comparison_profiles cp LEFT JOIN championships c ON c.id=cp.championship_id WHERE cp.id=?");
    $stmt->execute([$id]); $profile = $stmt->fetch();
    if (!$profile) throw new OutOfBoundsException('Perfil comparativo nao encontrado');
    return hydrateComparisonProfile($db, $profile);
}

function listComparisonProfiles(PDO $db): array {
    $rows = $db->query("SELECT cp.*, c.name championship_name, c.short_name championship_short_name FROM comparison_profiles cp LEFT JOIN championships c ON c.id=cp.championship_id ORDER BY cp.created_at, cp.name")->fetchAll();
    return array_map(fn($profile) => hydrateComparisonProfile($db, $profile), $rows);
}

function createComparisonProfile(PDO $db, array $input): array {
    $data = validateComparisonProfile($db, $input); $id = generateId(); $now = date('c');
    $stmt = $db->prepare("INSERT INTO comparison_profiles (id,source_type,name,nickname,logo_url,logo_position,start_date,end_date,championship_id,include_children,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([$id,$data['source_type'],$data['name'],$data['nickname'],$data['logo_url'],$data['logo_position'],$data['start_date'],$data['end_date'],$data['championship_id'],$data['include_children'],$now,$now]);
    return getComparisonProfile($db, $id);
}

function updateComparisonProfile(PDO $db, string $id, array $input): array {
    $current = getComparisonProfile($db, $id); unset($current['metrics'],$current['championship_name'],$current['championship_short_name']);
    $data = validateComparisonProfile($db, array_merge($current, $input));
    $stmt = $db->prepare("UPDATE comparison_profiles SET source_type=?,name=?,nickname=?,logo_url=?,logo_position=?,start_date=?,end_date=?,championship_id=?,include_children=?,updated_at=? WHERE id=?");
    $stmt->execute([$data['source_type'],$data['name'],$data['nickname'],$data['logo_url'],$data['logo_position'],$data['start_date'],$data['end_date'],$data['championship_id'],$data['include_children'],date('c'),$id]);
    return getComparisonProfile($db, $id);
}

function deleteComparisonProfile(PDO $db, string $id): void {
    $stmt = $db->prepare('DELETE FROM comparison_profiles WHERE id=?'); $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) throw new OutOfBoundsException('Perfil comparativo nao encontrado');
}
