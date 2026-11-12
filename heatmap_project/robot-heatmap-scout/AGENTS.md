# AGENTS.md — robot-heatmap-scout

## Prioridade atual

**Arena Configurator** e a prioridade numero 1 deste projeto.

Nao comece pelo tracker.
Nao comece pela integracao com a API PHP.
Nao implemente login, banco online, upload remoto ou dashboard web.

## Principio offline-first

Este projeto e local e offline-first.

- Nao depende de internet para funcionar.
- Nao depende de API PHP para rodar.
- Artefatos sao salvos em YAML, CSV, JSON e PNG localmente.
- A integracao com a API PHP e futura e opcional.

## Fase atual: Fase 0 — Local offline-first

- Configurar arena com imagem top-down.
- Desenhar zonas manualmente.
- Marcar pontos de referencia.
- Exportar YAML reutilizavel.
- Reabrir YAML e renderizar zonas na imagem.

## Regras para agentes

- Manter codigo simples, pequeno e testavel.
- Preferir funcoes claras em modulos separados.
- Usar OpenCV para interface visual.
- Usar PyYAML para salvar/carregar configuracoes.
- Documentar decisoes em docs/acompanhamento.md.
- Nao alterar api/ nem client/.
- Nao implementar endpoints, sincronizacao online ou upload remoto nesta fase.
- Nao supor que existe conexao de rede.

## Estrutura dos modulos

- `src/robot_heatmap/field_config.py` — criar, carregar, salvar e validar YAML de arena.
- `src/robot_heatmap/coordinates.py` — converter coordenadas imagem <-> campo normalizado.
- `src/robot_heatmap/zones.py` — validar e normalizar estrutura de zonas.
- `src/robot_heatmap/arena_editor.py` — toda a interacao com OpenCV.
- `scripts/arena_configurator.py` — entrypoint fino que chama os modulos acima.

## Proximo passo apos Arena Configurator

1. Video Calibration — ligar pontos do video real aos pontos de referencia da arena.
2. Tracker Human-in-the-loop — rastrear robo no video com auxilio humano.
3. Visualizacoes e metricas — trajetoria, heatmap, tempo por zona.
