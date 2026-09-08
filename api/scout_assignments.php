<?php
require_once 'config.php';
require_once 'scout_assignments_lib.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if (isset($_GET['scouts'])) {
                $stmt = $db->query("SELECT id, username, photo_path, created_at, last_active FROM scouts ORDER BY username ASC");
                jsonResponse($stmt->fetchAll());
                break;
            }

            $championshipId = $_GET['championship_id'] ?? null;
            $includeChildren = ($_GET['include_children'] ?? '0') === '1';
            $where = [];
            $params = [];
            appendChampionshipScopeFilter($db, $where, $params, $championshipId, $includeChildren, 'm.championship_id');

            $stmt = $db->prepare("
                SELECT
                    sa.id,
                    sa.match_id,
                    sa.team_number,
                    sa.scout_id,
                    sa.created_at,
                    sa.updated_at,
                    s.username as scout_username,
                    m.display_name as match_display_name,
                    m.match_type,
                    m.match_number,
                    m.red_team1_number, m.red_team1_name,
                    m.red_team2_number, m.red_team2_name,
                    m.red_team3_number, m.red_team3_name,
                    m.blue_team1_number, m.blue_team1_name,
                    m.blue_team2_number, m.blue_team2_name,
                    m.blue_team3_number, m.blue_team3_name,
                    m.status as match_status
                FROM scout_assignments sa
                LEFT JOIN scouts s ON sa.scout_id = s.id
                LEFT JOIN matches m ON sa.match_id = m.id
                " . (count($where) ? " WHERE " . implode(' AND ', $where) : "") . "
                ORDER BY m.match_type ASC, m.match_number ASC, sa.team_number ASC
            ");
            $stmt->execute($params);
            jsonResponse($stmt->fetchAll());
            break;

        case 'POST':
            $body = getRequestBody();

            if (isset($body['slots'])) {
                try {
                    jsonResponse(batchAssignScoutSlots($db, $body), 201);
                } catch (InvalidArgumentException $e) {
                    jsonError($e->getMessage(), 400);
                }
                break;
            }

            $required = ['match_id', 'team_number', 'scout_id'];
            foreach ($required as $field) {
                if (empty($body[$field])) {
                    jsonError("Campo obrigatório: $field", 400);
                }
            }

            $matchId    = $body['match_id'];
            $teamNumber = (int)$body['team_number'];
            $scoutId    = $body['scout_id'];
            $now        = date('c');

            $stmt = $db->prepare("SELECT * FROM matches WHERE id = ?");
            $stmt->execute([$matchId]);
            $match = $stmt->fetch();
            if (!$match) jsonError('Partida não encontrada', 404);
            if (!in_array($teamNumber, matchTeamNumbers($match), true)) jsonError('Equipe nao pertence a partida', 400);

            $stmt = $db->prepare("SELECT id FROM scouts WHERE id = ?");
            $stmt->execute([$scoutId]);
            if (!$stmt->fetch()) jsonError('Scout não encontrado', 404);

            $stmt = $db->prepare("SELECT id FROM scout_assignments WHERE match_id = ? AND team_number = ?");
            $stmt->execute([$matchId, $teamNumber]);
            $existing = $stmt->fetch();

            if ($existing) {
                $stmt = $db->prepare("UPDATE scout_assignments SET scout_id = ?, updated_at = ? WHERE match_id = ? AND team_number = ?");
                $stmt->execute([$scoutId, $now, $matchId, $teamNumber]);
                $assignmentId = $existing['id'];
            } else {
                $assignmentId = generateId();
                $stmt = $db->prepare("INSERT INTO scout_assignments (id, match_id, team_number, scout_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$assignmentId, $matchId, $teamNumber, $scoutId, $now, $now]);
            }

            $stmt = $db->prepare("
                SELECT sa.*, s.username as scout_username
                FROM scout_assignments sa
                LEFT JOIN scouts s ON sa.scout_id = s.id
                WHERE sa.id = ?
            ");
            $stmt->execute([$assignmentId]);
            jsonResponse($stmt->fetch(), $existing ? 200 : 201);
            break;

        case 'DELETE':
            $matchId    = $_GET['match_id'] ?? null;
            $teamNumber = $_GET['team_number'] ?? null;

            if (!$matchId || $teamNumber === null) jsonError('match_id e team_number são obrigatórios', 400);

            $stmt = $db->prepare("DELETE FROM scout_assignments WHERE match_id = ? AND team_number = ?");
            $stmt->execute([$matchId, (int)$teamNumber]);

            if ($stmt->rowCount() === 0) jsonError('Atribuição não encontrada', 404);
            jsonResponse(['success' => true]);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
