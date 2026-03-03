<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if ($id) {
                $stmt = $db->prepare("SELECT * FROM matches WHERE id = ?");
                $stmt->execute([$id]);
                $match = $stmt->fetch();
                if (!$match) jsonError('Partida não encontrada', 404);

                $stmt2 = $db->prepare("SELECT sr.*, s.username as scout_username FROM scouting_rounds sr LEFT JOIN scouts s ON sr.scout_id = s.id WHERE sr.match_id = ?");
                $stmt2->execute([$id]);
                $match['scouting_rounds'] = $stmt2->fetchAll();

                jsonResponse($match);
            } else {
                $search = $_GET['search'] ?? null;
                $status = $_GET['status'] ?? null;
                $type = $_GET['match_type'] ?? null;

                $where = [];
                $params = [];

                if ($search) {
                    $where[] = "(red_team1_number LIKE ? OR red_team1_name LIKE ? OR red_team2_number LIKE ? OR red_team2_name LIKE ? OR blue_team1_number LIKE ? OR blue_team1_name LIKE ? OR blue_team2_number LIKE ? OR blue_team2_name LIKE ?)";
                    $like = "%$search%";
                    $params = array_merge($params, array_fill(0, 8, $like));
                }
                if ($status) { $where[] = "status = ?"; $params[] = $status; }
                if ($type)   { $where[] = "match_type = ?"; $params[] = $type; }

                $sql = "SELECT * FROM matches" . (count($where) ? " WHERE " . implode(' AND ', $where) : "") . " ORDER BY match_type ASC, match_number ASC";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                jsonResponse($stmt->fetchAll());
            }
            break;

        case 'POST':
            $body = getRequestBody();
            $required = ['match_type', 'match_number', 'red_team1_number', 'red_team2_number', 'blue_team1_number', 'blue_team2_number'];
            foreach ($required as $field) {
                if (!isset($body[$field]) || $body[$field] === '') {
                    jsonError("Campo obrigatório: $field", 400);
                }
            }

            $prefix = $body['match_type'] === 'qualification' ? 'Q' : 'E';
            $display_name = $prefix . $body['match_number'];
            $id = generateId();

            $stmt = $db->prepare("INSERT INTO matches (id, match_type, match_number, display_name, red_team1_number, red_team1_name, red_team2_number, red_team2_name, blue_team1_number, blue_team1_name, blue_team2_number, blue_team2_name, scheduled_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')");
            $stmt->execute([
                $id,
                $body['match_type'],
                (int)$body['match_number'],
                $display_name,
                (int)$body['red_team1_number'],
                $body['red_team1_name'] ?? null,
                (int)$body['red_team2_number'],
                $body['red_team2_name'] ?? null,
                (int)$body['blue_team1_number'],
                $body['blue_team1_name'] ?? null,
                (int)$body['blue_team2_number'],
                $body['blue_team2_name'] ?? null,
                $body['scheduled_time'] ?? null,
            ]);

            $stmt2 = $db->prepare("SELECT * FROM matches WHERE id = ?");
            $stmt2->execute([$id]);
            jsonResponse($stmt2->fetch(), 201);
            break;

        case 'PUT':
            $body = getRequestBody();
            if (empty($body['id'])) jsonError('id é obrigatório', 400);

            $updatable = [
                'match_type', 'match_number', 'display_name',
                'red_team1_number', 'red_team1_name', 'red_team2_number', 'red_team2_name',
                'blue_team1_number', 'blue_team1_name', 'blue_team2_number', 'blue_team2_name',
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

            if (isset($body['match_type']) || isset($body['match_number'])) {
                $stmt = $db->prepare("SELECT match_type, match_number FROM matches WHERE id = ?");
                $stmt->execute([$body['id']]);
                $current = $stmt->fetch();
                $t = $body['match_type'] ?? $current['match_type'];
                $n = $body['match_number'] ?? $current['match_number'];
                $fields[] = "display_name = ?";
                $params[] = ($t === 'qualification' ? 'Q' : 'E') . $n;
            }

            $fields[] = "updated_at = ?";
            $params[] = date('c');
            $params[] = $body['id'];

            $stmt = $db->prepare("UPDATE matches SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);

            $stmt2 = $db->prepare("SELECT * FROM matches WHERE id = ?");
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