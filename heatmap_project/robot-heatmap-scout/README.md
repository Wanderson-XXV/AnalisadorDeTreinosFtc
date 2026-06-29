# robot-heatmap-scout

Ferramenta local, offline-first, para transformar videos de partidas FTC em dados espaciais: posicao do robo, trajetoria, heatmap e tempo por zona.

O projeto ainda esta no comeco. Hoje ele cobre:

1. **Arena Configurator**: cria o mapa top-down da arena.
2. **Video Calibrator**: liga um video real a esse mapa usando pontos de referencia.
3. **Tracker Lab**: seleciona um robo manualmente, exporta posicoes, eventos, metricas e review HTML.
4. **Tactical Replay Visual**: gera `analysis.json` e um `review.html` para revisar rota, zonas, velocidade, estado de movimento e paradas.

Ainda nao cobre tracking automatico sem intervencao humana, deteccao automatica de score/coleta, dashboard web ou integracao com a API PHP.

## Ideia em uma frase

Voce primeiro ensina ao sistema "como e a arena vista de cima". Depois, em cada video, voce ensina "como essa arena aparece nesse angulo de camera".

Depois disso, o sistema consegue converter um ponto clicado no video para uma coordenada real da arena.

## Atalhos rapidos no Windows

Na raiz deste projeto, use os arquivos `.cmd` para nao precisar lembrar os
comandos Python completos:

```powershell
.\arena_configurator.cmd
.\video_calibration.cmd
.\track_robot.cmd
.\tests.cmd
```

O `arena_configurator.cmd` abre `configs/fields/decode.yaml` se ele ja existir.
Esse e o caminho mais rapido para reconfigurar a arena e adicionar mais pontos
de referencia.

O `video_calibration.cmd` usa por padrao:

```text
Video: ..\robot_heatmap_agent_context\videos\v1.mp4
Arena: configs\fields\decode.yaml
Saida: calibrations\decode_v1.yaml
```

O `track_robot.cmd` usa por padrao:

```text
Calibracao: calibrations\decode_v1.yaml
Saida: outputs\analyses\decode_v1\
Tracker: CSRT
Velocidade: 4x
```

Se quiser passar outro arquivo, use os parametros dos scripts PowerShell:

```powershell
.\run_arena_configurator.ps1 -Field configs/fields/treino_sala.yaml -Image assets/arenas/decode_hd_2.png -New
.\run_video_calibration.ps1 -Video videos/treino_sala.mp4 -Field configs/fields/treino_sala.yaml -Output calibrations/treino_sala.yaml
.\run_track_robot.ps1 -Calibration calibrations/treino_sala.yaml -Video videos/treino_sala.mp4 -AnalysisDir outputs/analyses/treino_sala -Speed 4
```

## Fluxo completo de uso

Este e o fluxo recomendado para sair de uma arena/imagem e chegar em um replay
tatico local. Tudo roda offline e salva artefatos em arquivos locais.

### 0. Preparar ambiente

Entre na pasta do projeto:

```powershell
cd heatmap_project\robot-heatmap-scout
```

Instale as dependencias:

```powershell
pip install -r requirements.txt
```

Confira se o ambiente esta saudavel:

```powershell
python -m pytest
```

No Windows, tambem pode usar:

```powershell
.\tests.cmd
```

### 1. Ter uma imagem top-down da arena

A imagem deve representar a area util da arena inteira. Se tiver borda, plateia, margem ou sobras, recorte antes.

Exemplo atual:

```text
assets/arenas/decode_hd_2.png
```

### 2. Criar ou editar o YAML da arena

O YAML da arena guarda:

- imagem top-down usada;
- unidade e tamanho real do campo;
- zonas desenhadas;
- pontos de referencia conhecidos.

Exemplo atual:

```text
configs/fields/decode.yaml
```

Para abrir o configurador usando a arena atual:

```bash
python scripts/arena_configurator.py --output configs/fields/decode.yaml --load configs/fields/decode.yaml
```

Para criar uma arena nova em centimetros:

```bash
python scripts/arena_configurator.py \
  --image assets/arenas/decode_hd_2.png \
  --output configs/fields/decode.yaml \
  --unit cm \
  --field-width 365.76 \
  --field-height 365.76
```

Um campo FTC padrao tem `365.76 cm x 365.76 cm`.

### 3. Revisar a semantica das zonas

O Tactical Replay usa a geometria das zonas e tambem o significado delas.
O `configs/fields/decode.yaml` atual ja possui exemplos de semantica:

```yaml
zones:
  red_loading_zone:
    label: red loading zone
    type: polygon
    role: collect
    alliance: red
    visual:
      color: collect
      opacity: 0.18
      border: true
      label: true
    analysis:
      count_time: true
      detect_stops: true
      important: true
    points:
      - [2, 308]
      - [59, 308]
      - [58, 362]
      - [0, 362]
```

Campos importantes:

- `role`: `collect`, `score`, `transit`, `base`, `traffic`, `risk`, `neutral` ou `unknown`.
- `alliance`: `red`, `blue` ou `neutral`.
- `visual`: controla cor, opacidade, borda e label no replay.
- `analysis`: controla se a zona conta tempo, detecta paradas e recebe destaque.

YAMLs antigos continuam funcionando. Se uma zona nao tiver esses campos, o
sistema usa defaults em memoria e trata a zona como `role: unknown`.

Nesta etapa, o Arena Configurator ainda nao edita esses campos. Para ajustar o
significado tatico de uma zona, edite o YAML manualmente.

### 4. Calibrar um video real

Calibrar significa escolher um frame bom do video e clicar em pontos conhecidos da arena.

Comando para o video de teste atual:

```bash
python scripts/calibrate_video.py \
  --video ../robot_heatmap_agent_context/videos/v1.mp4 \
  --field configs/fields/decode.yaml \
  --output calibrations/decode_v1.yaml
```

Durante a ferramenta:

1. escolha um frame em que a arena aparece bem;
2. pressione `Enter`;
3. clique no video nos pontos pedidos;
4. se um ponto nao estiver visivel, pressione `n` para pular;
5. use pelo menos 4 pontos visiveis e bem espalhados;
6. pressione `Enter` para calcular a homografia;
7. clique no video para testar se o ponto cai no lugar certo no mapa;
8. pressione `s` para salvar.

A arena inteira nao precisa aparecer no video. Para treino com camera parcial,
cadastre no Arena Configurator varios pontos internos da arena que aparecem bem
na sala, como cruzamentos de tiles, marcas fixas e vertices de linhas. Na
calibracao, clique apenas nos pontos visiveis e pule os pontos cobertos ou fora
do enquadramento.

O YAML de calibracao salva somente os pontos usados e tambem registra os pontos
pulados em `skipped_reference_points`.

O resultado fica em:

```text
calibrations/decode_v1.yaml
outputs/calibration_checks/decode_v1_check.png
```

### 5. Rastrear um robo e gerar um pacote de analise

Depois de calibrar o video, rode:

```bash
python scripts/track_robot.py --calibration calibrations/decode_v1.yaml --speed 4
```

Ou, no Windows:

```powershell
.\track_robot.cmd
```

Durante a ferramenta:

1. selecione a caixa do robo no frame inicial;
2. pressione `Space` para pausar ou continuar;
3. pressione `r` para reselecionar o robo se o tracker se perder;
4. pressione `q` para salvar e sair.

O pacote padrao fica em:

```text
outputs/analyses/decode_v1/
  positions.csv
  tracker_events.csv
  tracker_metrics.json
  analysis.json
  review.html
```

O `positions.csv` exporta:

```text
frame,time_seconds,video_x,video_y,field_x,field_y,bbox_x,bbox_y,bbox_w,bbox_h,tracking_ok
```

O `tracker_events.csv` registra eventos como:

```text
roi_selected,roi_reselected,tracking_lost,paused,finished
```

O `tracker_metrics.json` resume a qualidade do teste com `tracking_ok_percent`,
`corrections_per_minute`, `roi_reselections`, `tracking_lost_count` e
`longest_segment_without_reselect_seconds`.

O `analysis.json` e gerado a partir de `positions.csv`, `tracker_events.csv`,
`tracker_metrics.json` e `field.yaml`. Ele adiciona:

- zona atual por posicao;
- role da zona;
- velocidade;
- estado `moving`, `stopped` ou `unknown`;
- segmentos para a timeline;
- paradas detectadas;
- resumo de distancia, tempo parado e tempo por role.

### 6. Abrir ou reconstruir o Tactical Replay

O tracking ja tenta gerar o `review.html` automaticamente. Para reconstruir o
review HTML a partir de um pacote existente:

```bash
python scripts/build_tracker_review.py --analysis-dir outputs/analyses/decode_v1
```

Se `tracker_metrics.json` nao tiver `field_path`, informe o YAML manualmente:

```bash
python scripts/build_tracker_review.py \
  --analysis-dir outputs/analyses/decode_v1 \
  --field configs/fields/decode.yaml
```

Abra o arquivo gerado:

```text
outputs/analyses/decode_v1/review.html
```

No replay:

1. de play no video;
2. confira o robo andando na arena top-down;
3. use `5s`, `15s` ou `Completa` para controlar a trilha;
4. clique em segmentos da timeline para voltar a trechos importantes;
5. observe o painel de tempo, zona atual, role, estado e velocidade;
6. ative `Modo Debug` apenas quando precisar ver dados tecnicos do tracker.

O objetivo do replay nao e afirmar causa automaticamente. Use a tela para
responder perguntas de treino:

- por onde o robo passou?
- quando entrou em zona de coleta ou score?
- onde ficou parado?
- quanto tempo pareceu perder?
- a rota visual bate com o video bruto?

### 7. Validar e repetir

Depois de revisar um treino:

1. se a arena estiver errada, volte ao Arena Configurator;
2. se a projecao video -> arena estiver ruim, refaca a calibracao;
3. se o tracking perdeu o robo, rode novamente e use `r` para reselecionar;
4. se uma zona estiver com significado errado, ajuste `role`, `alliance`,
   `visual` ou `analysis` no YAML;
5. reconstrua o review com `python scripts/build_tracker_review.py --analysis-dir ...`.

O fluxo normal de iteracao e:

```text
field.yaml
+ calibration.yaml
+ video
    ->
track_robot.py
    ->
positions.csv + tracker_events.csv + tracker_metrics.json
    ->
analysis.json
    ->
review.html
```

## O que sao os pontos de referencia?

Pontos de referencia sao lugares da arena que voce consegue identificar tanto:

- no mapa top-down;
- quanto no video real.

Eles nao precisam ser obrigatoriamente os quatro cantos externos. A homografia precisa de pelo menos 4 pontos, mas podem ser outros pontos fixos e bem espalhados.

Exemplos bons:

- cantos visiveis da arena;
- cruzamentos de linhas dos tiles;
- vertices de linhas brancas;
- centro da arena;
- pontos fixos dos elementos de campo;
- marcas internas que aparecem claramente no video.

Se os goals cobrirem os cantos superiores, use pontos internos mais visiveis. O ideal futuro e ter mais de 4 pontos cadastrados no `decode.yaml` e clicar somente nos que aparecem bem no video.

## Teclas do Arena Configurator

| Tecla | Acao |
|---|---|
| `z` | Iniciar nova zona |
| `p` | Iniciar novo ponto de referencia |
| `u` | Desfazer ultimo ponto |
| `Enter` | Finalizar poligono ou ponto atual |
| `s` | Salvar YAML |
| `r` | Resetar desenho atual |
| `h` | Mostrar ajuda |
| `q` | Sair |

## Teclas do Video Calibrator

### Escolher frame

| Tecla | Acao |
|---|---|
| `Space` | Play/pause |
| `d` | Avancar 1 frame |
| `a` | Voltar 1 frame |
| `D` | Avancar cerca de 1 segundo |
| `A` | Voltar cerca de 1 segundo |
| `Enter` | Usar frame atual |
| `q` | Sair |

### Clicar pontos

| Tecla | Acao |
|---|---|
| Clique no video | Marcar ponto pedido |
| `n` | Pular ponto invisivel |
| `u` | Desfazer ultimo ponto |
| `r` | Reiniciar cliques e pontos pulados |
| `Enter` | Calcular homografia quando houver 4+ pontos usados |
| `q` | Sair |

### Validar

| Tecla | Acao |
|---|---|
| Clique no video | Projetar ponto na arena |
| `r` | Refazer cliques |
| `s` | Salvar calibracao |
| `q` | Sair sem salvar |

## Estrutura de pastas

```text
robot-heatmap-scout/
  assets/arenas/       imagens top-down da arena
  configs/fields/      YAMLs da arena
  calibrations/        YAMLs de calibracao de video
  videos/              videos locais de partidas
  outputs/             imagens de verificacao e futuros heatmaps
  scripts/             comandos principais
  src/robot_heatmap/   codigo da ferramenta
  tests/               testes unitarios
  docs/                documentacao tecnica
```

## Instalar dependencias

```bash
pip install -r requirements.txt
```

## Rodar testes

```bash
python -m pytest
```

## O que vem depois

Proximos marcos:

1. testar varios videos do mundial e comparar metricas no `lab_index.csv`;
2. melhorar tracking onde houver muitas reselecoes;
3. transformar trajetoria em eventos/ciclos sugeridos;
4. futuramente enviar resultados para a API PHP.
