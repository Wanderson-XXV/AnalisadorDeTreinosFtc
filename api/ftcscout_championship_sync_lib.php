<?php

require_once __DIR__ . '/ftcscout_import_lib.php';

function ftcScoutValidTimezone(?string $timezone): ?string {
    if ($timezone === null || $timezone === '') return null;
    return in_array($timezone, DateTimeZone::listIdentifiers(), true) ? $timezone : null;
}

/**
 * Atualiza metadados dos campeonatos que já existem localmente, sem criar
 * campeonatos, equipes, inscrições ou partidas.
 */
function syncExistingChampionshipsFromFtcScout(PDO $db, bool $dryRun = false, ?callable $fetcher = null): array {
    $championships = $db->query("SELECT id, name, event_code, season, level, starts_at, ends_at, timezone, location FROM championships WHERE trim(COALESCE(event_code, '')) <> '' ORDER BY season, event_code")->fetchAll(PDO::FETCH_ASSOC);
    $summary = ['found' => count($championships), 'updated' => 0, 'unchanged' => 0, 'skipped' => 0];
    $changes = [];
    $skipped = [];

    foreach ($championships as $championship) {
        $eventCode = trim((string)$championship['event_code']);
        $season = trim((string)$championship['season']);

        // Grupos sintéticos (por exemplo, FTCCMP1:GROUP) não existem no FTCScout.
        if ($season === '' || str_contains($eventCode, ':')) {
            $summary['skipped']++;
            $skipped[] = ['id' => $championship['id'], 'event_code' => $eventCode, 'reason' => 'codigo local sem evento equivalente no FTCScout'];
            continue;
        }

        $remote = ftcScoutFetchJson('events/' . rawurlencode($season) . '/' . rawurlencode($eventCode), $fetcher);
        if (!$remote) {
            $summary['skipped']++;
            $skipped[] = ['id' => $championship['id'], 'event_code' => $eventCode, 'reason' => 'evento não encontrado no FTCScout'];
            continue;
        }

        $event = ftcScoutEventFromNode($remote, $season, $eventCode);
        $timezone = ftcScoutValidTimezone(ftcScoutStringOrNull($remote['timezone'] ?? null));
        if (!$event || !$timezone) {
            $summary['skipped']++;
            $skipped[] = ['id' => $championship['id'], 'event_code' => $eventCode, 'reason' => 'evento sem fuso IANA válido'];
            continue;
        }

        $change = [
            'id' => $championship['id'],
            'event_code' => $eventCode,
            'name' => ftcScoutStringOrNull($remote['name'] ?? null),
            'level' => ftcScoutStringOrNull($remote['type'] ?? null),
            'starts_at' => ftcScoutStringOrNull($remote['start'] ?? null),
            'ends_at' => ftcScoutStringOrNull($remote['end'] ?? null),
            'timezone' => $timezone,
            'location' => ftcScoutLocationFromEvent($remote),
        ];
        $hasChange = $championship['timezone'] !== $timezone;
        foreach (['name', 'level', 'starts_at', 'ends_at', 'location'] as $field) {
            if ($change[$field] !== null && $championship[$field] !== $change[$field]) {
                $hasChange = true;
                break;
            }
        }
        if (!$hasChange) {
            $summary['unchanged']++;
            continue;
        }
        $changes[] = $change;
    }

    if (!$dryRun && !empty($changes)) {
        $db->beginTransaction();
        try {
            $stmt = $db->prepare("UPDATE championships SET
                name = COALESCE(?, name), level = COALESCE(?, level),
                starts_at = COALESCE(?, starts_at), ends_at = COALESCE(?, ends_at),
                timezone = ?, location = COALESCE(?, location), updated_at = ?
                WHERE id = ?");
            foreach ($changes as $change) {
                $stmt->execute([
                    $change['name'], $change['level'], $change['starts_at'], $change['ends_at'],
                    $change['timezone'], $change['location'], date('c'), $change['id'],
                ]);
            }
            $db->commit();
        } catch (Throwable $error) {
            $db->rollBack();
            throw $error;
        }
    }

    $summary['updated'] = count($changes);
    return [
        'success' => true,
        'dry_run' => $dryRun,
        'summary' => $summary,
        'updated_championships' => $changes,
        'skipped_championships' => $skipped,
        'note' => 'Partidas, equipes e inscrições não são alteradas.',
    ];
}
