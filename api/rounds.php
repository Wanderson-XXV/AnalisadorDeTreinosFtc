<?php
/**
 * API de Rounds
 * GET    /rounds.php         - Lista todos os rounds
 * GET    /rounds.php?id=X    - Busca round específico
 * GET    /rounds.php?date=Y  - Filtra por data (YYYY-MM-DD)
 * POST   /rounds.php         - Cria novo round
 * PATCH  /rounds.php?id=X    - Atualiza round
 * DELETE /rounds.php?id=X    - Remove round
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$date = $_GET['date'] ?? null;

try {
    $db = getDB();
    
    switch ($method) {
        case 'GET':
            if ($id) {
                // Buscar round específico com ciclos
                $stmt = $db->prepare("
                    SELECT * FROM rounds WHERE id = ?
                ");
                $stmt->execute([$id]);
                $round = $stmt->fetch();
                
                if (!$round) {
                    jsonError('Round não encontrado', 404);
                }
                
                // Buscar ciclos do round
                $stmt = $db->prepare("
                    SELECT * FROM cycles WHERE round_id = ? ORDER BY cycle_number
                ");
                $stmt->execute([$id]);
                $round['cycles'] = $stmt->fetchAll();
                
                jsonResponse($round);
            } else {
                // Listar todos os rounds
                $sql = "SELECT * FROM rounds";
                $params = [];
                
                if ($date) {
                    $sql .= " WHERE DATE(start_time) = ?";
                    $params[] = $date;
                }
                
                $sql .= " ORDER BY start_time DESC";
                
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                $rounds = $stmt->fetchAll();
                
                // Buscar ciclos para cada round
                foreach ($rounds as &$round) {
                    $stmt = $db->prepare("
                        SELECT * FROM cycles WHERE round_id = ? ORDER BY cycle_number
                    ");
                    $stmt->execute([$round['id']]);
                    $round['cycles'] = $stmt->fetchAll();
                }
                
                jsonResponse($rounds);
            }
            break;
            
        case 'POST':
            $body = getRequestBody();
            $id = generateId();
            $startTime = $body['startTime'] ?? date('c');
            
            $stmt = $db->prepare("
                INSERT INTO rounds (id, start_time) VALUES (?, ?)
            ");
            $stmt->execute([$id, $startTime]);
            
            jsonResponse([
                'id' => $id,
                'start_time' => $startTime,
                'cycles' => []
            ], 201);
            break;
            
        case 'PATCH':
            if (!$id) {
                jsonError('ID do round é obrigatório', 400);
            }
            
            $body = getRequestBody();
            $updates = [];
            $params = [];
            
            if (isset($body['endTime'])) {
                $updates[] = 'end_time = ?';
                $params[] = $body['endTime'];
            }
            if (isset($body['observations'])) {
                $updates[] = 'observations = ?';
                $params[] = $body['observations'];
            }
            if (isset($body['totalDuration'])) {
                $updates[] = 'total_duration = ?';
                $params[] = $body['totalDuration'];
            }
            
            $updates[] = 'updated_at = ?';
            $params[] = date('c');
            $params[] = $id;
            
            $sql = "UPDATE rounds SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            // Retornar round atualizado
            $stmt = $db->prepare("SELECT * FROM rounds WHERE id = ?");
            $stmt->execute([$id]);
            $round = $stmt->fetch();
            
            jsonResponse($round);
            break;
            
        case 'DELETE':
            if (!$id) {
                jsonError('ID do round é obrigatório', 400);
            }
            
            // Deletar ciclos primeiro (cascade)
            $stmt = $db->prepare("DELETE FROM cycles WHERE round_id = ?");
            $stmt->execute([$id]);
            
            // Deletar round
            $stmt = $db->prepare("DELETE FROM rounds WHERE id = ?");
            $stmt->execute([$id]);
            
            jsonResponse(['success' => true, 'message' => 'Round removido']);
            break;
            
        default:
            jsonError('Método não permitido', 405);
    }
} catch (Exception $e) {
    jsonError($e->getMessage());
}
