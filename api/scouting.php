<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if (!$id) jsonError('id é obrigatório', 400);

            $action = $_GET['action'] ?? null;

            if ($action === 'unlock') {
                $stmt = $db->prepare("UPDATE scouting_rounds SET is_locked = 0, updated_at = ? WHERE id = ? AND is_locked = 1");
                $stmt->execute([date('c'), $id]);
                jsonResponse(['success' => true]);
                break;
            }

            $stmt = $db->prepare("SELECT sr.*, s.username as scout_username FROM scouting_rounds sr LEFT JOIN scouts s ON sr.scout_id = s.id WHERE sr.id = ?");
            $stmt->execute([$id]);
            $round = $stmt->fetch();
            if (!$round) jsonError('Scouting round não encontrado', 404);

            $stmt2 = $db->prepare("SELECT * FROM scouting_cycles WHERE scouting_round_id = ? ORDER BY cycle_number ASC");
            $stmt2->execute([$id]);
            $round['cycles'] = $stmt2->fetchAll();

            $stmt3 = $db->prepare("SELECT * FROM matches WHERE id = ?");
            $stmt3->execute([$round['match_id']]);
            $round['match'] = $stmt3->fetch();

            jsonResponse($round);
            break;

        case 'POST':
            $body = getRequestBody();

            $required = ['match_id', 'team_number', 'scout_id'];
            foreach ($required as $field) {
                if (empty($body[$field])) {
                    jsonError("Campo obrigatório: $field", 400);
                }
            }

            $matchId = $body['match_id'];
            $teamNumber = (int)$body['team_number'];
            $scoutId = $body['scout_id'];
            $transitionDurationMs = normalizeTransitionDurationMs($body['transition_duration_ms'] ?? null);

            $stmt = $db->prepare("SELECT * FROM matches WHERE id = ?");
            $stmt->execute([$matchId]);
            $match = $stmt->fetch();
            if (!$match) jsonError('Partida não encontrada', 404);
            if (!in_array($teamNumber, matchTeamNumbers($match), true)) jsonError('Equipe nao pertence a partida', 400);

            $stmt = $db->prepare("SELECT id, is_locked FROM scouting_rounds WHERE match_id = ? AND team_number = ?");
            $stmt->execute([$matchId, $teamNumber]);
            $existing = $stmt->fetch();

            if ($existing) {
                if ($existing['is_locked']) {
                    jsonError('Esta equipe já está sendo analisada nesta partida', 409);
                }
                jsonError('Já existe um scouting concluído para esta equipe nesta partida. Exclua o anterior para refazer.', 409);
            }

            $id = generateId();
            $now = date('c');

            $stmt = $db->prepare("INSERT INTO scouting_rounds (id, match_id, team_number, scout_id, start_time, transition_duration_ms, is_locked, locked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)");
            $stmt->execute([$id, $matchId, $teamNumber, $scoutId, $now, $transitionDurationMs, $now, $now, $now]);

            $stmt2 = $db->prepare("SELECT sr.*, s.username as scout_username FROM scouting_rounds sr LEFT JOIN scouts s ON sr.scout_id = s.id WHERE sr.id = ?");
            $stmt2->execute([$id]);
            $round = $stmt2->fetch();
            $round['cycles'] = [];

            $stmt3 = $db->prepare("SELECT * FROM matches WHERE id = ?");
            $stmt3->execute([$matchId]);
            $round['match'] = $stmt3->fetch();

            jsonResponse($round, 201);
            break;

        case 'PATCH':
            if (!$id) jsonError('id é obrigatório', 400);
            $body = getRequestBody();

            $stmt = $db->prepare("SELECT * FROM scouting_rounds WHERE id = ?");
            $stmt->execute([$id]);
            $round = $stmt->fetch();
            if (!$round) jsonError('Scouting round não encontrado', 404);

            $fields = [];
            $params = [];

            $updatable = ['end_time', 'total_duration', 'observations', 'robot_issues', 'strategy_notes'];
            foreach ($updatable as $field) {
                if (array_key_exists($field, $body)) {
                    $fields[] = "$field = ?";
                    $params[] = $body[$field];
                }
            }
            if (array_key_exists('transition_duration_ms', $body)) {
                $fields[] = "transition_duration_ms = ?";
                $params[] = normalizeTransitionDurationMs($body['transition_duration_ms']);
            }

            $fields[] = "is_locked = ?";
            $params[] = 0;
            $fields[] = "updated_at = ?";
            $params[] = date('c');
            $params[] = $id;

            $stmt = $db->prepare("UPDATE scouting_rounds SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);

            $stmt2 = $db->prepare("SELECT sr.*, s.username as scout_username FROM scouting_rounds sr LEFT JOIN scouts s ON sr.scout_id = s.id WHERE sr.id = ?");
            $stmt2->execute([$id]);
            $updated = $stmt2->fetch();

            $stmt3 = $db->prepare("SELECT * FROM scouting_cycles WHERE scouting_round_id = ? ORDER BY cycle_number ASC");
            $stmt3->execute([$id]);
            $updated['cycles'] = $stmt3->fetchAll();

            jsonResponse($updated);
            break;

        case 'DELETE':
            if (!$id) jsonError('id é obrigatório', 400);

            $stmt = $db->prepare("DELETE FROM scouting_cycles WHERE scouting_round_id = ?");
            $stmt->execute([$id]);

            $stmt = $db->prepare("DELETE FROM scouting_rounds WHERE id = ?");
            $stmt->execute([$id]);

            if ($stmt->rowCount() === 0) jsonError('Scouting round não encontrado', 404);
            jsonResponse(['success' => true]);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
