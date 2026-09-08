<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

function assertMatchAllianceTeams(array $body, int $allianceSize): void {
    $required = ['red_team1_number', 'red_team2_number', 'blue_team1_number', 'blue_team2_number'];
    if ($allianceSize === 3) {
        $required[] = 'red_team3_number';
        $required[] = 'blue_team3_number';
    }
    foreach ($required as $field) {
        if (!isset($body[$field]) || (int)$body[$field] <= 0) jsonError("Campo obrigatorio: $field", 400);
    }
}

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if ($id) {
                $stmt = $db->prepare("
                    SELECT m.*, c.name as championship_name, c.short_name as championship_short_name,
                           c.alliance_size as alliance_size, COALESCE(parent.timezone, c.timezone) as championship_timezone,
                           COALESCE(parent.location, c.location) as championship_location
                    FROM matches m
                    LEFT JOIN championships c ON c.id = m.championship_id
                    LEFT JOIN championships parent ON parent.id = c.parent_id
                    WHERE m.id = ?
                ");
                $stmt->execute([$id]);
                $match = $stmt->fetch();
                if (!$match) jsonError('Partida não encontrada', 404);

                $stmt2 = $db->prepare("SELECT sr.*, s.username as scout_username FROM scouting_rounds sr LEFT JOIN scouts s ON sr.scout_id = s.id WHERE sr.match_id = ?");
                $stmt2->execute([$id]);
                $rounds = $stmt2->fetchAll();

                if (!empty($rounds)) {
                    $roundIds = array_column($rounds, 'id');
                    $placeholders = implode(',', array_fill(0, count($roundIds), '?'));
                    $stmtC = $db->prepare("SELECT * FROM scouting_cycles WHERE scouting_round_id IN ($placeholders) ORDER BY cycle_number ASC");
                    $stmtC->execute($roundIds);
                    $cycles = $stmtC->fetchAll();
                    $cyclesByRound = [];
                    foreach ($cycles as $c) {
                        $cyclesByRound[$c['scouting_round_id']][] = $c;
                    }
                    foreach ($rounds as &$r) {
                        $r['cycles'] = $cyclesByRound[$r['id']] ?? [];
                    }
                    unset($r);
                }

                $match['scouting_rounds'] = $rounds;
                jsonResponse($match);
            } else {
                $search = $_GET['search'] ?? null;
                $status = $_GET['status'] ?? null;
                $type = $_GET['match_type'] ?? null;
                $championshipId = $_GET['championship_id'] ?? null;
                $includeChildren = ($_GET['include_children'] ?? '0') === '1';

                $where = [];
                $params = [];

                if ($search) {
                    $where[] = "(red_team1_number LIKE ? OR red_team1_name LIKE ? OR red_team2_number LIKE ? OR red_team2_name LIKE ? OR red_team3_number LIKE ? OR red_team3_name LIKE ? OR blue_team1_number LIKE ? OR blue_team1_name LIKE ? OR blue_team2_number LIKE ? OR blue_team2_name LIKE ? OR blue_team3_number LIKE ? OR blue_team3_name LIKE ?)";
                    $like = "%$search%";
                    $params = array_merge($params, array_fill(0, 12, $like));
                }
                if ($status) { $where[] = "status = ?"; $params[] = $status; }
                if ($type)   { $where[] = "match_type = ?"; $params[] = $type; }
                appendChampionshipScopeFilter($db, $where, $params, $championshipId, $includeChildren, 'm.championship_id');

                $sql = "
                    SELECT m.*, c.name as championship_name, c.short_name as championship_short_name,
                        c.alliance_size as alliance_size, COALESCE(parent.timezone, c.timezone) as championship_timezone,
                        COALESCE(parent.location, c.location) as championship_location,
                        (SELECT COALESCE(mm.thumbnail_path, mm.thumbnail_url)
                         FROM match_media mm
                         WHERE mm.match_id = m.id AND mm.file_type = 'video' AND COALESCE(mm.thumbnail_path, mm.thumbnail_url) IS NOT NULL
                         ORDER BY mm.uploaded_at ASC LIMIT 1) AS first_video_thumb,
                        EXISTS(SELECT 1 FROM match_media mm WHERE mm.match_id = m.id AND mm.file_type = 'video') AS has_video
                    FROM matches m
                    LEFT JOIN championships c ON c.id = m.championship_id
                    LEFT JOIN championships parent ON parent.id = c.parent_id"
                    . (count($where) ? " WHERE " . implode(' AND ', $where) : "")
                    . " ORDER BY c.sort_order ASC, m.match_type ASC, m.match_number ASC";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                $matches = $stmt->fetchAll();

                if (!empty($matches)) {
                    $matchIds = array_column($matches, 'id');
                    $placeholders = implode(',', array_fill(0, count($matchIds), '?'));

                    $stmtR = $db->prepare("SELECT sr.*, s.username as scout_username FROM scouting_rounds sr LEFT JOIN scouts s ON sr.scout_id = s.id WHERE sr.match_id IN ($placeholders)");
                    $stmtR->execute($matchIds);
                    $allRounds = $stmtR->fetchAll();

                    $roundIds = array_column($allRounds, 'id');
                    $cyclesByRound = [];
                    if (!empty($roundIds)) {
                        $cPlaceholders = implode(',', array_fill(0, count($roundIds), '?'));
                        $stmtC = $db->prepare("SELECT * FROM scouting_cycles WHERE scouting_round_id IN ($cPlaceholders) ORDER BY cycle_number ASC");
                        $stmtC->execute($roundIds);
                        foreach ($stmtC->fetchAll() as $c) {
                            $cyclesByRound[$c['scouting_round_id']][] = $c;
                        }
                    }

                    $roundsByMatch = [];
                    foreach ($allRounds as $r) {
                        $r['cycles'] = $cyclesByRound[$r['id']] ?? [];
                        $roundsByMatch[$r['match_id']][] = $r;
                    }
                    foreach ($matches as &$m) {
                        $m['scouting_rounds'] = $roundsByMatch[$m['id']] ?? [];
                    }
                    unset($m);
                }

                jsonResponse($matches);
            }
            break;

        case 'POST':
            $body = getRequestBody();
            $required = ['championship_id', 'match_type', 'match_number'];
            foreach ($required as $field) {
                if (!isset($body[$field]) || $body[$field] === '') {
                    jsonError("Campo obrigatório: $field", 400);
                }
            }

            $stmt = $db->prepare("SELECT id, scope_type, alliance_size FROM championships WHERE id = ?");
            $stmt->execute([$body['championship_id']]);
            $championship = $stmt->fetch();
            if (!$championship) jsonError('Campeonato nÃ£o encontrado', 404);
            if ($championship['scope_type'] === 'event_group') {
                jsonError('Partidas devem ser criadas em uma divisÃ£o, final ou campeonato independente', 400);
            }
            assertMatchAllianceTeams($body, normalizeAllianceSize($championship['alliance_size'] ?? 2));

            $display_name = formatMatchDisplayName($body['match_type'], (int)$body['match_number']);
            $id = generateId();

            $stmt = $db->prepare("INSERT INTO matches (id, championship_id, match_type, match_number, display_name, red_team1_number, red_team1_name, red_team2_number, red_team2_name, red_team3_number, red_team3_name, blue_team1_number, blue_team1_name, blue_team2_number, blue_team2_name, blue_team3_number, blue_team3_name, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')");
            $stmt->execute([
                $id,
                $body['championship_id'],
                $body['match_type'],
                (int)$body['match_number'],
                $display_name,
                (int)$body['red_team1_number'],
                $body['red_team1_name'] ?? null,
                (int)$body['red_team2_number'],
                $body['red_team2_name'] ?? null,
                !empty($body['red_team3_number']) ? (int)$body['red_team3_number'] : null,
                $body['red_team3_name'] ?? null,
                (int)$body['blue_team1_number'],
                $body['blue_team1_name'] ?? null,
                (int)$body['blue_team2_number'],
                $body['blue_team2_name'] ?? null,
                !empty($body['blue_team3_number']) ? (int)$body['blue_team3_number'] : null,
                $body['blue_team3_name'] ?? null,
                $body['scheduled_time'] ?? null,
            ]);

            enrollTeamsFromChampionshipMatches($db, $body['championship_id']);

            $stmt2 = $db->prepare("SELECT m.*, c.alliance_size, COALESCE(parent.timezone, c.timezone) AS championship_timezone, COALESCE(parent.location, c.location) AS championship_location FROM matches m LEFT JOIN championships c ON c.id = m.championship_id LEFT JOIN championships parent ON parent.id = c.parent_id WHERE m.id = ?");
            $stmt2->execute([$id]);
            jsonResponse($stmt2->fetch(), 201);
            break;

        case 'PUT':
            $body = getRequestBody();
            $stmt = $db->prepare("SELECT m.*, c.alliance_size FROM matches m LEFT JOIN championships c ON c.id = m.championship_id WHERE m.id = ?");
            $stmt->execute([$body['id'] ?? '']);
            $currentMatch = $stmt->fetch();
            if (!$currentMatch) jsonError('Partida nao encontrada', 404);
            $targetChampionshipId = $body['championship_id'] ?? $currentMatch['championship_id'];
            $stmt = $db->prepare("SELECT id, scope_type, alliance_size FROM championships WHERE id = ?");
            $stmt->execute([$targetChampionshipId]);
            $targetChampionship = $stmt->fetch();
            if (!$targetChampionship) jsonError('Campeonato nao encontrado', 404);
            assertMatchAllianceTeams(array_merge($currentMatch, $body), normalizeAllianceSize($targetChampionship['alliance_size'] ?? 2));
            if (empty($body['id'])) jsonError('id é obrigatório', 400);

            $updatable = [
                'championship_id', 'match_type', 'match_number', 'display_name',
                'red_team1_number', 'red_team1_name', 'red_team2_number', 'red_team2_name',
                'red_team3_number', 'red_team3_name',
                'blue_team1_number', 'blue_team1_name', 'blue_team2_number', 'blue_team2_name',
                'blue_team3_number', 'blue_team3_name',
                'red_score_auto', 'red_score_teleop', 'red_penalties', 'red_total',
                'blue_score_auto', 'blue_score_teleop', 'blue_penalties', 'blue_total',
                'scheduled_time', 'actual_start_time', 'status', 'notes',
            ];

            $fields = [];
            $params = [];
            foreach ($updatable as $field) {
                if (array_key_exists($field, $body)) {
                    $fields[] = "$field = ?";
                    $params[] = $body[$field];
                }
            }

            if (empty($fields)) jsonError('Nenhum campo para atualizar', 400);

            if (isset($body['championship_id'])) {
                $stmt = $db->prepare("SELECT id, scope_type FROM championships WHERE id = ?");
                $stmt->execute([$body['championship_id']]);
                $championship = $stmt->fetch();
                if (!$championship) jsonError('Campeonato nÃ£o encontrado', 404);
                if ($championship['scope_type'] === 'event_group') {
                    jsonError('Partidas devem ficar em uma divisÃ£o, final ou campeonato independente', 400);
                }
            }

            if (isset($body['match_type']) || isset($body['match_number'])) {
                $stmt = $db->prepare("SELECT match_type, match_number FROM matches WHERE id = ?");
                $stmt->execute([$body['id']]);
                $current = $stmt->fetch();
                $t = $body['match_type'] ?? $current['match_type'];
                $n = $body['match_number'] ?? $current['match_number'];
                $fields[] = "display_name = ?";
                $params[] = formatMatchDisplayName($t, (int)$n);
            }

            $fields[] = "updated_at = ?";
            $params[] = date('c');
            $params[] = $body['id'];

            $stmt = $db->prepare("UPDATE matches SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);

            if (isset($body['championship_id'])) {
                enrollTeamsFromChampionshipMatches($db, $body['championship_id']);
            }

            $stmt2 = $db->prepare("SELECT m.*, c.alliance_size, COALESCE(parent.timezone, c.timezone) AS championship_timezone, COALESCE(parent.location, c.location) AS championship_location FROM matches m LEFT JOIN championships c ON c.id = m.championship_id LEFT JOIN championships parent ON parent.id = c.parent_id WHERE m.id = ?");
            $stmt2->execute([$body['id']]);
            jsonResponse($stmt2->fetch());
            break;

        case 'DELETE':
            if (!$id) jsonError('id é obrigatório', 400);
            $stmt = $db->prepare("DELETE FROM matches WHERE id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) jsonError('Partida não encontrada', 404);
            jsonResponse(['success' => true]);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
