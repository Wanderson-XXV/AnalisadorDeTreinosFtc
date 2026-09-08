<?php

require_once __DIR__ . '/ftcscout_championship_sync_lib.php';

try {
    if (($_GET['confirm'] ?? '') !== 'SYNC-FTCSCOUT-CHAMPIONSHIPS') {
        jsonError('Confirme pela URL: sync_ftcscout_championships.php?confirm=SYNC-FTCSCOUT-CHAMPIONSHIPS. Use &dry_run=1 para conferir antes de gravar.', 400);
    }

    $dryRun = ($_GET['dry_run'] ?? '0') === '1';
    jsonResponse(syncExistingChampionshipsFromFtcScout(getDB(), $dryRun));
} catch (Throwable $error) {
    jsonError($error->getMessage());
}
