<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            $championshipId = $_GET['championship_id'] ?? null;
            $includeChildren = ($_GET['include_children'] ?? '0') === '1';
            $teamNumber = $_GET['team_number'] ?? null;

            $where = [];
            $params = [];
            if ($championshipId) {
                appendChampionshipScopeFilter($db, $where, $params, $championshipId, $includeChildren, 'ct.championship_id');
            }
            if ($teamNumber) {
                $where[] = "ct.team_number = ?";
                $params[] = (int)$teamNumber;
            }

            $sql = "
                SELECT
                    ct.*,
                    t.team_name,
                    t.logo_url,
                    t.logo_position,
                    t.instagram,
                    c.name as championship_name,
                    c.short_name as championship_short_name
                FROM championship_teams ct
                LEFT JOIN teams t ON t.team_number = ct.team_number
                LEFT JOIN championships c ON c.id = ct.championship_id"
                . (count($where) ? " WHERE " . implode(' AND ', $where) : "")
                . " ORDER BY c.sort_order ASC, c.name ASC, ct.team_number ASC";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            jsonResponse($stmt->fetchAll());
            break;

        case 'POST':
            $body = getRequestBody();
            if (empty($body['championship_id'])) jsonError('championship_id é obrigatório', 400);
            if (empty($body['team_number'])) jsonError('team_number é obrigatório', 400);

            $championshipId = $body['championship_id'];
            $teamNumber = (int)$body['team_number'];
            $now = date('c');

            $stmt = $db->prepare("SELECT id FROM championships WHERE id = ?");
            $stmt->execute([$championshipId]);
            if (!$stmt->fetch()) jsonError('Campeonato não encontrado', 404);

            $stmt = $db->prepare("SELECT id FROM teams WHERE team_number = ?");
            $stmt->execute([$teamNumber]);
            if (!$stmt->fetch()) jsonError('Equipe não encontrada', 404);

            $stmt = $db->prepare("SELECT id FROM championship_teams WHERE championship_id = ? AND team_number = ?");
            $stmt->execute([$championshipId, $teamNumber]);
            $existing = $stmt->fetch();

            if ($existing) {
                $stmt = $db->prepare("UPDATE championship_teams SET status = ?, notes = ?, updated_at = ? WHERE id = ?");
                $stmt->execute([$body['status'] ?? 'active', $body['notes'] ?? null, $now, $existing['id']]);
                $entryId = $existing['id'];
            } else {
                $entryId = generateId();
                $stmt = $db->prepare("
                    INSERT INTO championship_teams (id, championship_id, team_number, status, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $entryId,
                    $championshipId,
                    $teamNumber,
                    $body['status'] ?? 'active',
                    $body['notes'] ?? null,
                    $now,
                    $now,
                ]);
            }

            $stmt = $db->prepare("SELECT * FROM championship_teams WHERE id = ?");
            $stmt->execute([$entryId]);
            jsonResponse($stmt->fetch(), $existing ? 200 : 201);
            break;

        case 'DELETE':
            if ($id) {
                $stmt = $db->prepare("DELETE FROM championship_teams WHERE id = ?");
                $stmt->execute([$id]);
            } else {
                $championshipId = $_GET['championship_id'] ?? null;
                $teamNumber = $_GET['team_number'] ?? null;
                if (!$championshipId || !$teamNumber) jsonError('id ou championship_id/team_number são obrigatórios', 400);
                $stmt = $db->prepare("DELETE FROM championship_teams WHERE championship_id = ? AND team_number = ?");
                $stmt->execute([$championshipId, (int)$teamNumber]);
            }

            if ($stmt->rowCount() === 0) jsonError('Inscrição não encontrada', 404);
            jsonResponse(['success' => true]);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
