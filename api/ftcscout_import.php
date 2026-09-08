<?php

require_once 'ftcscout_import_lib.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Metodo nao permitido', 405);
    }

    $db = getDB();
    $body = getRequestBody();
    jsonResponse(importFtcScoutManualJson($db, $body));
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 400);
} catch (Exception $e) {
    jsonError($e->getMessage());
}
