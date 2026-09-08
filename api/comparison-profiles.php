<?php
require_once __DIR__ . '/comparison_profiles_lib.php';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET'; $id = $_GET['id'] ?? null;
try {
    $db = getDB();
    if ($method === 'GET') jsonResponse($id ? getComparisonProfile($db, $id) : ['profiles' => listComparisonProfiles($db)]);
    if ($method === 'POST') jsonResponse(createComparisonProfile($db, getRequestBody()), 201);
    if ($method === 'PUT' || $method === 'PATCH') {
        $body = getRequestBody(); $profileId = $id ?: ($body['id'] ?? null);
        if (!$profileId) jsonError('ID e obrigatorio', 400);
        jsonResponse(updateComparisonProfile($db, $profileId, $body));
    }
    if ($method === 'DELETE') {
        if (!$id) jsonError('ID e obrigatorio', 400);
        deleteComparisonProfile($db, $id); jsonResponse(['success' => true]);
    }
    jsonError('Metodo nao permitido', 405);
} catch (InvalidArgumentException $e) { jsonError($e->getMessage(), 400);
} catch (OutOfBoundsException $e) { jsonError($e->getMessage(), 404);
} catch (Throwable $e) { jsonError($e->getMessage(), 500); }
