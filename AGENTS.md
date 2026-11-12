# AGENTS.md

## Regra principal

Este repositorio contem dois produtos relacionados, mas eles nao devem ser tratados como uma coisa so.

Antes de editar qualquer arquivo, identifique qual superficie a tarefa pediu:

- `api/`: backend PHP online do sistema de scout e futura API central.
- `client/`: frontend web hospedado do sistema de scout.
- `heatmap_project/`: projeto local Python para arena configuravel, tracking, heatmap, metricas espaciais e integracoes futuras.

Nao misture os projetos sem pedido explicito.

## Scout online atual

Use `api/` e `client/` quando a tarefa falar sobre:

- sistema de scout atual;
- campeonatos, equipes, partidas, scouts, usuarios ou uploads no site;
- backend PHP;
- frontend web hospedado;
- visualizacao online de dados ja existentes.

O backend online deve continuar compativel com hospedagem PHP. Nao introduza Python como requisito de servidor.

## Robot Heatmap Scout

Use `heatmap_project/` quando a tarefa falar sobre:

- configuracao visual de arena;
- calibracao de video;
- tracking de robo;
- heatmap;
- trajetoria;
- metricas espaciais;
- ferramenta local;
- executavel futuro para alunos;
- integracao futura com Unreal Engine.

Para tarefas do heatmap, leia primeiro:

1. `heatmap_project/robot_heatmap_agent_context/00_CONTEXT_MASTER.md`
2. `heatmap_project/robot_heatmap_agent_context/AGENTS.md`
3. `heatmap_project/robot_heatmap_agent_context/docs/roadmap.md`

## Fronteira atual entre os sistemas

No estagio atual, o heatmap deve ser offline-first.

Nao conecte o heatmap a API PHP, login, banco online, upload remoto ou mock remoto sem uma tarefa que peca explicitamente a fase de integracao.

O heatmap deve produzir artefatos locais padronizados primeiro. A comunicacao com a API PHP vira depois por contratos de dados.

## Visao futura

A arquitetura futura desejada e:

- PHP online como hub de dados e API central.
- Python local como ferramenta pesada de processamento visual.
- Client web como visualizador online de scout, heatmaps e metricas.
- Unreal Engine como simulador que consome dados da API e pode enviar resultados futuramente.

Planeje interfaces futuras com cuidado, mas nao implemente endpoints ou dependencias remotas durante o MVP do heatmap.
