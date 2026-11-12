# Acompanhamento — Robot Heatmap Scout

## Objetivo atual

Preparar o repositório e implementar primeiro o **Arena Configurator**.

O tracker vem depois.

## Status geral

- [ ] Estrutura inicial do repositório criada
- [ ] `AGENTS.md` criado
- [ ] `README.md` criado
- [ ] `requirements.txt` criado
- [ ] Documentação inicial criada
- [ ] `configs/fields/field_example.normalized.yaml` criado
- [ ] `scripts/arena_configurator.py` criado
- [ ] Arena Configurator abre imagem
- [ ] Arena Configurator desenha zonas
- [ ] Arena Configurator cria pontos de referência
- [ ] Arena Configurator salva YAML
- [ ] Arena Configurator recarrega YAML
- [ ] Calibração de vídeo criada
- [ ] Teste vídeo -> arena criado
- [ ] Tracker human-in-the-loop criado
- [ ] CSV de posições criado
- [ ] Trajetória criada
- [ ] Heatmap criado
- [ ] Tempo por zona criado

## Decisões tomadas

### Ordem do MVP

1. Arena Configurator
2. Video Calibration
3. Tracker Human-in-the-loop
4. Visualizações
5. Métricas

### Arena no MVP

Usar campo normalizado `1000x1000`, não medidas reais.

Motivo:

- reduz complexidade inicial;
- não depende do manual oficial;
- permite validar fluxo visual rapidamente;
- facilita adaptar depois para cm.

### Zonas

Usar polígonos.

Motivo:

- arenas e zonas reais podem ter formatos irregulares;
- polígonos cobrem retângulos e formas complexas.

### Pontos de referência

Usar pontos nomeados no YAML da arena.

Motivo:

- facilitam calibração do vídeo;
- deixam claro quais pontos devem ser clicados no frame.

### Tracker

Não implementar primeiro.

Motivo:

- antes do tracker, precisamos confirmar que vídeo -> arena está funcionando.

## Dúvidas abertas

- Qual imagem top-down será usada primeiro?
- A imagem estará recortada somente no campo ou terá margem?
- Quais zonas devem ser desenhadas primeiro?
- Quais pontos de referência são mais confiáveis no vídeo?
- O vídeo mostra todos os pontos de referência durante a partida?
- A câmera é realmente fixa durante toda a partida?

## Próximas ações

1. Criar estrutura do repositório.
2. Implementar `arena_configurator.py`.
3. Testar com uma imagem top-down qualquer.
4. Gerar primeiro `field.yaml`.
5. Reabrir o YAML e validar visualmente.
6. Implementar calibração de vídeo.
7. Testar clique no vídeo -> ponto na arena.
8. Implementar tracker.
# Acompanhamento

## 2026-06-27 — Fronteira entre scout online e heatmap local

Decisão:

- O backend PHP online será tratado como hub futuro de dados.
- A ferramenta de heatmap será desenvolvida primeiro como app local Python offline-first.
- O MVP do heatmap não deve depender de API PHP, login, rede, banco online, upload remoto ou mock remoto obrigatório.
- A integração futura será planejada por contratos de dados, mas implementada somente depois do fluxo local funcionar.

Contratos conceituais reservados:

- `tournament_import`: dados de torneios, equipes e partidas vindos da API PHP.
- `heatmap_package`: pacote gerado localmente pelo Python com tracking, zonas, métricas e imagens.
- `simulation_package`: pacote futuro para consumo por simulador Unreal Engine.

Arquivos de contexto atualizados:

- `AGENTS.md` na raiz do repositório.
- `heatmap_project/robot_heatmap_agent_context/AGENTS.md`.
- `docs/integracao-futura-api-php.md`.
- `docs/roadmap.md`.
- `00_CONTEXT_MASTER.md`.
