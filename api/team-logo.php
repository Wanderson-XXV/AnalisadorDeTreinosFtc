<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Método não suportado', 405);
if (empty($_FILES['file'])) jsonError('Arquivo não enviado', 400);

$file = $_FILES['file'];
$allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!in_array($file['type'], $allowed)) jsonError('Formato não suportado', 400);
if ($file['size'] > 10 * 1024 * 1024) jsonError('Arquivo muito grande. Máximo 10 MB', 400);

$uploadDir = __DIR__ . '/uploads/logos';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid() . '_' . bin2hex(random_bytes(4)) . '.' . strtolower($ext);
$filePath = $uploadDir . '/' . $filename;
$relPath = 'uploads/logos/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $filePath)) jsonError('Erro ao salvar arquivo', 500);

jsonResponse(['file_path' => $relPath], 201);
