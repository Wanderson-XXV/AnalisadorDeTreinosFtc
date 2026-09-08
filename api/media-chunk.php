<?php
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '120');
ini_set('max_input_time', '120');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = getDB();

$db->exec("
    CREATE TABLE IF NOT EXISTS chunk_uploads (
        upload_id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        mime_type TEXT,
        total_chunks INTEGER NOT NULL,
        received_chunks INTEGER DEFAULT 0,
        category TEXT NOT NULL DEFAULT 'other',
        title TEXT,
        description TEXT,
        tagged_teams TEXT,
        uploaded_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
");

function cleanOldUploads(PDO $db): void {
    $cutoff = date('Y-m-d H:i:s', strtotime('-2 hours'));
    $stmt = $db->prepare("SELECT upload_id FROM chunk_uploads WHERE created_at < ?");
    $stmt->execute([$cutoff]);
    $old = $stmt->fetchAll();
    foreach ($old as $row) {
        $dir = __DIR__ . '/uploads/chunks/' . $row['upload_id'];
        if (is_dir($dir)) {
            array_map('unlink', glob("$dir/*"));
            rmdir($dir);
        }
    }
    $db->prepare("DELETE FROM chunk_uploads WHERE created_at < ?")->execute([$cutoff]);
}

if ($method !== 'POST') jsonError('Método não permitido', 405);

$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'init':
        cleanOldUploads($db);

        $matchId = $_POST['match_id'] ?? '';
        $filename = $_POST['filename'] ?? '';
        $mimeType = $_POST['mime_type'] ?? '';
        $totalChunks = (int)($_POST['total_chunks'] ?? 0);
        $category = $_POST['category'] ?? 'other';
        $title = $_POST['title'] ?? null;
        $description = $_POST['description'] ?? null;
        $taggedTeams = $_POST['tagged_teams'] ?? null;
        $uploadedBy = $_POST['uploaded_by'] ?? null;

        if (!$matchId || !$filename || $totalChunks < 1) {
            jsonError('match_id, filename e total_chunks obrigatórios', 400);
        }

        $uploadId = generateId();
        $chunkDir = __DIR__ . '/uploads/chunks/' . $uploadId;
        if (!is_dir($chunkDir)) mkdir($chunkDir, 0755, true);

        $stmt = $db->prepare("
            INSERT INTO chunk_uploads (upload_id, match_id, original_filename, mime_type, total_chunks, category, title, description, tagged_teams, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$uploadId, $matchId, $filename, $mimeType, $totalChunks, $category, $title, $description, $taggedTeams, $uploadedBy]);

        jsonResponse(['upload_id' => $uploadId]);
        break;

    case 'chunk':
        if (empty($_FILES['chunk'])) jsonError('chunk obrigatório', 400);
        $uploadId = $_POST['upload_id'] ?? '';
        $chunkIndex = (int)($_POST['chunk_index'] ?? -1);

        if (!$uploadId || $chunkIndex < 0) jsonError('upload_id e chunk_index obrigatórios', 400);

        $stmt = $db->prepare("SELECT * FROM chunk_uploads WHERE upload_id = ?");
        $stmt->execute([$uploadId]);
        $upload = $stmt->fetch();
        if (!$upload) jsonError('Upload não encontrado', 404);

        if ($chunkIndex >= (int)$upload['total_chunks']) jsonError('chunk_index inválido', 400);

        $chunkDir = __DIR__ . '/uploads/chunks/' . $uploadId;
        $chunkPath = $chunkDir . '/chunk_' . str_pad($chunkIndex, 5, '0', STR_PAD_LEFT);

        if (!move_uploaded_file($_FILES['chunk']['tmp_name'], $chunkPath)) {
            jsonError('Falha ao salvar chunk', 500);
        }

        $db->prepare("UPDATE chunk_uploads SET received_chunks = received_chunks + 1 WHERE upload_id = ?")->execute([$uploadId]);

        jsonResponse(['received' => $chunkIndex]);
        break;

    case 'complete':
        $uploadId = $_POST['upload_id'] ?? '';
        if (!$uploadId) jsonError('upload_id obrigatório', 400);

        $stmt = $db->prepare("SELECT * FROM chunk_uploads WHERE upload_id = ?");
        $stmt->execute([$uploadId]);
        $upload = $stmt->fetch();
        if (!$upload) jsonError('Upload não encontrado', 404);

        $chunkDir = __DIR__ . '/uploads/chunks/' . $uploadId;
        $chunks = glob($chunkDir . '/chunk_*');
        sort($chunks);

        if (count($chunks) < (int)$upload['total_chunks']) {
            jsonError('Faltam chunks: recebidos ' . count($chunks) . ' de ' . $upload['total_chunks'], 400);
        }

        $matchId = $upload['match_id'];
        $ext = strtolower(pathinfo($upload['original_filename'], PATHINFO_EXTENSION));
        $mime = $upload['mime_type'] ?? '';
        $fileType = str_starts_with($mime, 'video/') ? 'video' : (str_starts_with($mime, 'image/') ? 'image' : 'other');

        $uploadDir = __DIR__ . '/uploads/matches/' . $matchId;
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        $id = generateId();
        $filename = $id . '.' . $ext;
        $filePath = 'uploads/matches/' . $matchId . '/' . $filename;
        $dest = __DIR__ . '/' . $filePath;

        $out = fopen($dest, 'wb');
        if (!$out) jsonError('Falha ao criar arquivo final', 500);

        $totalSize = 0;
        foreach ($chunks as $chunkFile) {
            $in = fopen($chunkFile, 'rb');
            if ($in) {
                while (!feof($in)) {
                    $buf = fread($in, 8192);
                    fwrite($out, $buf);
                    $totalSize += strlen($buf);
                }
                fclose($in);
            }
        }
        fclose($out);

        array_map('unlink', $chunks);
        rmdir($chunkDir);

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
            $id, $matchId, $filename, $upload['original_filename'], $filePath,
            $fileType, $totalSize, $mime,
            $upload['category'], $upload['title'], $upload['description'],
            $upload['tagged_teams'], $upload['uploaded_by'], $thumbnailPath,
        ]);

        $db->prepare("DELETE FROM chunk_uploads WHERE upload_id = ?")->execute([$uploadId]);

        $stmt = $db->prepare("SELECT * FROM match_media WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse($stmt->fetch(), 201);
        break;

    default:
        jsonError('action obrigatória: init, chunk ou complete', 400);
}