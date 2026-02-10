<?php
require_once 'config.php';

$pdo = new PDO('sqlite:' . DB_PATH);

echo "=== TODAS AS TABELAS ===\n";
$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll();
print_r($tables);

foreach ($tables as $table) {
    $tableName = $table['name'];
    echo "\n=== TABELA: $tableName ===\n";
    
    $schema = $pdo->query("PRAGMA table_info($tableName)")->fetchAll();
    echo "Colunas:\n";
    print_r($schema);
    
    $count = $pdo->query("SELECT COUNT(*) as total FROM $tableName")->fetch();
    echo "Total de registros: " . $count['total'] . "\n";
    
    if ($count['total'] > 0) {
        $data = $pdo->query("SELECT * FROM $tableName LIMIT 3")->fetchAll();
        echo "Primeiros registros:\n";
        print_r($data);
    }
}