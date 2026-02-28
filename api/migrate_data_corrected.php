<?php
/**
 * Script de Migração: Prisma (Round/Cycle) → PHP API (rounds/cycles)
 * 
 * Uso: php migrate_data_corrected.php
 * 
 * Certifique-se que o config.php está no mesmo diretório ou ajuste o require.
 */

// Conexão direta - ajuste o caminho do banco se necessário
$dbPath = __DIR__ . '/data.db';  // ou ajuste para onde está seu banco
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

echo "=== MIGRANDO DADOS DO PRISMA PARA PHP API ===\n\n";

/**
 * Converte timestamp Unix (ms) para ISO 8601
 */
function convertTimestamp($value) {
    if (!$value) return null;
    
    // Se já é string ISO, retornar como está
    if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
        return $value;
    }
    
    // Se é número (timestamp em ms), converter
    if (is_numeric($value)) {
        $seconds = intval($value / 1000);
        $ms = $value % 1000;
        return date('Y-m-d\TH:i:s', $seconds) . sprintf('.%03dZ', $ms);
    }
    
    return $value;
}

/**
 * Calcula o intervalo de tempo baseado no timestamp (ms desde início do round)
 */
function getTimeInterval($timestampMs) {
    $intervals = ['0-30s', '30-60s', '60-90s', '90-120s'];
    $idx = min(floor($timestampMs / 30000), 3);
    return $intervals[$idx];
}

try {
    // Verificar se as tabelas do Prisma existem
    $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll();
    $tableNames = array_column($tables, 'name');
    
    if (!in_array('Round', $tableNames) || !in_array('Cycle', $tableNames)) {
        die("ERRO: Tabelas 'Round' e 'Cycle' do Prisma não encontradas!\n");
    }
    
    // Verificar se as tabelas destino existem
    if (!in_array('rounds', $tableNames) || !in_array('cycles', $tableNames)) {
        die("ERRO: Tabelas 'rounds' e 'cycles' do PHP não encontradas! Execute o config.php primeiro.\n");
    }
    
    $pdo->beginTransaction();
    
    // Limpar tabelas destino
    $pdo->exec("DELETE FROM cycles");
    $pdo->exec("DELETE FROM rounds");
    echo "Tabelas de destino limpas.\n\n";
    
    // ==================== MIGRAR ROUNDS ====================
    echo "1. Migrando Rounds...\n";
    
    $oldRounds = $pdo->query("SELECT * FROM Round ORDER BY startTime ASC")->fetchAll();
    
    $stmtRound = $pdo->prepare("
        INSERT INTO rounds (id, start_time, end_time, observations, total_duration, created_at, updated_at, round_type, battery_name, battery_volts, strategy)
        VALUES (:id, :start_time, :end_time, :observations, :total_duration, :created_at, :updated_at, 'teleop_only', NULL, NULL, NULL)
    ");
    
    foreach ($oldRounds as $round) {
        $stmtRound->execute([
            ':id' => $round['id'],
            ':start_time' => convertTimestamp($round['startTime']),
            ':end_time' => convertTimestamp($round['endTime']),
            ':observations' => $round['observations'],
            ':total_duration' => $round['totalDuration'],
            ':created_at' => convertTimestamp($round['createdAt']),
            ':updated_at' => convertTimestamp($round['updatedAt'])
        ]);
    }
    echo "   ✓ " . count($oldRounds) . " rounds migrados\n\n";
    
    // ==================== MIGRAR CYCLES ====================
    echo "2. Migrando Cycles...\n";
    
    $oldCycles = $pdo->query("SELECT * FROM Cycle ORDER BY roundId, cycleNumber ASC")->fetchAll();
    
    $stmtCycle = $pdo->prepare("
        INSERT INTO cycles (id, round_id, cycle_number, duration, hits, misses, timestamp, time_interval, created_at, zone, is_autonomous)
        VALUES (:id, :round_id, :cycle_number, :duration, :hits, :misses, :timestamp, :time_interval, :created_at, NULL, 0)
    ");
    
    foreach ($oldCycles as $cycle) {
        // Usar os campos CORRETOS do Prisma
        $hits = intval($cycle['hits'] ?? 0);
        $misses = intval($cycle['misses'] ?? 0);
        $timestamp = intval($cycle['timestamp'] ?? 0);  // ms desde início do round
        $timeInterval = $cycle['timeInterval'] ?? getTimeInterval($timestamp);
        
        $stmtCycle->execute([
            ':id' => $cycle['id'],
            ':round_id' => $cycle['roundId'],
            ':cycle_number' => intval($cycle['cycleNumber']),
            ':duration' => intval($cycle['duration']),
            ':hits' => $hits,
            ':misses' => $misses,
            ':timestamp' => $timestamp,
            ':time_interval' => $timeInterval,
            ':created_at' => convertTimestamp($cycle['createdAt'])
        ]);
    }
    echo "   ✓ " . count($oldCycles) . " cycles migrados\n\n";
    
    $pdo->commit();
    
    // ==================== VERIFICAÇÃO ====================
    echo "=== VERIFICAÇÃO ===\n";
    
    $origStats = $pdo->query("SELECT COUNT(*) as cnt, SUM(hits) as hits, SUM(misses) as misses FROM Cycle")->fetch();
    $newStats = $pdo->query("SELECT COUNT(*) as cnt, SUM(hits) as hits, SUM(misses) as misses FROM cycles")->fetch();
    
    echo "Prisma (Cycle): {$origStats['cnt']} ciclos, {$origStats['hits']} hits, {$origStats['misses']} misses\n";
    echo "PHP (cycles):   {$newStats['cnt']} ciclos, {$newStats['hits']} hits, {$newStats['misses']} misses\n";
    
    if ($origStats['hits'] == $newStats['hits'] && $origStats['misses'] == $newStats['misses']) {
        echo "\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO! Dados conferem.\n";
    } else {
        echo "\n⚠️ AVISO: Totais não conferem. Verifique os dados.\n";
    }
    
    echo "\nTotal: " . count($oldRounds) . " rounds e " . count($oldCycles) . " cycles\n";
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "ERRO: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
