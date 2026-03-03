<?php
/**
 * API de Equipes
 * GET    /teams.php                   - Lista todas as equipes
 * GET    /teams.php?id=X              - Busca equipe por ID
 * GET    /teams.php?team_number=X     - Busca equipe por número
 * POST   /teams.php                   - Cria nova equipe
 * PUT    /teams.php                   - Atualiza equipe
 * DELETE /teams.php?id=X              - Remove equipe
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$teamNumber = $_GET['team_number'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if ($id) {
                $stmt = $db->prepare("SELECT * FROM teams WHERE id = ?");
                $stmt->execute([$id]);
                $team = $stmt->fetch();
                if (!$team) jsonError('Equipe não encontrada', 404);
                jsonResponse($team);
            } elseif ($teamNumber) {
                $stmt = $db->prepare("SELECT * FROM teams WHERE team_number = ?");
                $stmt->execute([$teamNumber]);
                $team = $stmt->fetch();
                if (!$team) jsonError('Equipe não encontrada', 404);
                jsonResponse($team);
            } else {
                $search = $_GET['search'] ?? null;
                if ($search) {
                    $stmt = $db->prepare("
                        SELECT * FROM teams 
                        WHERE team_number LIKE ? OR team_name LIKE ?
                        ORDER BY team_number ASC
                    ");
                    $like = "%$search%";
                    $stmt->execute([$like, $like]);
                } else {
                    $stmt = $db->prepare("SELECT * FROM teams ORDER BY team_number ASC");
                    $stmt->execute();
                }
                jsonResponse($stmt->fetchAll());
            }
            break;

        case 'POST':
            $body = getRequestBody();

            if (empty($body['team_number']) || empty($body['team_name'])) {
                jsonError('team_number e team_name são obrigatórios', 400);
            }

            $stmt = $db->prepare("
                INSERT INTO teams (team_number, team_name, logo_url, logo_position, instagram)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                (int)$body['team_number'],
                $body['team_name'],
                $body['logo_url'] ?? null,
                $body['logo_position'] ?? 'center',
                $body['instagram'] ?? null,
            ]);

            $newId = $db->lastInsertId();
            $stmt = $db->prepare("SELECT * FROM teams WHERE id = ?");
            $stmt->execute([$newId]);
            jsonResponse($stmt->fetch(), 201);
            break;

        case 'PUT':
            $body = getRequestBody();

            if (empty($body['id'])) {
                jsonError('id é obrigatório para atualização', 400);
            }

            $fields = [];
            $params = [];

            foreach (['team_number', 'team_name', 'logo_url', 'logo_position', 'instagram'] as $field) {
                if (array_key_exists($field, $body)) {
                    $fields[] = "$field = ?";
                    $params[] = $body[$field];
                }
            }

            if (empty($fields)) jsonError('Nenhum campo para atualizar', 400);

            $fields[] = "updated_at = ?";
            $params[] = date('c');
            $params[] = $body['id'];

            $stmt = $db->prepare("UPDATE teams SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);

            $stmt = $db->prepare("SELECT * FROM teams WHERE id = ?");
            $stmt->execute([$body['id']]);
            $team = $stmt->fetch();
            if (!$team) jsonError('Equipe não encontrada', 404);
            jsonResponse($team);
            break;

        case 'DELETE':
            if (!$id) jsonError('id é obrigatório', 400);

            $stmt = $db->prepare("SELECT id FROM teams WHERE id = ?");
            $stmt->execute([$id]);
            if (!$stmt->fetch()) jsonError('Equipe não encontrada', 404);

            $stmt = $db->prepare("DELETE FROM teams WHERE id = ?");
            $stmt->execute([$id]);
            jsonResponse(['success' => true]);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}