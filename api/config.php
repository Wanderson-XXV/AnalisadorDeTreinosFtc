<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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
    // Tabelas existentes (treinos)
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

    // Tabelas de campeonato
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_number INTEGER UNIQUE NOT NULL,
            team_name TEXT NOT NULL,
            logo_url TEXT,
            logo_position TEXT DEFAULT 'center',
            instagram TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_teams_number ON teams(team_number)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scouts (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            photo_path TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_active TEXT
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            championship_id TEXT,
            match_type TEXT NOT NULL DEFAULT 'qualification',
            match_number INTEGER NOT NULL,
            red_team1_number INTEGER NOT NULL,
            red_team1_name TEXT,
            red_team2_number INTEGER NOT NULL,
            red_team2_name TEXT,
            blue_team1_number INTEGER NOT NULL,
            blue_team1_name TEXT,
            blue_team2_number INTEGER NOT NULL,
            blue_team2_name TEXT,
            red_score_auto INTEGER DEFAULT 0,
            red_score_teleop INTEGER DEFAULT 0,
            red_penalties INTEGER DEFAULT 0,
            red_total INTEGER DEFAULT 0,
            blue_score_auto INTEGER DEFAULT 0,
            blue_score_teleop INTEGER DEFAULT 0,
            blue_penalties INTEGER DEFAULT 0,
            blue_total INTEGER DEFAULT 0,
            scheduled_time TEXT,
            actual_start_time TEXT,
            status TEXT DEFAULT 'scheduled',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_matches_type ON matches(match_type)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scouting_rounds (
            id TEXT PRIMARY KEY,
            match_id TEXT NOT NULL,
            team_number INTEGER NOT NULL,
            scout_id TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            total_duration INTEGER,
            observations TEXT,
            robot_issues TEXT,
            strategy_notes TEXT,
            is_locked INTEGER DEFAULT 0,
            locked_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
            FOREIGN KEY (scout_id) REFERENCES scouts(id)
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_scouting_rounds_match ON scouting_rounds(match_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_scouting_rounds_team ON scouting_rounds(team_number)");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_scouting_unique ON scouting_rounds(match_id, team_number)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scouting_cycles (
            id TEXT PRIMARY KEY,
            scouting_round_id TEXT NOT NULL,
            cycle_number INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            timestamp INTEGER NOT NULL,
            time_interval TEXT NOT NULL,
            is_autonomous INTEGER DEFAULT 0,
            hits INTEGER DEFAULT 0,
            misses INTEGER DEFAULT 0,
            zone TEXT,
            action_type TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scouting_round_id) REFERENCES scouting_rounds(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_scouting_cycles_round ON scouting_cycles(scouting_round_id)");
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
        if ($timestamp < 30000) return 'auto';
        if ($timestamp < 38000) return 'transition';
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
        "ALTER TABLE cycles ADD COLUMN is_autonomous INTEGER DEFAULT 0",
        "ALTER TABLE matches ADD COLUMN display_name TEXT",
    ];

    foreach ($migrations as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
        }
    }
}