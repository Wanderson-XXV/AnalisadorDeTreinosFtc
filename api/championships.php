<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

function normalizeChampionshipRow(array $row): array {
    $row['sort_order'] = (int)($row['sort_order'] ?? 0);
    $row['alliance_size'] = normalizeAllianceSize($row['alliance_size'] ?? 2);
    return $row;
}

function buildChampionshipTree(array $rows): array {
    $byId = [];
    foreach ($rows as $row) {
        $row = normalizeChampionshipRow($row);
        $row['children'] = [];
        $byId[$row['id']] = $row;
    }

    $tree = [];
    foreach ($byId as $id => &$row) {
        $parentId = $row['parent_id'] ?? null;
        if ($parentId && isset($byId[$parentId])) {
            $byId[$parentId]['children'][] = &$row;
        } else {
            $tree[] = &$row;
        }
    }
    unset($row);

    return $tree;
}

function assertValidScopeType(string $scopeType): void {
    $allowed = ['standalone', 'event_group', 'division', 'final'];
    if (!in_array($scopeType, $allowed, true)) {
        jsonError('scope_type inválido', 400);
    }
}

function assertParentExists(PDO $db, ?string $parentId): void {
    if (!$parentId) return;
    $stmt = $db->prepare("SELECT id FROM championships WHERE id = ?");
    $stmt->execute([$parentId]);
    if (!$stmt->fetch()) jsonError('Campeonato pai não encontrado', 404);
}

function getChampionshipDescendantIds(PDO $db, string $championshipId): array {
    $ids = [$championshipId];
    $queue = [$championshipId];

    while (!empty($queue)) {
        $current = array_shift($queue);
        $stmt = $db->prepare("SELECT id FROM championships WHERE parent_id = ?");
        $stmt->execute([$current]);
        foreach ($stmt->fetchAll() as $row) {
            $childId = $row['id'];
            if (!in_array($childId, $ids, true)) {
                $ids[] = $childId;
                $queue[] = $childId;
            }
        }
    }

    return $ids;
}

function deleteChampionshipCascade(PDO $db, string $championshipId): array {
    $stmt = $db->prepare("SELECT id FROM championships WHERE id = ?");
    $stmt->execute([$championshipId]);
    if (!$stmt->fetch()) return ['championships' => 0, 'matches' => 0];

    $ids = getChampionshipDescendantIds($db, $championshipId);
    if (empty($ids)) return ['championships' => 0, 'matches' => 0];

    $championshipPlaceholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("SELECT id FROM matches WHERE championship_id IN ($championshipPlaceholders)");
    $stmt->execute($ids);
    $matchIds = array_column($stmt->fetchAll(), 'id');

    if (!empty($matchIds)) {
        $matchPlaceholders = implode(',', array_fill(0, count($matchIds), '?'));
        $stmt = $db->prepare("SELECT id FROM scouting_rounds WHERE match_id IN ($matchPlaceholders)");
        $stmt->execute($matchIds);
        $roundIds = array_column($stmt->fetchAll(), 'id');

        if (!empty($roundIds)) {
            $roundPlaceholders = implode(',', array_fill(0, count($roundIds), '?'));
            $db->prepare("DELETE FROM scouting_cycles WHERE scouting_round_id IN ($roundPlaceholders)")->execute($roundIds);
            $db->prepare("DELETE FROM scouting_rounds WHERE id IN ($roundPlaceholders)")->execute($roundIds);
        }

        $db->prepare("DELETE FROM scout_assignments WHERE match_id IN ($matchPlaceholders)")->execute($matchIds);
        $db->prepare("DELETE FROM match_media WHERE match_id IN ($matchPlaceholders)")->execute($matchIds);
        $db->prepare("DELETE FROM matches WHERE id IN ($matchPlaceholders)")->execute($matchIds);
    }

    $db->prepare("DELETE FROM championship_teams WHERE championship_id IN ($championshipPlaceholders)")->execute($ids);
    $db->prepare("DELETE FROM championships WHERE id IN ($championshipPlaceholders)")->execute($ids);

    return ['championships' => count($ids), 'matches' => count($matchIds)];
}

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            if ($id) {
                $stmt = $db->prepare("SELECT * FROM championships WHERE id = ?");
                $stmt->execute([$id]);
                $championship = $stmt->fetch();
                if (!$championship) jsonError('Campeonato não encontrado', 404);
                jsonResponse(normalizeChampionshipRow($championship));
            }

            $status = $_GET['status'] ?? null;
            $flat = ($_GET['flat'] ?? '0') === '1';
            $where = [];
            $params = [];
            if ($status) {
                $where[] = "status = ?";
                $params[] = $status;
            }

            $sql = "SELECT * FROM championships"
                . (count($where) ? " WHERE " . implode(' AND ', $where) : "")
                . " ORDER BY parent_id IS NOT NULL ASC, sort_order ASC, starts_at ASC, name ASC";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll();
            jsonResponse($flat ? array_map('normalizeChampionshipRow', $rows) : buildChampionshipTree($rows));
            break;

        case 'POST':
            $body = getRequestBody();
            if (empty($body['name'])) jsonError('name é obrigatório', 400);

            $scopeType = $body['scope_type'] ?? 'standalone';
            assertValidScopeType($scopeType);

            $parentId = $body['parent_id'] ?? null;
            assertParentExists($db, $parentId);

            $newId = generateId();
            $now = date('c');
            $stmt = $db->prepare("
                INSERT INTO championships (
                    id, parent_id, name, short_name, season, event_code, scope_type, level,
                    starts_at, ends_at, timezone, location, status, sort_order, alliance_size, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $newId,
                $parentId ?: null,
                $body['name'],
                $body['short_name'] ?? null,
                $body['season'] ?? null,
                $body['event_code'] ?? null,
                $scopeType,
                $body['level'] ?? null,
                $body['starts_at'] ?? null,
                $body['ends_at'] ?? null,
                $body['timezone'] ?? 'America/Sao_Paulo',
                $body['location'] ?? null,
                $body['status'] ?? 'active',
                (int)($body['sort_order'] ?? 0),
                normalizeAllianceSize($body['alliance_size'] ?? 2),
                $now,
                $now,
            ]);

            $stmt = $db->prepare("SELECT * FROM championships WHERE id = ?");
            $stmt->execute([$newId]);
            jsonResponse(normalizeChampionshipRow($stmt->fetch()), 201);
            break;

        case 'PUT':
            $body = getRequestBody();
            if (empty($body['id'])) jsonError('id é obrigatório', 400);

            $stmt = $db->prepare("SELECT * FROM championships WHERE id = ?");
            $stmt->execute([$body['id']]);
            $existingChampionship = $stmt->fetch();
            if (!$existingChampionship) jsonError('Campeonato não encontrado', 404);
            if (array_key_exists('alliance_size', $body)
                && normalizeAllianceSize($body['alliance_size']) !== normalizeAllianceSize($existingChampionship['alliance_size'] ?? 2)) {
                jsonError('O formato 2x2 ou 3x3 fica bloqueado depois da criação do campeonato', 409);
            }

            if (isset($body['scope_type'])) assertValidScopeType($body['scope_type']);
            if (array_key_exists('parent_id', $body)) {
                if ($body['parent_id'] === $body['id']) jsonError('Campeonato não pode ser pai dele mesmo', 400);
                assertParentExists($db, $body['parent_id'] ?: null);
            }

            $updatable = [
                'parent_id', 'name', 'short_name', 'season', 'event_code', 'scope_type',
                'level', 'starts_at', 'ends_at', 'timezone', 'location', 'status', 'sort_order',
            ];
            $fields = [];
            $params = [];
            foreach ($updatable as $field) {
                if (array_key_exists($field, $body)) {
                    $fields[] = "$field = ?";
                    $params[] = $field === 'sort_order' ? (int)$body[$field] : ($body[$field] ?: null);
                }
            }
            if (empty($fields)) jsonError('Nenhum campo para atualizar', 400);

            $fields[] = "updated_at = ?";
            $params[] = date('c');
            $params[] = $body['id'];

            $stmt = $db->prepare("UPDATE championships SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);

            $stmt = $db->prepare("SELECT * FROM championships WHERE id = ?");
            $stmt->execute([$body['id']]);
            jsonResponse(normalizeChampionshipRow($stmt->fetch()));
            break;

        case 'DELETE':
            if (!$id) jsonError('id é obrigatório', 400);

            $force = ($_GET['force'] ?? '0') === '1';
            if ($force && $id) {
                $db->beginTransaction();
                try {
                    $deleted = deleteChampionshipCascade($db, $id);
                    $db->commit();
                    if ($deleted['championships'] === 0) jsonError('Campeonato nao encontrado', 404);
                    jsonResponse(['success' => true, 'deleted' => $deleted]);
                } catch (Exception $e) {
                    if ($db->inTransaction()) $db->rollBack();
                    throw $e;
                }
            }

            $stmt = $db->prepare("SELECT COUNT(*) as total FROM championships WHERE parent_id = ?");
            $stmt->execute([$id]);
            if ((int)$stmt->fetch()['total'] > 0) jsonError('Remova as divisões antes de excluir este campeonato', 409);

            $stmt = $db->prepare("SELECT COUNT(*) as total FROM matches WHERE championship_id = ?");
            $stmt->execute([$id]);
            if ((int)$stmt->fetch()['total'] > 0) jsonError('Campeonato possui partidas vinculadas', 409);

            $stmt = $db->prepare("DELETE FROM championships WHERE id = ?");
            $stmt->execute([$id]);
            if ($stmt->rowCount() === 0) jsonError('Campeonato não encontrado', 404);
            jsonResponse(['success' => true]);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
