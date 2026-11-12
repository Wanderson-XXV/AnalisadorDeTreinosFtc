# Acompanhamento — Robot Heatmap Scout

## Marco 1 — Arena Configurator

### Decisoes tomadas

**Sistema de coordenadas normalizado 1000x1000**

O campo logico usa coordenadas de 0 a 1000 em ambos os eixos, independente do tamanho da imagem da arena. Isso permite reutilizar o mesmo YAML de configuracao com imagens de diferentes resolucoes.

**Conversao de coordenadas**

A conversao entre coordenadas da imagem e do campo normalizado e feita por proporcao simples (linear). Nao ha correcao de perspectiva nesta fase. Essa correcao entrara na fase de Video Calibration com homografia.

**Separacao de modulos**

- `field_config.py` — leitura/escrita/validacao de YAML. Sem dependencia de OpenCV.
- `coordinates.py` — conversao de coordenadas. Sem dependencia de OpenCV.
- `zones.py` — validacao e normalizacao de zonas. Sem dependencia de OpenCV.
- `arena_editor.py` — toda a interacao visual com OpenCV.
- `scripts/arena_configurator.py` — entrypoint fino.

Essa separacao garante que os testes unitarios de YAML e coordenadas rodem sem necessidade de display ou OpenCV.

**Formato YAML**

O formato escolhido para o YAML segue a estrutura documentada no contexto do projeto. As zonas sao salvas como listas de pontos no espaco normalizado. Os pontos de referencia sao pontos unicos com id e label.

**Interface por teclas**

A interface usa teclas simples para trocar de modo (zona/ponto) e acoes (salvar/sair/desfazer). O input de ID e label de zonas/pontos e feito no terminal para evitar complexidade de UI no OpenCV nesta fase.

**Sem integracao online**

Nenhuma dependencia de rede, API PHP, login ou banco remoto foi adicionada neste marco.

### Status

- [x] Estrutura de pastas criada
- [x] `field_config.py` — criar, carregar, salvar, validar YAML
- [x] `coordinates.py` — conversao imagem <-> campo normalizado
- [x] `zones.py` — validacao e normalizacao de poligonos
- [x] `arena_editor.py` — editor visual OpenCV com modos zona/ponto
- [x] `scripts/arena_configurator.py` — entrypoint com --image e --output
- [x] `configs/fields/field_example.normalized.yaml` — exemplo de YAML
- [x] `tests/test_field_config.py` — testes de YAML
- [x] `tests/test_coordinates.py` — testes de coordenadas e zonas
- [x] `README.md` — instrucoes de instalacao e uso
- [x] `AGENTS.md` — regras para agentes

### Proximo passo

Marco 2 — Video Calibration.

Objetivo: calibrar um frame de video para a arena configurada usando pontos de referencia e homografia (cv2.findHomography).

## Marco 2 - Video Calibration

### Status

- [x] Abrir video e escolher frame util.
- [x] Clicar em pontos de referencia visiveis.
- [x] Pular pontos invisiveis com `n`.
- [x] Calcular homografia com `cv2.findHomography`.
- [x] Salvar `calibration.yaml`.
- [x] Registrar pontos usados, pontos pulados e qualidade da calibracao.
- [x] Testar clique no video -> ponto na arena.

### Decisoes tomadas

**Calibracao por subconjunto visivel**

O video nao precisa mostrar a arena inteira. O calibrador usa os pontos de
referencia disponiveis no YAML e permite pular os que nao aparecem no video.
A homografia e calculada quando houver pelo menos 4 pontos usados.

**Arquivo local de calibracao**

A calibracao fica em `calibrations/*.yaml` e guarda video, frame inicial, FPS,
campo usado, pontos de referencia e matriz de homografia `video_to_field`.

## Marco 3 - Tracker Human-in-the-loop

### Status

- [x] `src/robot_heatmap/tracking.py` - registros de posicao, CSV e fabrica CSRT/KCF.
- [x] `scripts/track_robot.py` - entrypoint OpenCV para selecionar ROI e rastrear.
- [x] `run_track_robot.ps1` e `track_robot.cmd` - atalhos Windows.
- [x] Conversao do centro da bounding box para coordenadas da arena via homografia.
- [x] Exportacao de `outputs/analyses/<calibracao>/positions.csv`.
- [x] Tracker Lab com `tracker_events.csv`, `tracker_metrics.json`, `review.html` e `lab_index.csv`.
- [ ] Exportacao de `trajectory.png`.

### Decisoes tomadas

**Centro da bounding box como posicao do robo**

O primeiro corte registra o centro da ROI rastreada. Essa escolha e simples,
testavel e suficiente para gerar trajetoria inicial e heatmap depois.

**CSV como contrato local**

O `positions.csv` exporta:

```text
frame,time_seconds,video_x,video_y,field_x,field_y,bbox_x,bbox_y,bbox_w,bbox_h,tracking_ok
```

Quando o tracker perde o robo, a linha e mantida com `tracking_ok=false` e
coordenadas vazias. Isso preserva a linha do tempo e facilita diagnostico.

**Metricas de laboratorio**

O Tracker Lab mede `corrections_per_minute`, `tracking_ok_percent`,
`roi_reselections`, `tracking_lost_count` e
`longest_segment_without_reselect_seconds`. A metrica principal para decidir se
o tracking esta ficando usavel e quantas reselecoes manuais por minuto foram
necessarias.

**Review HTML offline**

Cada analise pode gerar `review.html` com video, arena, trajetoria, eventos de
perda/reselecao e metricas. Esse review nao depende de scout, API, client web ou
internet.

### Proximo passo

Marco 4 - Visualizacoes e metricas.

Objetivo: gerar `trajectory.png`, `heatmap.png` e metricas por zona a partir de
`positions.csv`.
