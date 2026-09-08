<?php

function assertAllianceLock($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'alliance_lock_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../config.php';

$db = getDB();
$db->prepare("INSERT INTO championships (id, name, scope_type, alliance_size) VALUES ('locked', 'Locked', 'standalone', 2)")->execute();

$runner = tempnam(sys_get_temp_dir(), 'alliance_lock_runner_');
$code = "<?php\n"
    . "putenv('FTC_DB_PATH=' . " . var_export($tmpDb, true) . ");\n"
    . "\$_SERVER['REQUEST_METHOD'] = 'PUT';\n"
    . "\$GLOBALS['FTC_TEST_INPUT'] = " . var_export(json_encode(['id' => 'locked', 'alliance_size' => 3]), true) . ";\n"
    . "require " . var_export(realpath(__DIR__ . '/../championships.php'), true) . ";\n";
file_put_contents($runner, $code);
$output = shell_exec(PHP_BINARY . ' ' . escapeshellarg($runner));
@unlink($runner);

$decoded = json_decode((string)$output, true);
assertAllianceLock(isset($decoded['error']) && str_contains($decoded['error'], 'bloqueado'), 'API must reject changing 2x2 to 3x3');
assertAllianceLock((int)$db->query("SELECT alliance_size FROM championships WHERE id = 'locked'")->fetchColumn() === 2, 'rejected update must preserve alliance_size');

@unlink($tmpDb);
echo "championship_alliance_size_lock_test passed\n";

