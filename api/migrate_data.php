<?php
require_once 'config.php';

$pdo = new PDO('sqlite:' . DB_PATH);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo "=== MIGRANDO DADOS DO PRISMA PARA PHP API ===\n\n";

function convertTimestamp($ms) {
    if (!$ms) return null;
    return date('Y-m-d\TH:i:s.v\Z', intval($ms / 1000));
}

try {
    $pdo->exec("DELETE FROM cycles");
    $pdo->exec("DELETE FROM rounds");
    echo "Tabelas limpas.\n\n";
    
    $pdo->beginTransaction();
    
    echo "1. Migrando Rounds...\n";
    $oldRounds = $pdo->query("SELECT * FROM Round")->fetchAll();
    
    $stmt = $pdo->prepare("
        INSERT INTO rounds (id, start_time, end_time, observations, total_duration, created_at, updated_at, round_type)
        VALUES (:id, :start_time, :end_time, :observations, :total_duration, :created_at, :updated_at, 'teleop_only')
    ");
    
    foreach ($oldRounds as $round) {
        $stmt->execute([
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
    
    echo "2. Migrando Cycles...\n";
    $oldCycles = $pdo->query("SELECT * FROM Cycle")->fetchAll();
    
    $stmt = $pdo->prepare("
        INSERT INTO cycles (id, round_id, cycle_number, duration, hits, misses, timestamp, time_interval, created_at, is_autonomous)
        VALUES (:id, :round_id, :cycle_number, :duration, :hits, :misses, :timestamp, :time_interval, :created_at, 0)
    ");
    
    foreach ($oldCycles as $cycle) {
        $stmt->execute([
            ':id' => $cycle['id'],
            ':round_id' => $cycle['roundId'],
            ':cycle_number' => $cycle['cycleNumber'],
            ':duration' => $cycle['duration'],
            ':hits' => $cycle['hits'],
            ':misses' => $cycle['misses'],
            ':timestamp' => $cycle['timestamp'],
            ':time_interval' => $cycle['timeInterval'],
            ':created_at' => convertTimestamp($cycle['createdAt'])
        ]);
    }
    echo "   ✓ " . count($oldCycles) . " cycles migrados\n\n";
    
    $pdo->commit();
    
    echo "=== MIGRAÇÃO CONCLUÍDA COM SUCESSO! ===\n";
    echo "Total: " . count($oldRounds) . " rounds e " . count($oldCycles) . " cycles\n";
    
} catch (Exception $e) {
    $pdo->rollBack();
    echo "ERRO: " . $e->getMessage() . "\n";
}