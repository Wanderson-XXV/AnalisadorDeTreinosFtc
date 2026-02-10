<?php
/**
 * Configuração do banco de dados SQLite
 * O arquivo data.db será criado automaticamente na primeira execução
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Caminho do banco de dados
define('DB_PATH', __DIR__ . '/data.db');

function getDB(): PDO {
    static $pdo = null;
    
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . DB_PATH);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        initDatabase($pdo);
        runMigrations($pdo);
    }
    return $pdo;
}

function initDatabase(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rounds (
            id TEXT PRIMARY KEY,
            start_time TEXT NOT NULL,
            end_time TEXT,
            observations TEXT,
            total_duration INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS cycles (
            id TEXT PRIMARY KEY,
            round_id TEXT NOT NULL,
            cycle_number INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            hits INTEGER DEFAULT 0,
            misses INTEGER DEFAULT 0,
            timestamp INTEGER NOT NULL,
            time_interval TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
        )
    ");
    
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_cycles_round_id ON cycles(round_id)");
}

function generateId(): string {
    return uniqid() . bin2hex(random_bytes(8));
}

function jsonResponse($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit();
}

function jsonError(string $message, int $status = 500): void {
    jsonResponse(['error' => $message], $status);
}

function getRequestBody(): array {
    $json = file_get_contents('php://input');
    return json_decode($json, true) ?? [];
}

function getTimeInterval(int $timestamp, bool $isFullMatch = false): string {
    if ($isFullMatch) {
        if ($timestamp < 30000) {
            return 'auto';
        }
        if ($timestamp < 38000) {
            return 'transition';
        }
        $teleopTime = $timestamp - 38000;
    } else {
        $teleopTime = $timestamp;
    }
    
    if ($teleopTime < 30000) return '0-30s';
    if ($teleopTime < 60000) return '30-60s';
    if ($teleopTime < 90000) return '60-90s';
    return '90-120s';
}

function runMigrations(PDO $pdo): void {
    $migrations = [
        "ALTER TABLE rounds ADD COLUMN round_type TEXT DEFAULT 'teleop_only'",
        "ALTER TABLE rounds ADD COLUMN battery_name TEXT",
        "ALTER TABLE rounds ADD COLUMN battery_volts REAL",
        "ALTER TABLE rounds ADD COLUMN strategy TEXT",
        "ALTER TABLE cycles ADD COLUMN zone TEXT",
        "ALTER TABLE cycles ADD COLUMN is_autonomous INTEGER DEFAULT 0"
    ];

    foreach ($migrations as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
        }
    }
}