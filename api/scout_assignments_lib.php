<?php

function batchAssignScoutSlots(PDO $db, array $body): array {
    $scoutId = trim((string)($body['scout_id'] ?? ''));
    $slots = $body['slots'] ?? null;
    if ($scoutId === '') throw new InvalidArgumentException('scout_id e obrigatorio');
    if (!is_array($slots) || count($slots) === 0) throw new InvalidArgumentException('Selecione ao menos uma posicao');
    if (count($slots) > 500) throw new InvalidArgumentException('O lote aceita no maximo 500 posicoes');

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT id FROM scouts WHERE id = ?");
        $stmt->execute([$scoutId]);
        if (!$stmt->fetch()) throw new InvalidArgumentException('Scout nao encontrado');

        $matchStmt = $db->prepare("
            SELECT id, red_team1_number, red_team2_number, red_team3_number,
                   blue_team1_number, blue_team2_number, blue_team3_number
            FROM matches WHERE id = ?
        ");
        $roundStmt = $db->prepare("SELECT id FROM scouting_rounds WHERE match_id = ? AND team_number = ? LIMIT 1");
        $assignmentStmt = $db->prepare("SELECT id, scout_id FROM scout_assignments WHERE match_id = ? AND team_number = ? LIMIT 1");
        $insertStmt = $db->prepare("
            INSERT INTO scout_assignments (id, match_id, team_number, scout_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $normalized = [];
        $duplicates = 0;
        foreach ($slots as $slot) {
            if (!is_array($slot)) throw new InvalidArgumentException('Posicao invalida no lote');
            $matchId = trim((string)($slot['match_id'] ?? ''));
            $teamNumber = (int)($slot['team_number'] ?? 0);
            if ($matchId === '' || $teamNumber <= 0) throw new InvalidArgumentException('match_id e team_number sao obrigatorios em cada posicao');
            $key = $matchId . '|' . $teamNumber;
            if (isset($normalized[$key])) {
                $duplicates++;
                continue;
            }

            $matchStmt->execute([$matchId]);
            $match = $matchStmt->fetch(PDO::FETCH_ASSOC);
            if (!$match) throw new InvalidArgumentException("Partida nao encontrada: $matchId");
            $validTeams = matchTeamNumbers($match);
            if (!in_array($teamNumber, $validTeams, true)) {
                throw new InvalidArgumentException("Equipe #$teamNumber nao pertence a partida $matchId");
            }
            $normalized[$key] = ['match_id' => $matchId, 'team_number' => $teamNumber];
        }

        $createdIds = [];
        $conflicts = [];
        $now = date('c');
        foreach ($normalized as $slot) {
            $roundStmt->execute([$slot['match_id'], $slot['team_number']]);
            if ($roundStmt->fetch()) {
                $conflicts[] = $slot + ['reason' => 'scouting_started'];
                continue;
            }
            $assignmentStmt->execute([$slot['match_id'], $slot['team_number']]);
            if ($assignmentStmt->fetch()) {
                $conflicts[] = $slot + ['reason' => 'already_assigned'];
                continue;
            }
            $id = generateId();
            $insertStmt->execute([$id, $slot['match_id'], $slot['team_number'], $scoutId, $now, $now]);
            $createdIds[] = $id;
        }

        $items = [];
        if (!empty($createdIds)) {
            $placeholders = implode(',', array_fill(0, count($createdIds), '?'));
            $stmt = $db->prepare("
                SELECT sa.*, s.username AS scout_username, m.display_name AS match_display_name,
                       m.match_type, m.match_number, m.championship_id
                FROM scout_assignments sa
                LEFT JOIN scouts s ON s.id = sa.scout_id
                LEFT JOIN matches m ON m.id = sa.match_id
                WHERE sa.id IN ($placeholders)
            ");
            $stmt->execute($createdIds);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $db->commit();
        return [
            'assigned' => count($items),
            'skipped' => count($conflicts) + $duplicates,
            'duplicates' => $duplicates,
            'conflicts' => $conflicts,
            'items' => $items,
        ];
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}
