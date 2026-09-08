<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if ($id) {
                requireScoutSession($db, $id);
                $stmt = $db->prepare("SELECT id, username, photo_path, transition_duration_ms, keyboard_shortcuts_json, password_hash, created_at, last_active FROM scouts WHERE id = ?");
                $stmt->execute([$id]);
                $scout = $stmt->fetch();
                if (!$scout) jsonError('Usuario nao encontrado', 404);
                jsonResponse(normalizeScoutRow($scout));
            } else {
                $stmt = $db->query("SELECT id, username, photo_path, transition_duration_ms, keyboard_shortcuts_json, password_hash, created_at, last_active FROM scouts ORDER BY username ASC");
                jsonResponse(array_map('normalizeScoutRow', $stmt->fetchAll()));
            }
            break;

        case 'POST':
            $body = getRequestBody();
            if (empty($body['username'])) jsonError('username obrigatorio', 400);

            $username = trim($body['username']);

            $stmt = $db->prepare("SELECT id, username, photo_path, transition_duration_ms, keyboard_shortcuts_json, password_hash, created_at, last_active FROM scouts WHERE username = ?");
            $stmt->execute([$username]);
            $scout = $stmt->fetch();

            if (!$scout) jsonError('Usuario nao encontrado. Peca a um administrador para cadastra-lo.', 404);

            // Perfis comuns continuam com entrada rapida. O perfil que tiver senha
            // configurada precisa confirma-la antes de abrir a conta.
            if (!empty($scout['password_hash'])) {
                $password = (string)($body['password'] ?? '');
                if ($password === '' || !password_verify($password, $scout['password_hash'])) {
                    jsonError('Senha incorreta.', 401);
                }
            }

            $now = date('c');
            $db->prepare("UPDATE scouts SET last_active = ? WHERE id = ?")->execute([$now, $scout['id']]);
            $scout['last_active'] = $now;

            jsonResponse(array_merge(normalizeScoutRow($scout), ['session_token' => createScoutSession($db, $scout['id'])]));
            break;

        case 'PATCH':
            if (!$id) jsonError('id obrigatorio', 400);
            requireScoutSession($db, $id);
            $body = getRequestBody();

            $fields = [];
            $params = [];

            if (array_key_exists('transition_duration_ms', $body)) {
                $fields[] = 'transition_duration_ms = ?';
                $params[] = normalizeTransitionDurationMs($body['transition_duration_ms']);
            }
            if (array_key_exists('keyboard_shortcuts', $body)) {
                $fields[] = 'keyboard_shortcuts_json = ?';
                $params[] = json_encode(normalizeKeyboardShortcuts($body['keyboard_shortcuts']));
            }
            if (array_key_exists('new_password', $body)) {
                $newPassword = (string)$body['new_password'];
                if (strlen($newPassword) < 8) jsonError('A senha deve ter pelo menos 8 caracteres.', 400);
                $currentPassword = (string)($body['current_password'] ?? '');
                $passwordLookup = $db->prepare("SELECT password_hash FROM scouts WHERE id = ?");
                $passwordLookup->execute([$id]);
                $stored = $passwordLookup->fetch();
                if (!$stored) jsonError('Usuario nao encontrado', 404);
                if (!empty($stored['password_hash']) && !password_verify($currentPassword, $stored['password_hash'])) {
                    jsonError('A senha atual esta incorreta.', 401);
                }
                $fields[] = 'password_hash = ?';
                $params[] = password_hash($newPassword, PASSWORD_DEFAULT);
            }

            if (empty($fields)) jsonError('Nenhum campo para atualizar', 400);

            $fields[] = 'last_active = ?';
            $params[] = date('c');
            $params[] = $id;

            $stmt = $db->prepare("UPDATE scouts SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);
            if ($stmt->rowCount() === 0) jsonError('Usuario nao encontrado', 404);

            if (array_key_exists('new_password', $body)) {
                $db->prepare("DELETE FROM scout_sessions WHERE scout_id = ?")->execute([$id]);
            }

            $stmt = $db->prepare("SELECT id, username, photo_path, transition_duration_ms, keyboard_shortcuts_json, password_hash, created_at, last_active FROM scouts WHERE id = ?");
            $stmt->execute([$id]);
            jsonResponse(normalizeScoutRow($stmt->fetch()));
            break;

        default:
            jsonError('Metodo nao permitido', 405);
    }
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 400);
} catch (Exception $e) {
    jsonError($e->getMessage());
}
