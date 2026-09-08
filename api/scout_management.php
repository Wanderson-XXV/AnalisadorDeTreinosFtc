<?php
require_once 'config.php';
require_once 'scout_management_lib.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Metodo nao permitido', 405);
    jsonResponse(getScoutManagementData(getDB(), $_GET));
} catch (InvalidArgumentException $e) {
    jsonError($e->getMessage(), 400);
} catch (Exception $e) {
    jsonError($e->getMessage());
}
