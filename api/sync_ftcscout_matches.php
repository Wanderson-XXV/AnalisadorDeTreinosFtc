<?php

require_once __DIR__ . '/ftcscout_match_sync_lib.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Método não permitido', 405);
    $body = getRequestBody();
    if (empty($body['championship_id'])) jsonError('championship_id é obrigatório', 400);

    jsonResponse(syncChampionshipMatchesFromFtcScout(
        getDB(),
        (string)$body['championship_id'],
        !empty($body['dry_run'])
    ));
} catch (InvalidArgumentException $error) {
    jsonError($error->getMessage(), 400);
} catch (Throwable $error) {
    jsonError($error->getMessage());
}
