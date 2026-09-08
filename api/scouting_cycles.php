<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    $db = getDB();

    switch ($method) {
        case 'POST':
            $body = getRequestBody();

            $required = ['scouting_round_id', 'cycle_number', 'duration', 'timestamp', 'time_interval'];
            foreach ($required as $field) {
                if (!isset($body[$field]) && $body[$field] !== 0) {
                    jsonError("Campo obrigatório: $field", 400);
                }
            }

            $roundId = $body['scouting_round_id'];

            $stmt = $db->prepare("SELECT id FROM scouting_rounds WHERE id = ?");
            $stmt->execute([$roundId]);
            if (!$stmt->fetch()) jsonError('Scouting round não encontrado', 404);

            $id = generateId();

            $stmt = $db->prepare("INSERT INTO scouting_cycles (id, scouting_round_id, cycle_number, duration, timestamp, time_interval, is_autonomous, hits, misses, zone, action_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $id,
                $roundId,
                (int)$body['cycle_number'],
                (int)$body['duration'],
                (int)$body['timestamp'],
                $body['time_interval'],
                (int)($body['is_autonomous'] ?? 0),
                (int)($body['hits'] ?? 0),
                (int)($body['misses'] ?? 0),
                $body['zone'] ?? null,
                $body['action_type'] ?? null,
                $body['notes'] ?? null,
            ]);

            $stmt2 = $db->prepare("SELECT * FROM scouting_cycles WHERE id = ?");
            $stmt2->execute([$id]);
            jsonResponse($stmt2->fetch(), 201);
            break;

        case 'PATCH':
            if (!$id) jsonError('id é obrigatório', 400);
            $body = getRequestBody();

            $updatable = ['hits', 'misses', 'zone', 'action_type', 'notes'];
            $fields = [];
            $params = [];

            foreach ($updatable as $field) {
                if (array_key_exists($field, $body)) {
                    $fields[] = "$field = ?";
                    $params[] = $body[$field];
                }
            }

            if (empty($fields)) jsonError('Nenhum campo para atualizar', 400);
            $params[] = $id;

            $stmt = $db->prepare("UPDATE scouting_cycles SET " . implode(', ', $fields) . " WHERE id = ?");
            $stmt->execute($params);

            $stmt2 = $db->prepare("SELECT * FROM scouting_cycles WHERE id = ?");
            $stmt2->execute([$id]);
            $cycle = $stmt2->fetch();
            if (!$cycle) jsonError('Ciclo não encontrado', 404);

            jsonResponse($cycle);
            break;

        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}