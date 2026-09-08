<?php
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'), '/\\');
$baseUrl = ($basePath === '' || $basePath === '.') ? '/api' : $basePath;
$endpoints = [
    [
        'method' => 'GET',
        'path' => 'championships.php',
        'description' => 'Lista, cria e organiza campeonatos, divisoes e partidas importadas.',
    ],
    [
        'method' => 'GET',
        'path' => 'matches.php',
        'description' => 'Lista partidas e filtros por campeonato.',
    ],
    [
        'method' => 'GET/POST',
        'path' => 'scouting.php',
        'description' => 'Controla rounds de scout por partida e equipe.',
    ],
    [
        'method' => 'GET/POST',
        'path' => 'scouting_cycles.php',
        'description' => 'Registra e consulta ciclos manuais de scout.',
    ],
    [
        'method' => 'GET/POST',
        'path' => 'media.php',
        'description' => 'Gerencia videos, links externos e offset de inicio da partida.',
    ],
    [
        'method' => 'GET',
        'path' => 'analysis.php',
        'description' => 'Calcula metricas agregadas por equipe a partir dos ciclos scoutados.',
    ],
    [
        'method' => 'GET/POST/PUT/DELETE',
        'path' => 'comparison-profiles.php',
        'description' => 'Mantem perfis ficticios para comparacoes de desempenho.',
    ],
    [
        'method' => 'GET',
        'path' => 'stats.php',
        'description' => 'Mostra estatisticas gerais dos rounds e ciclos locais.',
    ],
    [
        'method' => 'GET',
        'path' => 'rounds.php',
        'description' => 'Endpoints legados de rounds do timer simples.',
    ],
];
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Scout Online API</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f8fb;
      color: #182033;
    }

    body {
      margin: 0;
      padding: 32px;
    }

    main {
      max-width: 960px;
      margin: 0 auto;
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 5vw, 3.5rem);
      line-height: 1;
      letter-spacing: 0;
    }

    .subtitle {
      margin: 0 0 28px;
      color: #526071;
      font-size: 1rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      border: 1px solid #dfe4ec;
      border-radius: 8px;
      overflow: hidden;
    }

    th,
    td {
      padding: 14px 16px;
      border-bottom: 1px solid #e8edf4;
      text-align: left;
      vertical-align: top;
    }

    th {
      color: #526071;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0;
      background: #f1f4f8;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    code {
      display: inline-block;
      padding: 3px 6px;
      border-radius: 6px;
      background: #edf2f7;
      color: #12365d;
      font-size: 0.92rem;
    }

    .method {
      white-space: nowrap;
      font-weight: 700;
      color: #0f766e;
    }

    .note {
      margin-top: 20px;
      color: #526071;
      font-size: 0.92rem;
    }

    @media (max-width: 720px) {
      body {
        padding: 20px;
      }

      table,
      tbody,
      tr,
      td {
        display: block;
      }

      thead {
        display: none;
      }

      tr {
        padding: 12px 0;
        border-bottom: 1px solid #e8edf4;
      }

      td {
        border: 0;
        padding: 5px 14px;
      }
    }

    @media (prefers-color-scheme: dark) {
      :root {
        background: #111827;
        color: #f9fafb;
      }

      .subtitle,
      .note,
      th {
        color: #aab4c3;
      }

      table {
        background: #182235;
        border-color: #2e3b51;
      }

      th {
        background: #202c41;
      }

      th,
      td,
      tr {
        border-color: #2e3b51;
      }

      code {
        background: #22304a;
        color: #d7e8ff;
      }

      .method {
        color: #5eead4;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>Scout Online API</h1>
    <p class="subtitle">Endpoints PHP disponiveis para o sistema de scout.</p>

    <table>
      <thead>
        <tr>
          <th>Metodo</th>
          <th>Endpoint</th>
          <th>Uso</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($endpoints as $endpoint): ?>
          <tr>
            <td class="method"><?= htmlspecialchars($endpoint['method'], ENT_QUOTES, 'UTF-8') ?></td>
            <td><code><?= htmlspecialchars($baseUrl . '/' . $endpoint['path'], ENT_QUOTES, 'UTF-8') ?></code></td>
            <td><?= htmlspecialchars($endpoint['description'], ENT_QUOTES, 'UTF-8') ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>

    <p class="note">Rotas sem extensao tambem funcionam quando o Apache usa este .htaccess. Exemplo: <code><?= htmlspecialchars($baseUrl . '/matches', ENT_QUOTES, 'UTF-8') ?></code>.</p>
  </main>
</body>
</html>
