<?php
/**
 * API de Scouts
 * POST  /scouts.php              - Criar ou logar scout (upsert por username)
 * GET   /scouts.php              - Lista todos os scouts
 * GET   /scouts.php?username=X   - Busca scout por username
 * GET   /scouts.php?id=X         - Busca scout por ID
 * PATCH /scouts.php?id=X         - Atualiza scout
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$username = $_GET['username'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if ($id) {
                $stmt = $db->prepare("SELECT * FROM scouts WHERE id = ?");
                $stmt->execute([$id]);
                $scout = $stmt->fetch();
                if (!$scout) jsonError('Scout não encontrado', 404);
                jsonResponse($scout);
            } elseif ($username) {
                $stmt = $db->prepare("SELECT * FROM scouts WHERE username = ?");
                $stmt->execute([$username]);
                $scout = $stmt->fetch();
                if (!$scout) jsonError('Scout não encontrado', 404);
                jsonResponse($scout);
            } else {
                $stmt = $db->prepare("SELECT * FROM scouts ORDER BY username ASC");
                $stmt->execute();
                jsonResponse($stmt->fetchAll());
            }
            break;

        case 'POST':
            $body = getRequestBody();

            if (empty($body['username'])) {
                jsonError('username é obrigatório', 400);
            }

            $username = trim($body['username']);

            // Upsert: se já existe, atualiza last_active e retorna
            $stmt = $db->prepare("SELECT * FROM scouts WHERE username = ?");
            $stmt->execute([$username]);
            $existing = $stmt->fetch();

            if ($existing) {
                $stmt = $db->prepare("UPDATE scouts SET last_active = ? WHERE id = ?");
                $stmt->execute([date('c'), $existing['id']]);
                $existing['last_active'] = date('c');
                jsonResponse($existing);
            }

            // Cria novo scout
            $newId = generateId();
            $stmt = $db->prepare("
                INSERT INTO scouts (id, username, photo_path, last_active)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([
                $newId,
                $username,
                $body['photo_path'] ?? null,
                date('c'),
            ]);

            $stmt = $db->prepare("SELECT * FROM scouts WHERE id = ?");
            $stmt->execute([$newId]);
            jsonResponse($stmt->fetch(), 201);
            break;

        case 'PATCH':
            if (!$id) jsonError('id é obrigatório', 400);

            $body = getRequestBody();
            $fields = [];
            $params = [];

            foreach (['photo_path'] as $field) {
                if (array_key_exists($field, $body)) {
                    $fields[] = "$field = ?";
                    $params[] = $body[$field];
                }
            }

            if (empty($fields)) jsonError('Nenhum campo para atualizar', 400);

            $params[] = $id;
            $stmt = $db->prepare("UPDATE scouts SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);

            $stmt = $db->prepare("SELECT * FROM scouts WHERE id = ?");
            $stmt->execute([$id]);
            $scout = $stmt->fetch();
            if (!$scout) jsonError('Scout não encontrado', 404);
            jsonResponse($scout);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}