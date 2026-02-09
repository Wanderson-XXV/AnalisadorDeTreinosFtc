<?php
/**
 * API de Exportação CSV
 * GET /export.php - Exporta todos os dados em CSV
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    jsonError('Método não permitido', 405);
}

try {
    $db = getDB();
    
    // Buscar todos os rounds com ciclos
    $stmt = $db->query("SELECT * FROM rounds ORDER BY start_time DESC");
    $rounds = $stmt->fetchAll();
    
    // Preparar CSV
    $filename = 'ftc_cycles_' . date('Y-m-d') . '.csv';
    
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    
    $output = fopen('php://output', 'w');
    
    // BOM para Excel reconhecer UTF-8
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    // Cabeçalho
    fputcsv($output, [
        'Round ID',
        'Data Round',
        'Duração Total (s)',
        'Observações',
        'Ciclo #',
        'Tempo Ciclo (s)',
        'Acertos',
        'Erros',
        'Timestamp (s)',
        'Intervalo'
    ], ';');
    
    foreach ($rounds as $round) {
        // Buscar ciclos do round
        $stmt = $db->prepare("SELECT * FROM cycles WHERE round_id = ? ORDER BY cycle_number");
        $stmt->execute([$round['id']]);
        $cycles = $stmt->fetchAll();
        
        if (empty($cycles)) {
            // Round sem ciclos
            fputcsv($output, [
                $round['id'],
                $round['start_time'],
                $round['total_duration'] ? round($round['total_duration'] / 1000, 2) : '',
                $round['observations'] ?? '',
                '', '', '', '', '', ''
            ], ';');
        } else {
            foreach ($cycles as $index => $cycle) {
                fputcsv($output, [
                    $index === 0 ? $round['id'] : '',
                    $index === 0 ? $round['start_time'] : '',
                    $index === 0 ? ($round['total_duration'] ? round($round['total_duration'] / 1000, 2) : '') : '',
                    $index === 0 ? ($round['observations'] ?? '') : '',
                    $cycle['cycle_number'],
                    round($cycle['duration'] / 1000, 2),
                    $cycle['hits'],
                    $cycle['misses'],
                    round($cycle['timestamp'] / 1000, 2),
                    $cycle['time_interval']
                ], ';');
            }
        }
    }
    
    fclose($output);
    exit();
    
} catch (Exception $e) {
    jsonError($e->getMessage());
}
