<?php

require_once __DIR__ . '/clipfarm_import_lib.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Metodo nao permitido', 405);
    }

    $db = getDB();
    $body = getRequestBody();

    $eventUrlOrId = clipFarmStringOrNull($body['clipfarm_event_url'] ?? ($body['event_url'] ?? ($body['event_id'] ?? null)));
    if (!$eventUrlOrId) {
        jsonError('Informe clipfarm_event_url ou event_id.', 400);
    }

    $options = [
        'dry_run' => !empty($body['dry_run']),
        'event_code' => clipFarmStringOrNull($body['event_code'] ?? null),
    ];

    jsonResponse(importClipFarmEvent($db, $eventUrlOrId, $options));
} catch (Exception $e) {
    jsonError($e->getMessage(), 400);
}
