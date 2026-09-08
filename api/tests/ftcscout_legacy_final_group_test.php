<?php

function assertTrue($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'legacy_final_group_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../ftcscout_import_lib.php';

$db = getDB();
$now = date('c');
$db->prepare("
    INSERT INTO championships (id, parent_id, name, short_name, season, event_code, scope_type, status, created_at, updated_at)
    VALUES ('legacy-parent', NULL, 'FIRST World Championship', 'Worlds', '2025', 'FTCCMP1', 'event_group', 'active', ?, ?),
           ('legacy-edison', 'legacy-parent', 'Edison Division', 'Edison', '2025', 'FTCCMP1EDIS', 'division', 'active', ?, ?)
")->execute([$now, $now, $now, $now]);

$result = importFtcScoutManualJson($db, [
    'events_json' => json_encode([[
        'season' => 2025,
        'code' => 'FTCCMP1',
        'divisionCode' => null,
        'name' => 'FIRST World Championship - Finals Division',
        'type' => 'FIRSTChampionship',
    ]]),
    'matches_json' => '[]',
    'teams_json' => '[]',
    'team_details_json' => '[]',
    'auto_enrich' => false,
]);
assertTrue($result['success'] === true, 'legacy import must succeed');

$group = $db->query("SELECT * FROM championships WHERE id = 'legacy-parent'")->fetch(PDO::FETCH_ASSOC);
assertTrue($group['event_code'] === 'FTCCMP1:GROUP', 'legacy parent must be renamed in place');
$edison = $db->query("SELECT * FROM championships WHERE id = 'legacy-edison'")->fetch(PDO::FETCH_ASSOC);
assertTrue($edison['parent_id'] === 'legacy-parent', 'existing divisions must keep the original parent id');
$final = $db->query("SELECT * FROM championships WHERE event_code = 'FTCCMP1' AND scope_type = 'final'")->fetch(PDO::FETCH_ASSOC);
assertTrue((bool)$final && $final['parent_id'] === 'legacy-parent', 'Finals must be created under the preserved parent');
assertTrue((int)$db->query("SELECT COUNT(*) FROM championships WHERE scope_type = 'event_group'")->fetchColumn() === 1, 'repair must not create a duplicate parent');

@unlink($tmpDb);
echo "ftcscout_legacy_final_group_test passed\n";

