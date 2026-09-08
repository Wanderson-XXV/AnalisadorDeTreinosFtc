<?php
require_once 'config.php';

$uploadDir = __DIR__ . '/uploads/logos';
$logos = [];

if (is_dir($uploadDir)) {
    $db = getDB();
    $stmt = $db->prepare("SELECT team_number, team_name, logo_url, logo_file_path FROM teams WHERE logo_file_path IS NOT NULL OR logo_url IS NOT NULL");
    $stmt->execute();
    $teams = $stmt->fetchAll();

    $teamsByPath = [];
    foreach ($teams as $team) {
        if ($team['logo_file_path']) {
            $teamsByPath[$team['logo_file_path']] = $team;
        }
    }

    $files = glob($uploadDir . '/*.{jpg,jpeg,png,webp,gif}', GLOB_BRACE);
    if ($files) {
        foreach ($files as $file) {
            $filename = basename($file);
            $relPath = 'uploads/logos/' . $filename;
            $team = $teamsByPath['uploads/logos/' . $filename] ?? null;
            $logos[] = [
                'filename' => $filename,
                'path' => $relPath,
                'team_number' => $team ? (string)$team['team_number'] : null,
                'team_name' => $team ? $team['team_name'] : $filename,
            ];
        }
    }
}

jsonResponse($logos);
