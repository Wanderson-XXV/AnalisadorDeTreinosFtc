<?php
ini_set('upload_max_filesize', '512M');
ini_set('post_max_size', '520M');
ini_set('memory_limit', '768M');
ini_set('max_execution_time', '300');
ini_set('max_input_time', '300');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/clipfarm_import_lib.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$db = getDB();

switch ($method) {
    case 'GET':
        if (!empty($_GET['id'])) {
            $stmt = $db->prepare("SELECT * FROM match_media WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $row = $stmt->fetch();
            if (!$row) jsonError('Não encontrado', 404);
            jsonResponse($row);
        }

        if (empty($_GET['match_id'])) jsonError('match_id obrigatório', 400);

        $stmt = $db->prepare("SELECT * FROM match_media WHERE match_id = ? ORDER BY uploaded_at DESC");
        $stmt->execute([$_GET['match_id']]);
        jsonResponse($stmt->fetchAll());
        break;

    case 'POST':
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') !== false) {
            $body = json_decode(file_get_contents('php://input'), true);
            if (!is_array($body)) jsonError('JSON invalido', 400);

            try {
                jsonResponse(saveExternalMatchMedia($db, $body), 201);
            } catch (Exception $e) {
                jsonError($e->getMessage(), 400);
            }
        }

        if (empty($_FILES['file'])) jsonError('Arquivo obrigatório', 400);
        if (empty($_POST['match_id'])) jsonError('match_id obrigatório', 400);
        if (empty($_POST['category'])) jsonError('category obrigatória', 400);

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) jsonError('Erro no upload: ' . $file['error'], 400);

        $matchId = $_POST['match_id'];
        $category = $_POST['category'];
        $title = $_POST['title'] ?? null;
        $description = $_POST['description'] ?? null;
        $taggedTeams = $_POST['tagged_teams'] ?? null;
        $uploadedBy = $_POST['uploaded_by'] ?? null;

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $mime = $file['type'];
        $fileType = str_starts_with($mime, 'video/') ? 'video' : (str_starts_with($mime, 'image/') ? 'image' : 'other');

        $uploadDir = __DIR__ . '/uploads/matches/' . $matchId;
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        $id = generateId();
        $filename = $id . '.' . $ext;
        $filePath = 'uploads/matches/' . $matchId . '/' . $filename;
        $dest = __DIR__ . '/' . $filePath;

        if (!move_uploaded_file($file['tmp_name'], $dest)) jsonError('Falha ao salvar arquivo', 500);

        $thumbnailPath = null;
        if (!empty($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === UPLOAD_ERR_OK) {
            $thumbFilename = 'thumb_' . $id . '.jpg';
            $thumbDest = $uploadDir . '/' . $thumbFilename;
            if (move_uploaded_file($_FILES['thumbnail']['tmp_name'], $thumbDest)) {
                $thumbnailPath = 'uploads/matches/' . $matchId . '/' . $thumbFilename;
            }
        }

        $stmt = $db->prepare("
            INSERT INTO match_media (id, match_id, filename, original_filename, file_path, file_type, file_size, mime_type, category, title, description, tagged_teams, uploaded_by, thumbnail_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $id, $matchId, $filename, $file['name'], $filePath,
            $fileType, $file['size'], $mime,
            $category, $title, $description, $taggedTeams, $uploadedBy, $thumbnailPath,
        ]);

        $stmt = $db->prepare("SELECT * FROM match_media WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse($stmt->fetch(), 201);
        break;

    case 'PATCH':
        if (empty($_GET['id'])) jsonError('id obrigatorio', 400);

        $body = getRequestBody();
        $fields = [];
        $params = [];

        if (array_key_exists('video_match_start_ms', $body)) {
            $startMs = $body['video_match_start_ms'];
            if ($startMs === null || $startMs === '') {
                $fields[] = 'video_match_start_ms = ?';
                $params[] = null;
            } elseif (is_numeric($startMs)) {
                $fields[] = 'video_match_start_ms = ?';
                $params[] = (int)$startMs;
            } else {
                jsonError('video_match_start_ms invalido', 400);
            }
        }

        if (empty($fields)) jsonError('Nenhum campo para atualizar', 400);

        $params[] = $_GET['id'];
        $stmt = $db->prepare("UPDATE match_media SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);

        if ($stmt->rowCount() === 0) jsonError('Nao encontrado', 404);

        $stmt = $db->prepare("SELECT * FROM match_media WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        jsonResponse($stmt->fetch());
        break;

    case 'DELETE':
        if (empty($_GET['id'])) jsonError('id obrigatório', 400);

        $stmt = $db->prepare("SELECT * FROM match_media WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Não encontrado', 404);

        $physical = __DIR__ . '/' . $row['file_path'];
        if (file_exists($physical)) unlink($physical);

        $stmt = $db->prepare("DELETE FROM match_media WHERE id = ?");
        $stmt->execute([$_GET['id']]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Método não permitido', 405);
}
