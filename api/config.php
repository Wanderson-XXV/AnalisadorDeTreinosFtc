<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Scout-Session');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('DB_PATH', getenv('FTC_DB_PATH') ?: __DIR__ . '/data.db');
define('DEFAULT_TRANSITION_DURATION_MS', 15000);
define('MIN_TRANSITION_DURATION_MS', 0);
define('MAX_TRANSITION_DURATION_MS', 60000);
define('DEFAULT_KEYBOARD_SHORTCUTS', [
    'mark_cycle' => 'Space',
    'toggle_zone' => 'KeyQ',
    'confirm_cycle' => 'Enter',
    'cancel_modal' => 'Escape',
]);

function normalizeTransitionDurationMs($value): int {
    if ($value === null || $value === '') {
        return DEFAULT_TRANSITION_DURATION_MS;
    }

    $duration = (int)round((float)$value);
    return min(MAX_TRANSITION_DURATION_MS, max(MIN_TRANSITION_DURATION_MS, $duration));
}

function normalizeKeyboardShortcuts($value): array {
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        $value = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($value)) $value = [];

    $shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;
    foreach (array_keys(DEFAULT_KEYBOARD_SHORTCUTS) as $action) {
        if (!array_key_exists($action, $value)) continue;
        $code = trim((string)$value[$action]);
        if ($code === '' || !preg_match('/^[A-Za-z0-9]+$/', $code)) {
            throw new InvalidArgumentException("Atalho invalido para $action");
        }
        if (in_array($code, ['Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'], true)) {
            throw new InvalidArgumentException("Tecla reservada para $action");
        }
        $shortcuts[$action] = $code;
    }

    if (count(array_unique(array_values($shortcuts))) !== count($shortcuts)) {
        throw new InvalidArgumentException('Cada acao deve usar uma tecla diferente');
    }
    return $shortcuts;
}

function normalizeScoutRow(array $row): array {
    $row['transition_duration_ms'] = normalizeTransitionDurationMs($row['transition_duration_ms'] ?? null);
    $row['keyboard_shortcuts'] = normalizeKeyboardShortcuts($row['keyboard_shortcuts_json'] ?? ($row['keyboard_shortcuts'] ?? null));
    unset($row['keyboard_shortcuts_json']);
    // Nunca envie hash de senha ao cliente. A flag permite a tela decidir se pede senha.
    $row['password_configured'] = !empty($row['password_hash'] ?? null);
    unset($row['password_hash']);
    return $row;
}

function createScoutSession(PDO $pdo, string $scoutId): string {
    $token = bin2hex(random_bytes(32));
    $expiresAt = gmdate('c', time() + (60 * 60 * 24 * 30));
    $stmt = $pdo->prepare("INSERT INTO scout_sessions (id, scout_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([generateId(), $scoutId, hash('sha256', $token), $expiresAt, date('c')]);
    return $token;
}

function requireScoutSession(PDO $pdo, string $scoutId): void {
    $token = trim((string)($_SERVER['HTTP_X_SCOUT_SESSION'] ?? ''));
    if ($token === '') jsonError('Sessao expirada. Entre novamente.', 401);
    $stmt = $pdo->prepare("SELECT id FROM scout_sessions WHERE scout_id = ? AND token_hash = ? AND expires_at > ? LIMIT 1");
    $stmt->execute([$scoutId, hash('sha256', $token), date('c')]);
    if (!$stmt->fetch()) jsonError('Sessao expirada. Entre novamente.', 401);
}

function normalizeAllianceSize($value): int {
    return (int)$value === 3 ? 3 : 2;
}

function matchTeamFieldDefinitions(int $allianceSize = 3): array {
    $definitions = [];
    foreach (['red', 'blue'] as $alliance) {
        for ($position = 1; $position <= normalizeAllianceSize($allianceSize); $position++) {
            $definitions[] = [
                'field' => $alliance . '_team' . $position . '_number',
                'name' => $alliance . '_team' . $position . '_name',
                'alliance' => $alliance,
                'position' => $position,
            ];
        }
    }
    return $definitions;
}

function matchAllianceSize(array $match): int {
    if (!empty($match['red_team3_number']) || !empty($match['blue_team3_number'])) return 3;
    return normalizeAllianceSize($match['alliance_size'] ?? 2);
}

function matchTeamNumbers(array $match): array {
    $numbers = [];
    foreach (matchTeamFieldDefinitions(matchAllianceSize($match)) as $definition) {
        $number = (int)($match[$definition['field']] ?? 0);
        if ($number > 0) $numbers[] = $number;
    }
    return $numbers;
}

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
            transition_duration_ms INTEGER DEFAULT 15000,
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
            notes TEXT,
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
        CREATE TABLE IF NOT EXISTS championships (
            id TEXT PRIMARY KEY,
            parent_id TEXT,
            name TEXT NOT NULL,
            short_name TEXT,
            season TEXT,
            event_code TEXT,
            scope_type TEXT NOT NULL DEFAULT 'standalone',
            level TEXT,
            starts_at TEXT,
            ends_at TEXT,
            timezone TEXT DEFAULT 'America/Sao_Paulo',
            location TEXT,
            status TEXT DEFAULT 'active',
            sort_order INTEGER DEFAULT 0,
            alliance_size INTEGER NOT NULL DEFAULT 2,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES championships(id) ON DELETE SET NULL
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_championships_parent ON championships(parent_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_championships_event_code ON championships(event_code)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_championships_status ON championships(status)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS championship_teams (
            id TEXT PRIMARY KEY,
            championship_id TEXT NOT NULL,
            team_number INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE,
            UNIQUE(championship_id, team_number)
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_championship_teams_championship ON championship_teams(championship_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_championship_teams_team ON championship_teams(team_number)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scouts (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            photo_path TEXT,
            transition_duration_ms INTEGER DEFAULT 15000,
            keyboard_shortcuts_json TEXT,
            password_hash TEXT,
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
            red_team3_number INTEGER,
            red_team3_name TEXT,
            blue_team1_number INTEGER NOT NULL,
            blue_team1_name TEXT,
            blue_team2_number INTEGER NOT NULL,
            blue_team2_name TEXT,
            blue_team3_number INTEGER,
            blue_team3_name TEXT,
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
            source_match_id TEXT,
            source_match_number INTEGER,
            source_system TEXT,
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
            transition_duration_ms INTEGER DEFAULT 15000,
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

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS match_media (
            id TEXT PRIMARY KEY,
            match_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER,
            mime_type TEXT,
            category TEXT NOT NULL DEFAULT 'other',
            title TEXT,
            description TEXT,
            tagged_teams TEXT,
            uploaded_by TEXT,
            source_type TEXT DEFAULT 'local',
            external_provider TEXT,
            external_url TEXT,
            external_id TEXT,
            external_event_id TEXT,
            external_match_id TEXT,
            external_clip_id TEXT,
            video_match_start_ms INTEGER,
            video_duration_ms INTEGER,
            thumbnail_url TEXT,
            metadata_json TEXT,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_media_match ON match_media(match_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_media_category ON match_media(category)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scout_assignments (
            id TEXT PRIMARY KEY,
            match_id TEXT NOT NULL,
            team_number INTEGER NOT NULL,
            scout_id TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
            FOREIGN KEY (scout_id) REFERENCES scouts(id) ON DELETE CASCADE,
            UNIQUE(match_id, team_number)
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_assignments_match ON scout_assignments(match_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_assignments_scout ON scout_assignments(scout_id)");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS comparison_profiles (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            name TEXT NOT NULL,
            nickname TEXT,
            logo_url TEXT,
            logo_position TEXT DEFAULT 'center',
            start_date TEXT,
            end_date TEXT,
            championship_id TEXT,
            include_children INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scout_sessions (
            id TEXT PRIMARY KEY,
            scout_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (scout_id) REFERENCES scouts(id) ON DELETE CASCADE
        )
    ");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_scout_sessions_lookup ON scout_sessions(scout_id, token_hash)");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_comparison_profiles_type ON comparison_profiles(source_type)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_comparison_profiles_championship ON comparison_profiles(championship_id)");
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
    $json = $GLOBALS['FTC_TEST_INPUT'] ?? file_get_contents('php://input');
    return json_decode($json, true) ?? [];
}

function getTimeInterval(int $timestamp, bool $isFullMatch = false, int $transitionDurationMs = DEFAULT_TRANSITION_DURATION_MS): string {
    if ($isFullMatch) {
        if ($timestamp < 30000) return 'auto';
        $teleopStart = 30000 + normalizeTransitionDurationMs($transitionDurationMs);
        if ($timestamp < $teleopStart) return 'transition';
        $teleopTime = $timestamp - $teleopStart;
    } else {
        $teleopTime = $timestamp;
    }
    
    if ($teleopTime < 30000) return '0-30s';
    if ($teleopTime < 60000) return '30-60s';
    if ($teleopTime < 90000) return '60-90s';
    return '90-120s';
}

function tableHasColumn(PDO $pdo, string $table, string $column): bool {
    $stmt = $pdo->query("PRAGMA table_info($table)");
    foreach ($stmt->fetchAll() as $info) {
        if (($info['name'] ?? null) === $column) return true;
    }
    return false;
}

function ensureDefaultChampionship(PDO $pdo): string {
    $stmt = $pdo->prepare("SELECT id FROM championships WHERE event_code = ? LIMIT 1");
    $stmt->execute(['BRCMP']);
    $existing = $stmt->fetch();
    if ($existing) return $existing['id'];

    $id = 'championship-brcmp-2025';
    $now = date('c');
    $stmt = $pdo->prepare("
        INSERT INTO championships (
            id, parent_id, name, short_name, season, event_code, scope_type, level,
            timezone, status, sort_order, created_at, updated_at
        ) VALUES (?, NULL, ?, ?, ?, ?, 'standalone', 'national', 'America/Sao_Paulo', 'active', 0, ?, ?)
    ");
    $stmt->execute([$id, 'Nacional Brasil 2026', 'Nacional BR 2026', '2025', 'BRCMP', $now, $now]);
    return $id;
}

function enrollTeamsFromChampionshipMatches(PDO $pdo, string $championshipId): void {
    $stmt = $pdo->prepare("
        SELECT red_team1_number, red_team2_number, red_team3_number,
               blue_team1_number, blue_team2_number, blue_team3_number
        FROM matches
        WHERE championship_id = ?
    ");
    $stmt->execute([$championshipId]);

    $teamNumbers = [];
    foreach ($stmt->fetchAll() as $match) {
        foreach (['red_team1_number', 'red_team2_number', 'red_team3_number', 'blue_team1_number', 'blue_team2_number', 'blue_team3_number'] as $field) {
            $teamNumber = (int)($match[$field] ?? 0);
            if ($teamNumber > 0) $teamNumbers[$teamNumber] = true;
        }
    }

    if (empty($teamNumbers)) return;

    $now = date('c');
    $insert = $pdo->prepare("
        INSERT OR IGNORE INTO championship_teams (id, championship_id, team_number, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
    ");

    foreach (array_keys($teamNumbers) as $teamNumber) {
        $insert->execute([generateId(), $championshipId, $teamNumber, $now, $now]);
    }
}

function inferFtcScoutDivisionParentCode(string $eventCode): ?string {
    if (preg_match('/^(FTCCMP\d+)([A-Z]{3,})$/', $eventCode, $matches)) {
        return $matches[1];
    }
    return null;
}

function matchDisplayPrefix(string $matchType): string {
    if ($matchType === 'qualification') return 'Q';
    if ($matchType === 'practice') return 'T';
    return 'M';
}

function formatMatchDisplayName(string $matchType, int $matchNumber): string {
    return matchDisplayPrefix($matchType) . $matchNumber;
}

function normalizeStoredPlayoffMatchNumber(int $matchNumber): int {
    if ($matchNumber >= 21000) {
        $series = intdiv($matchNumber, 1000) - 20;
        $matchInSeries = $matchNumber % 1000;
        if ($series > 0 && $matchInSeries > 0) return $series;
    }

    return $matchNumber;
}

function normalizeMatchDisplayNames(PDO $pdo): void {
    if (!tableHasColumn($pdo, 'matches', 'match_type')) return;
    if (!tableHasColumn($pdo, 'matches', 'match_number')) return;
    if (!tableHasColumn($pdo, 'matches', 'display_name')) return;

    $stmt = $pdo->query("SELECT id, match_type, match_number, display_name, source_system, source_match_number FROM matches");
    $update = $pdo->prepare("
        UPDATE matches
        SET match_number = ?, display_name = ?, updated_at = ?
        WHERE id = ?
    ");

    foreach ($stmt->fetchAll() as $row) {
        $matchType = (string)($row['match_type'] ?? 'qualification');
        $storedNumber = (int)($row['match_number'] ?? 0);
        $sourceMatchNumber = (int)($row['source_match_number'] ?? 0);
        $isFtcScoutPlayoff = $matchType === 'elimination'
            && ($row['source_system'] ?? null) === 'ftcscout'
            && $sourceMatchNumber >= 21000;
        if ($isFtcScoutPlayoff) {
            $series = intdiv($sourceMatchNumber, 1000) - 20;
            $matchInSeries = $sourceMatchNumber % 1000;
            $matchNumber = $matchInSeries > 1 ? ($series * 1000 + $matchInSeries) : $series;
            $displayName = $matchInSeries > 1 ? ('M' . $series . '-' . $matchInSeries) : ('M' . $series);
        } else {
            $matchNumber = $matchType === 'elimination'
                ? normalizeStoredPlayoffMatchNumber($storedNumber)
                : $storedNumber;
            $displayName = formatMatchDisplayName($matchType, $matchNumber);
        }

        if ($matchNumber === $storedNumber && ($row['display_name'] ?? null) === $displayName) {
            continue;
        }

        $update->execute([$matchNumber, $displayName, date('c'), $row['id']]);
    }
}

function normalizeFtcScoutChampionshipHierarchy(PDO $pdo): void {
    if (!tableHasColumn($pdo, 'championships', 'parent_id')) return;
    if (!tableHasColumn($pdo, 'championships', 'scope_type')) return;

    $stmt = $pdo->query("
        SELECT id, season, event_code
        FROM championships
        WHERE scope_type = 'event_group' AND event_code LIKE 'FTCCMP%'
    ");

    $parents = [];
    foreach ($stmt->fetchAll() as $row) {
        $parents[($row['season'] ?? '') . '|' . ($row['event_code'] ?? '')] = $row['id'];
    }
    if (empty($parents)) return;

    $stmt = $pdo->query("
        SELECT id, season, event_code, scope_type, parent_id
        FROM championships
        WHERE event_code LIKE 'FTCCMP%' AND scope_type != 'event_group'
    ");
    $update = $pdo->prepare("
        UPDATE championships
        SET parent_id = ?,
            scope_type = 'division',
            level = CASE WHEN level IS NULL OR level = '' THEN 'division' ELSE level END,
            sort_order = CASE WHEN sort_order = 0 THEN 10 ELSE sort_order END,
            updated_at = ?
        WHERE id = ?
    ");

    foreach ($stmt->fetchAll() as $row) {
        $eventCode = (string)($row['event_code'] ?? '');
        $parentCode = inferFtcScoutDivisionParentCode($eventCode);
        if (!$parentCode) continue;

        $parentId = $parents[($row['season'] ?? '') . '|' . $parentCode] ?? null;
        if (!$parentId) continue;
        if (($row['parent_id'] ?? null) === $parentId && ($row['scope_type'] ?? null) === 'division') continue;

        $update->execute([$parentId, date('c'), $row['id']]);
    }
}

function migrateExistingMatchesToDefaultChampionship(PDO $pdo): void {
    if (!tableHasColumn($pdo, 'matches', 'championship_id')) return;

    $stmt = $pdo->query("SELECT COUNT(*) as total FROM matches WHERE championship_id IS NULL OR championship_id = ''");
    $total = (int)($stmt->fetch()['total'] ?? 0);
    if ($total === 0) return;

    $championshipId = ensureDefaultChampionship($pdo);
    $now = date('c');

    $stmt = $pdo->prepare("UPDATE matches SET championship_id = ?, updated_at = ? WHERE championship_id IS NULL OR championship_id = ''");
    $stmt->execute([$championshipId, $now]);

    enrollTeamsFromChampionshipMatches($pdo, $championshipId);
}

function getChampionshipScopeIds(PDO $pdo, ?string $championshipId, bool $includeChildren = false): array {
    if (!$championshipId) return [];

    $ids = [$championshipId];
    if (!$includeChildren) return $ids;

    $seen = [$championshipId => true];
    $queue = [$championshipId];

    while (!empty($queue)) {
        $current = array_shift($queue);
        $stmt = $pdo->prepare("SELECT id FROM championships WHERE parent_id = ?");
        $stmt->execute([$current]);
        foreach ($stmt->fetchAll() as $row) {
            $id = $row['id'];
            if (!isset($seen[$id])) {
                $seen[$id] = true;
                $ids[] = $id;
                $queue[] = $id;
            }
        }
    }

    return $ids;
}

function appendChampionshipScopeFilter(PDO $pdo, array &$where, array &$params, ?string $championshipId, bool $includeChildren, string $column = 'championship_id'): void {
    if (!$championshipId) return;

    $ids = getChampionshipScopeIds($pdo, $championshipId, $includeChildren);
    if (empty($ids)) {
        $where[] = "1 = 0";
        return;
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $where[] = "$column IN ($placeholders)";
    $params = array_merge($params, $ids);
}

function runMigrations(PDO $pdo): void {
    $migrations = [
        "ALTER TABLE rounds ADD COLUMN round_type TEXT DEFAULT 'teleop_only'",
        "ALTER TABLE rounds ADD COLUMN battery_name TEXT",
        "ALTER TABLE rounds ADD COLUMN battery_volts REAL",
        "ALTER TABLE rounds ADD COLUMN strategy TEXT",
        "ALTER TABLE rounds ADD COLUMN transition_duration_ms INTEGER DEFAULT 15000",
        "ALTER TABLE cycles ADD COLUMN zone TEXT",
        "ALTER TABLE cycles ADD COLUMN is_autonomous INTEGER DEFAULT 0",
        "ALTER TABLE cycles ADD COLUMN notes TEXT",
        "ALTER TABLE scouts ADD COLUMN transition_duration_ms INTEGER DEFAULT 15000",
        "ALTER TABLE scouts ADD COLUMN keyboard_shortcuts_json TEXT",
        "ALTER TABLE scouts ADD COLUMN password_hash TEXT",
        "ALTER TABLE championships ADD COLUMN alliance_size INTEGER NOT NULL DEFAULT 2",
        "ALTER TABLE scouting_rounds ADD COLUMN transition_duration_ms INTEGER DEFAULT 15000",
        "ALTER TABLE matches ADD COLUMN display_name TEXT",
        "ALTER TABLE matches ADD COLUMN championship_id TEXT",
        "ALTER TABLE matches ADD COLUMN source_match_id TEXT",
        "ALTER TABLE matches ADD COLUMN source_match_number INTEGER",
        "ALTER TABLE matches ADD COLUMN source_system TEXT",
        "ALTER TABLE matches ADD COLUMN red_team3_number INTEGER",
        "ALTER TABLE matches ADD COLUMN red_team3_name TEXT",
        "ALTER TABLE matches ADD COLUMN blue_team3_number INTEGER",
        "ALTER TABLE matches ADD COLUMN blue_team3_name TEXT",
        "ALTER TABLE teams ADD COLUMN logo_file_path TEXT",
        "ALTER TABLE teams ADD COLUMN city TEXT",
        "ALTER TABLE match_media ADD COLUMN thumbnail_path TEXT",
        "ALTER TABLE match_media ADD COLUMN source_type TEXT DEFAULT 'local'",
        "ALTER TABLE match_media ADD COLUMN external_provider TEXT",
        "ALTER TABLE match_media ADD COLUMN external_url TEXT",
        "ALTER TABLE match_media ADD COLUMN external_id TEXT",
        "ALTER TABLE match_media ADD COLUMN external_event_id TEXT",
        "ALTER TABLE match_media ADD COLUMN external_match_id TEXT",
        "ALTER TABLE match_media ADD COLUMN external_clip_id TEXT",
        "ALTER TABLE match_media ADD COLUMN video_match_start_ms INTEGER",
        "ALTER TABLE match_media ADD COLUMN video_duration_ms INTEGER",
        "ALTER TABLE match_media ADD COLUMN thumbnail_url TEXT",
        "ALTER TABLE match_media ADD COLUMN metadata_json TEXT",
    ];

    foreach ($migrations as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException $e) {
        }
    }

    $pdo->exec("UPDATE championships SET alliance_size = 3 WHERE upper(COALESCE(event_code, '')) = 'FPECRI'");

    migrateExistingMatchesToDefaultChampionship($pdo);
    normalizeFtcScoutChampionshipHierarchy($pdo);
    normalizeMatchDisplayNames($pdo);

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_media_external_match ON match_media(external_provider, external_match_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_media_external_clip ON match_media(external_provider, external_clip_id)");
}
