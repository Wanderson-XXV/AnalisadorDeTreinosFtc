<?php
require_once __DIR__ . '/config.php';

/**
 * Importador idempotente do Chicago Robotics Invitational 2026.
 *
 * Fonte conferida em 17/07/2026:
 * https://ftc-events.firstinspires.org/2025/FPECRI
 */
function importCri2026(PDO $db): array {
    $teams = [
        4017 => 'RoboPandas',
        4650 => 'Crusader Kryptos',
        8581 => 'Ædificatores',
        10127 => "Tesla's Knights",
        11052 => 'Project R',
        11329 => 'I.C.E. Robotics',
        12560 => 'Soft Hoarders',
        12971 => 'Ctrl-Y',
        13312 => 'The Bombers',
        14204 => 'Super Scream Bros',
        14596 => 'XLR8',
        14988 => 'Royal ρ-botics (Rho-botics)',
        15042 => 'Ctrl-X',
        16008 => 'Armored Artemises',
        16460 => 'GEarheads',
        16481 => 'Robo Racers',
        18221 => 'Meta^Infinity',
        19652 => 'Techineers',
        22043 => 'VIOHALCO TECHNOLOGIES FTC',
        22131 => 'Traffic Cones',
        22482 => 'Hippobotamus',
        23055 => 'Tech Fenix',
        23286 => 'Lazer Robotics',
        23644 => 'Skeleton Army',
        23802 => 'Random Engineers',
        24478 => 'EngiNeerds',
        25444 => 'The Reckless',
        25538 => 'ARRA',
        25620 => 'Hexadecimal Nibble',
        25650 => 'One Small Step for an Axolotl',
        25687 => 'TechnoBolts',
        25779 => 'Action Robotix',
        26192 => 'Heatwaves',
        26858 => 'Prairie Bytes',
        28067 => 'Mystery Plus',
        30526 => 'BroncoBots',
        31799 => 'The Regenesis Project',
        33778 => 'Mechanical Error',
    ];

    $db->beginTransaction();
    try {
        $now = date('c');
        $stmt = $db->prepare("SELECT id FROM championships WHERE season = ? AND upper(COALESCE(event_code, '')) = 'FPECRI' LIMIT 1");
        $stmt->execute(['2025']);
        $championshipId = $stmt->fetchColumn();
        $championshipCreated = false;

        if (!$championshipId) {
            $championshipId = generateId();
            $stmt = $db->prepare("
                INSERT INTO championships (
                    id, parent_id, name, short_name, season, event_code, scope_type, level,
                    starts_at, ends_at, timezone, location, status, sort_order, alliance_size,
                    created_at, updated_at
                ) VALUES (?, NULL, ?, ?, ?, ?, 'standalone', ?, ?, ?, ?, ?, 'active', 10, 3, ?, ?)
            ");
            $stmt->execute([
                $championshipId,
                'Chicago Robotics Invitational Premier Event',
                'CRI 2026',
                '2025',
                'FPECRI',
                'PremierEvent',
                '2026-07-24',
                '2026-07-26',
                'America/Chicago',
                'Francis W. Parker School — Chicago, IL, USA',
                $now,
                $now,
            ]);
            $championshipCreated = true;
        } else {
            $stmt = $db->prepare("
                UPDATE championships
                SET name = ?, short_name = ?, event_code = 'FPECRI', level = ?, starts_at = ?,
                    ends_at = ?, timezone = ?, location = ?, status = 'active', alliance_size = 3,
                    updated_at = ?
                WHERE id = ?
            ");
            $stmt->execute([
                'Chicago Robotics Invitational Premier Event',
                'CRI 2026',
                'PremierEvent',
                '2026-07-24',
                '2026-07-26',
                'America/Chicago',
                'Francis W. Parker School — Chicago, IL, USA',
                $now,
                $championshipId,
            ]);
        }

        $teamsCreated = 0;
        $teamsUpdated = 0;
        $enrollmentsCreated = 0;
        $findTeam = $db->prepare('SELECT id, team_name FROM teams WHERE team_number = ?');
        $insertTeam = $db->prepare("INSERT INTO teams (team_number, team_name, logo_position, created_at, updated_at) VALUES (?, ?, 'center', ?, ?)");
        $updateTeam = $db->prepare('UPDATE teams SET team_name = ?, updated_at = ? WHERE team_number = ?');
        $findEnrollment = $db->prepare('SELECT id FROM championship_teams WHERE championship_id = ? AND team_number = ?');
        $insertEnrollment = $db->prepare("INSERT INTO championship_teams (id, championship_id, team_number, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)");
        $activateEnrollment = $db->prepare("UPDATE championship_teams SET status = 'active', updated_at = ? WHERE championship_id = ? AND team_number = ?");

        foreach ($teams as $teamNumber => $teamName) {
            $findTeam->execute([$teamNumber]);
            $existingTeam = $findTeam->fetch(PDO::FETCH_ASSOC);
            if (!$existingTeam) {
                $insertTeam->execute([$teamNumber, $teamName, $now, $now]);
                $teamsCreated++;
            } elseif (($existingTeam['team_name'] ?? '') !== $teamName) {
                $updateTeam->execute([$teamName, $now, $teamNumber]);
                $teamsUpdated++;
            }

            $findEnrollment->execute([$championshipId, $teamNumber]);
            if (!$findEnrollment->fetchColumn()) {
                $insertEnrollment->execute([generateId(), $championshipId, $teamNumber, $now, $now]);
                $enrollmentsCreated++;
            } else {
                $activateEnrollment->execute([$now, $championshipId, $teamNumber]);
            }
        }

        $db->commit();
        return [
            'success' => true,
            'championship_id' => $championshipId,
            'championship_created' => $championshipCreated,
            'alliance_size' => 3,
            'timezone' => 'America/Chicago',
            'official_teams' => count($teams),
            'teams_created' => $teamsCreated,
            'teams_updated' => $teamsUpdated,
            'enrollments_created' => $enrollmentsCreated,
            'matches_created' => 0,
            'source' => 'https://ftc-events.firstinspires.org/2025/FPECRI',
            'next_step' => 'Apague este arquivo da hospedagem depois de confirmar a importacao.',
        ];
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

if (!defined('FTC_CRI_IMPORT_LIBRARY_ONLY')) {
    try {
        if (($_GET['confirm'] ?? '') !== 'CRI2026-38-EQUIPES') {
            jsonError('Confirme pela URL: import_cri_2026_once.php?confirm=CRI2026-38-EQUIPES', 400);
        }
        jsonResponse(importCri2026(getDB()));
    } catch (Throwable $e) {
        jsonError($e->getMessage());
    }
}

