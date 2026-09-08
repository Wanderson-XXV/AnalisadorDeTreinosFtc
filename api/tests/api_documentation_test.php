<?php

$indexPath = realpath(__DIR__ . '/../index.php');
$htaccessPath = realpath(__DIR__ . '/../.htaccess');

if (!$indexPath || !$htaccessPath) {
    fwrite(STDERR, "API documentation files were not found\n");
    exit(1);
}

ob_start();
require $indexPath;
$html = ob_get_clean();

if (!str_contains($html, 'Scout Online API')) {
    fwrite(STDERR, "API index does not render the documentation title\n");
    exit(1);
}

foreach (['rounds.php', 'scouting.php', 'championships.php', 'media.php'] as $endpoint) {
    if (!str_contains($html, $endpoint)) {
        fwrite(STDERR, "API index is missing endpoint: $endpoint\n");
        exit(1);
    }
}

$htaccess = file_get_contents($htaccessPath);
if (!str_contains($htaccess, 'RewriteRule ^([a-zA-Z0-9_-]+)/?$ $1.php [L,QSA]')) {
    fwrite(STDERR, "API .htaccess does not expose extensionless endpoint routing\n");
    exit(1);
}

echo "api_documentation_test passed\n";
