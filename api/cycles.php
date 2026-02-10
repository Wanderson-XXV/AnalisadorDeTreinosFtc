<?php
/**
 * API de Cycles
 * POST  /cycles.php       - Cria novo ciclo
 * PATCH /cycles.php?id=X  - Atualiza ciclo
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

try {
    $db = getDB();
    
    switch ($method) {
        case 'POST':
            $body = getRequestBody();
            
            $id = generateId();
            $roundId = $body['roundId'] ?? null;
            $cycleNumber = $body['cycleNumber'] ?? 1;
            $duration = $body['duration'] ?? 0;
            $hits = $body['hits'] ?? 0;
            $misses = $body['misses'] ?? 0;
            $timestamp = $body['timestamp'] ?? 0;
            $zone = $body['zone'] ?? null;
            $isFullMatch = $body['isFullMatch'] ?? false;
            
            if (!$roundId) {
                jsonError('roundId é obrigatório', 400);
            }
            
            $timeInterval = getTimeInterval($timestamp, $isFullMatch);
            $isAutonomous = ($isFullMatch && $timestamp < 30000) ? 1 : 0;
            
            $stmt = $db->prepare("
                INSERT INTO cycles (id, round_id, cycle_number, duration, hits, misses, timestamp, time_interval, zone, is_autonomous)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$id, $roundId, $cycleNumber, $duration, $hits, $misses, $timestamp, $timeInterval, $zone, $isAutonomous]);
            
            jsonResponse([
                'id' => $id,
                'roundId' => $roundId,
                'cycleNumber' => $cycleNumber,
                'duration' => $duration,
                'hits' => $hits,
                'misses' => $misses,
                'timestamp' => $timestamp,
                'timeInterval' => $timeInterval,
                'zone' => $zone,
                'isAutonomous' => $isAutonomous
            ], 201);
            break;
            
        case 'PATCH':
            if (!$id) {
                jsonError('ID do ciclo é obrigatório', 400);
            }
            
            $body = getRequestBody();
            $updates = [];
            $params = [];
            
            if (isset($body['hits'])) {
                $updates[] = 'hits = ?';
                $params[] = $body['hits'];
            }
            if (isset($body['misses'])) {
                $updates[] = 'misses = ?';
                $params[] = $body['misses'];
            }
            
            if (empty($updates)) {
                jsonError('Nenhum campo para atualizar', 400);
            }
            
            $params[] = $id;
            $sql = "UPDATE cycles SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            // Retornar ciclo atualizado
            $stmt = $db->prepare("SELECT * FROM cycles WHERE id = ?");
            $stmt->execute([$id]);
            $cycle = $stmt->fetch();
            
            jsonResponse($cycle);
            break;
            
        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
