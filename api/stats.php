<?php
/**
 * API de Estatísticas
 * GET /stats.php                           - Estatísticas gerais
 * GET /stats.php?startDate=X&endDate=Y     - Estatísticas filtradas por período
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    jsonError('Método não permitido', 405);
}

try {
    $db = getDB();
    
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    
    // Construir filtro de data
    $dateFilter = '';
    $params = [];
    
    if ($startDate || $endDate) {
        $conditions = [];
        if ($startDate) {
            $conditions[] = "DATE(start_time) >= ?";
            $params[] = $startDate;
        }
        if ($endDate) {
            $conditions[] = "DATE(start_time) <= ?";
            $params[] = $endDate;
        }
        $dateFilter = 'WHERE ' . implode(' AND ', $conditions);
    }
    
    // Buscar rounds com filtro
    $sql = "SELECT * FROM rounds $dateFilter ORDER BY start_time DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rounds = $stmt->fetchAll();
    
    // Buscar todos os ciclos dos rounds filtrados
    $allCycles = [];
    $completedRounds = [];
    
    foreach ($rounds as $round) {
        $stmt = $db->prepare("SELECT * FROM cycles WHERE round_id = ?");
        $stmt->execute([$round['id']]);
        $cycles = $stmt->fetchAll();
        $round['cycles'] = $cycles;
        
        if ($round['end_time']) {
            $completedRounds[] = $round;
        }
        
        $allCycles = array_merge($allCycles, $cycles);
    }
    
    // Estatísticas gerais
    $totalRounds = count($completedRounds);
    $totalCycles = count($allCycles);
    $avgCyclesPerRound = $totalRounds > 0 ? $totalCycles / $totalRounds : 0;
    
    $durations = array_column($allCycles, 'duration');
    $avgCycleTime = count($durations) > 0 ? array_sum($durations) / count($durations) : 0;
    $minCycleTime = count($durations) > 0 ? min($durations) : 0;
    $maxCycleTime = count($durations) > 0 ? max($durations) : 0;
    
    $totalHits = array_sum(array_column($allCycles, 'hits'));
    $totalMisses = array_sum(array_column($allCycles, 'misses'));
    $hitRate = ($totalHits + $totalMisses) > 0 
        ? ($totalHits / ($totalHits + $totalMisses)) * 100 
        : 0;
    $personalBest = 0;
    foreach ($completedRounds as $round) {
        $roundHits = array_sum(array_column($round['cycles'], 'hits'));
        if ($roundHits > $personalBest) {
            $personalBest = $roundHits;
        }
    }
    // Estatísticas por intervalo
    $intervals = ['0-30s', '30-60s', '60-90s', '90-120s'];
    $statsByInterval = [];
    
    foreach ($intervals as $interval) {
        $intervalCycles = array_filter($allCycles, fn($c) => $c['time_interval'] === $interval);
        $intervalDurations = array_column($intervalCycles, 'duration');
        
        $statsByInterval[] = [
            'interval' => $interval,
            'count' => count($intervalCycles),
            'avgTime' => count($intervalDurations) > 0 
                ? array_sum($intervalDurations) / count($intervalDurations) 
                : 0,
            'hits' => array_sum(array_column($intervalCycles, 'hits')),
            'misses' => array_sum(array_column($intervalCycles, 'misses'))
        ];
    }
    
   // Estatísticas por dia
    $statsByDay = [];
    foreach ($completedRounds as $round) {
        $dateKey = substr($round['start_time'], 0, 10);
        if (!isset($statsByDay[$dateKey])) {
            $statsByDay[$dateKey] = ['rounds' => 0, 'cycles' => 0, 'totalTime' => 0, 'hits' => 0, 'misses' => 0];
        }
        $statsByDay[$dateKey]['rounds']++;
        $statsByDay[$dateKey]['cycles'] += count($round['cycles']);
        $statsByDay[$dateKey]['totalTime'] += array_sum(array_column($round['cycles'], 'duration'));
        $statsByDay[$dateKey]['hits'] += array_sum(array_column($round['cycles'], 'hits'));
        $statsByDay[$dateKey]['misses'] += array_sum(array_column($round['cycles'], 'misses'));
    }

 $dailyStats = [];
foreach ($statsByDay as $date => $data) {
    $dailyStats[] = [
        'date' => $date,
        'rounds' => $data['rounds'],
        'totalCycles' => $data['cycles'],
        'avgCycleTime' => $data['cycles'] > 0 ? $data['totalTime'] / $data['cycles'] : 0,
        'totalHits' => $data['hits'],
        'totalMisses' => $data['misses']
    ];
}
    usort($dailyStats, fn($a, $b) => strcmp($b['date'], $a['date']));
    
    // Dados de evolução
    $evolutionData = [];
    $reversedRounds = array_reverse($completedRounds);
    foreach ($reversedRounds as $index => $round) {
        $roundCycles = $round['cycles'];
        $roundDurations = array_column($roundCycles, 'duration');
        
        $evolutionData[] = [
            'roundNumber' => $index + 1,
            'date' => date('d/m', strtotime($round['start_time'])),
            'avgTime' => count($roundDurations) > 0 
                ? array_sum($roundDurations) / count($roundDurations) 
                : 0,
            'cycleCount' => count($roundCycles),
            'hits' => array_sum(array_column($roundCycles, 'hits')),
            'misses' => array_sum(array_column($roundCycles, 'misses'))
        ];
    }
    
    jsonResponse([
        'general' => [
            'totalRounds' => $totalRounds,
            'totalCycles' => $totalCycles,
            'avgCyclesPerRound' => round($avgCyclesPerRound, 1),
            'avgCycleTime' => round($avgCycleTime),
            'minCycleTime' => $minCycleTime,
            'personalBest' => $personalBest,
            'totalHits' => $totalHits,
            'totalMisses' => $totalMisses,
            'hitRate' => round($hitRate, 1)
        ],
        'statsByInterval' => $statsByInterval,
        'dailyStats' => $dailyStats,
        'evolutionData' => $evolutionData
    ]);
    
} catch (Exception $e) {
    jsonError($e->getMessage());
}
