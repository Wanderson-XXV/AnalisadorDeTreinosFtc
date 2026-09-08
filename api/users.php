<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            $stmt = $db->query("SELECT id, username, photo_path, transition_duration_ms, created_at, last_active FROM scouts ORDER BY username ASC");
            jsonResponse($stmt->fetchAll());
            break;

        case 'POST':
            $body = getRequestBody();
            if (empty($body['username'])) jsonError('username é obrigatório', 400);

            $username = trim($body['username']);

            $stmt = $db->prepare("SELECT id FROM scouts WHERE username = ?");
            $stmt->execute([$username]);
            if ($stmt->fetch()) jsonError("Usuário '$username' já existe", 409);

            $newId = generateId();
            $now   = date('c');
            $db->prepare("INSERT INTO scouts (id, username, created_at) VALUES (?, ?, ?)")
               ->execute([$newId, $username, $now]);

            $stmt = $db->prepare("SELECT id, username, photo_path, transition_duration_ms, created_at, last_active FROM scouts WHERE id = ?");
            $stmt->execute([$newId]);
            jsonResponse($stmt->fetch(), 201);
            break;

        case 'DELETE':
            if (!$id) jsonError('id é obrigatório', 400);

            $stmt = $db->prepare("DELETE FROM scouts WHERE id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) jsonError('Usuário não encontrado', 404);

            jsonResponse(['success' => true]);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
