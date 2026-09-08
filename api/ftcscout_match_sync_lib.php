<?php

require_once __DIR__ . '/ftcscout_import_lib.php';

/** Busca a tabela oficial de um campeonato já cadastrado e aplica upsert nas partidas. */
function syncChampionshipMatchesFromFtcScout(PDO $db, string $championshipId, bool $dryRun = false, ?callable $fetcher = null): array {
    $stmt = $db->prepare('SELECT * FROM championships WHERE id = ?');
    $stmt->execute([$championshipId]);
    $championship = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$championship) throw new InvalidArgumentException('Campeonato não encontrado');

    $season = trim((string)($championship['season'] ?? ''));
    $eventCode = trim((string)($championship['event_code'] ?? ''));
    if ($season === '' || $eventCode === '' || str_contains($eventCode, ':')) {
        throw new InvalidArgumentException('Este campeonato não possui código FTCScout sincronizável');
    }

    $basePath = 'events/' . rawurlencode($season) . '/' . rawurlencode($eventCode);
    $event = ftcScoutFetchJson($basePath, $fetcher);
    $matches = ftcScoutFetchJson($basePath . '/matches', $fetcher);
    if (!$event) throw new RuntimeException('Evento não encontrado no FTCScout');
    if (!is_array($matches)) throw new RuntimeException('Tabela de partidas não encontrada no FTCScout');

    foreach ($matches as $match) {
        if (!is_array($match) || (string)($match['eventCode'] ?? '') !== $eventCode) {
            throw new RuntimeException('O FTCScout retornou uma partida que não pertence ao campeonato solicitado');
        }
    }

    $result = importFtcScoutManualJson($db, [
        'events_json' => json_encode([$event], JSON_UNESCAPED_UNICODE),
        'matches_json' => json_encode($matches, JSON_UNESCAPED_UNICODE),
        'dry_run' => $dryRun,
        'ftcscout_fetcher' => $fetcher,
    ]);
    $result['championship_id'] = $championshipId;
    $result['event_code'] = $eventCode;
    return $result;
}
