<?php

function assertCareer($condition, string $message): void {
    if (!$condition) throw new Exception($message);
}

function runCareerEndpoint(string $endpoint, string $dbPath, array $query): array {
    $runner = tempnam(sys_get_temp_dir(), 'ftc_team_career_');
    $code = "<?php\nputenv('FTC_DB_PATH=' . " . var_export($dbPath, true) . ");\n"
        . "\$_SERVER['REQUEST_METHOD']='GET';\n\$_GET=" . var_export($query, true) . ";\n"
        . "require " . var_export(realpath($endpoint), true) . ";\n";
    file_put_contents($runner, $code);
    $output = shell_exec(PHP_BINARY . ' ' . escapeshellarg($runner));
    @unlink($runner);
    $decoded = json_decode($output ?? '', true);
    if (!is_array($decoded)) throw new Exception('Invalid endpoint response: ' . $output);
    return $decoded;
}

$tmpDb = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ftc_team_career_' . uniqid('', true) . '.db';
putenv('FTC_DB_PATH=' . $tmpDb);
require_once __DIR__ . '/../config.php';
$db = getDB();
$now = date('c');

$db->prepare("INSERT INTO teams (team_number, team_name, created_at, updated_at) VALUES (100, 'Alpha', ?, ?)")->execute([$now, $now]);
$db->prepare("INSERT INTO championships (id,parent_id,name,short_name,season,scope_type,starts_at,status,sort_order,created_at,updated_at)
 VALUES ('world',NULL,'World','World','2025','event_group',NULL,'active',0,?,?),
 ('goodall','world','Goodall Division','Goodall','2025','division','2026-04-29','active',1,?,?),
 ('regional',NULL,'Regional','Regional','2024','standalone','2025-03-01','active',0,?,?)")
    ->execute([$now,$now,$now,$now,$now,$now]);
$db->prepare("INSERT INTO championship_teams (id,championship_id,team_number,status,created_at,updated_at)
 VALUES ('ct1','goodall',100,'active',?,?),('ct2','regional',200,'active',?,?)")
    ->execute([$now,$now,$now,$now]);

$insertMatch = $db->prepare("INSERT INTO matches
 (id,championship_id,match_type,match_number,display_name,red_team1_number,red_team1_name,red_team2_number,blue_team1_number,blue_team2_number,created_at,updated_at)
 VALUES (?,?,?,?,?,100,'Alpha',101,102,103,?,?)");
$insertMatch->execute(['m1','goodall','qualification',1,'Q1',$now,$now]);
$insertMatch->execute(['m2','regional','qualification',2,'Q2',$now,$now]);
$db->prepare("INSERT INTO scouting_rounds (id,match_id,team_number,start_time,created_at,updated_at) VALUES ('sr1','m1',100,?,?,?)")
    ->execute([$now,$now,$now]);
$db->prepare("INSERT INTO match_media (id,match_id,filename,original_filename,file_path,file_type,file_size,mime_type,tagged_teams,category,uploaded_at)
 VALUES ('mm1','m1','x.jpg','x.jpg','x.jpg','image',1,'image/jpeg','[100]','key_moment',?)")->execute([$now]);
$db->prepare("INSERT INTO match_media (id,match_id,filename,original_filename,file_path,file_type,file_size,mime_type,tagged_teams,category,uploaded_at)
 VALUES ('mm2','m1','y.jpg','y.jpg','y.jpg','image',1,'image/jpeg','[1100]','key_moment',?)")->execute([$now]);

$profile = runCareerEndpoint(__DIR__ . '/../team-profile.php', $tmpDb, ['team_number' => 100]);
assertCareer(count($profile['seasons']) === 2, 'career must contain both seasons');
assertCareer($profile['summary']['events_count'] === 2, 'career must group child division into its parent event');
assertCareer($profile['summary']['matches_count'] === 2, 'career match count must include all seasons');
assertCareer($profile['summary']['scouted_matches_count'] === 1, 'career scout count must be distinct by match');
assertCareer($profile['summary']['media_count'] === 1, 'career media count must be included');
$world = $profile['seasons'][0]['events'][0];
assertCareer($world['id'] === 'world' && $world['registered'] === true, 'division enrollment must roll up into parent event');
assertCareer($world['starts_at'] === '2026-04-29', 'parent event must inherit a participating division date when needed');
assertCareer(count($world['divisions']) === 1 && $world['divisions'][0]['id'] === 'goodall', 'only participating divisions must be returned');

$scoped = runCareerEndpoint(__DIR__ . '/../team-profile.php', $tmpDb, ['team_number' => 100, 'championship_id' => 'goodall']);
assertCareer(count($scoped['matches']) === 1, 'legacy match scope must remain compatible');
assertCareer(count($scoped['seasons']) === 2, 'career summary must ignore the legacy detail scope');

$directory = runCareerEndpoint(__DIR__ . '/../teams.php', $tmpDb, ['view' => 'directory']);
$numbers = array_column($directory, 'team_number');
assertCareer(in_array(100, $numbers, true) && in_array(200, $numbers, true) && in_array(103, $numbers, true), 'directory must merge registered, known, and match-only teams');
$matchOnly = $directory[array_search(103, $numbers, true)];
assertCareer($matchOnly['incomplete'] === true, 'match-only team must be marked incomplete');

$seasonDirectory = runCareerEndpoint(__DIR__ . '/../teams.php', $tmpDb, ['view' => 'directory', 'season' => '2025']);
assertCareer(in_array(100, array_column($seasonDirectory, 'team_number'), true), 'season filter must keep active team');
assertCareer(!in_array(200, array_column($seasonDirectory, 'team_number'), true), 'season filter must remove teams from other seasons');

@unlink($tmpDb);
echo "team_profile_career_test passed\n";
