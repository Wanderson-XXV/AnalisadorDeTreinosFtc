# Integracao futura com API PHP

## Decisao arquitetural

O backend PHP online deve ser o hub de dados do ecossistema de scout.

A ferramenta de heatmap deve nascer como app local Python offline-first, porque processamento de video, tracking e geracao de heatmap sao tarefas pesadas e inadequadas para a hospedagem PHP atual.

No MVP, o heatmap nao deve depender da API. A integracao deve ser planejada por contratos de dados e implementada somente depois que o fluxo local estiver validado.

## Papéis dos sistemas

### API PHP online

Responsavel por centralizar dados compartilhados:

- torneios;
- equipes;
- partidas;
- scouts;
- usuarios;
- resultados processados de heatmap;
- pacotes futuros de simulacao.

O PHP deve continuar sendo compativel com a hospedagem atual. Nao exigir Python no servidor.

### App local Python

Responsavel pelo processamento pesado:

- configurar arena;
- calibrar videos;
- rastrear robos;
- gerar trajetorias;
- gerar heatmaps;
- calcular metricas espaciais;
- exportar pacotes locais reutilizaveis.

O app deve funcionar sem internet na fase inicial.

### Client web

Responsavel por visualizar e explorar dados online:

- scout tradicional;
- informacoes de torneio;
- perfis de equipes;
- heatmaps enviados pelo app local;
- estatisticas espaciais e comparacoes futuras.

### Unreal Engine

Consumidor futuro da API para simulacao:

- importar equipes, robos, partidas e trajetorias;
- usar CADs dos robos quando disponiveis;
- reconstruir ou simular partidas;
- futuramente enviar resultados de simulacao para a API.

## Fases de integracao

### Fase 0 — MVP local sem API

Estado atual.

O heatmap deve produzir resultados locais sem depender de:

- login;
- rede;
- banco online;
- endpoints PHP;
- upload remoto;
- mock remoto obrigatorio.

### Fase 1 — Importacao opcional

O app local passa a poder buscar dados da API PHP, mas ainda funciona sem ela.

Contrato conceitual:

```text
tournament_import
```

Conteudo esperado:

- torneio;
- equipes;
- partidas;
- metadados necessarios para associar uma analise local a uma partida.

### Fase 2 — Upload de resultados

O app local envia resultados processados para a API PHP.

Contrato conceitual:

```text
heatmap_package
```

Conteudo esperado:

- manifest da analise;
- arquivo de tracking;
- metricas por zona;
- imagens renderizadas de heatmap e trajetoria;
- metadados de arena e calibracao usados na analise.

### Fase 3 — Visualizacao web

O client web passa a mostrar os resultados enviados:

- heatmap por partida;
- trajetoria por equipe;
- tempo por zona;
- comparacoes entre equipes e torneios.

### Fase 4 — Simulador

O Unreal Engine passa a consumir dados da API.

Contrato conceitual:

```text
simulation_package
```

Conteudo esperado:

- dados de partida;
- equipes;
- robos;
- trajetorias;
- eventos relevantes;
- parametros para reconstrucao ou simulacao.

## Formato local recomendado

Durante o MVP, cada analise deve gerar uma pasta propria.

Exemplo:

```text
outputs/analyses/match_q12_team_16049/
├── manifest.json
├── positions.csv
├── zones.csv
├── trajectory.png
├── heatmap.png
├── field.yaml
└── calibration.yaml
```

Uso recomendado:

- YAML para arena, zonas e calibracao.
- CSV para series temporais e metricas tabulares.
- JSON para manifest e metadados de pacote.
- PNG/JPG para visualizacoes renderizadas.

## Regra para agentes

Quando estiver trabalhando no MVP do heatmap, nao implemente integracao com API PHP.

Quando estiver trabalhando na integracao, nao trate mock data como destino final. Use mock apenas para testes locais e documente qual contrato real ele representa.

Se a tarefa nao mencionar explicitamente API, sincronizacao, upload ou importacao online, mantenha o trabalho dentro do fluxo local.
