# Tactical Replay Vertical Slice Design

## Contexto

O `robot-heatmap-scout` ja tem Arena Configurator, Video Calibration e Tracker Human-in-the-loop. O tracker exporta `positions.csv`, `tracker_events.csv`, `tracker_metrics.json` e um `review.html`, mas o review atual ainda se comporta como tela de laboratorio/debug.

Esta atualizacao transforma o review em um primeiro Tactical Replay Visual offline-first. A tela deve ajudar tecnico, driver e alunos a revisar movimento, zonas, paradas e fluxo do robo sem depender da API PHP, banco online, login, upload remoto ou framework frontend pesado.

Decisao visual aprovada: layout **A - Coach Replay balanceado**. Video original e arena top-down devem ter peso parecido, com timeline visual como navegacao principal.

## Escopo aprovado

Este primeiro corte segue o vertical slice aprovado: entregar uma fatia testavel do Tactical Replay antes de completar todos os detalhes do PRD.

Fazer agora:

- Aceitar YAML novo com semantica de zonas.
- Manter YAML antigo funcionando por normalizacao em memoria.
- Atualizar manualmente `configs/fields/decode.yaml` com roles basicos.
- Gerar `analysis.json` dentro da pasta da analise.
- Usar `analysis.json` como fonte do `review.html`.
- Renderizar layout Coach Replay balanceado.
- Mostrar video, arena, zonas, robo, trilha recente, timeline clicavel e painel de estado.
- Detectar zona atual, velocidade, estado `moving/stopped/unknown`, segmentos e paradas simples.

Nao fazer agora:

- Alterar o Arena Configurator para editar role/alliance/visual/analysis.
- Criar migrador automatico de YAML.
- Integrar com API PHP, client web, banco, login ou upload.
- Implementar IA, score automatico, coleta automatica ou multiplos robos.
- Trocar para React/Vite/Next ou outro framework frontend.

## YAML semantico

O carregamento de zonas deve aceitar dois formatos.

Formato antigo atual:

```yaml
zones:
  close_zone:
    label: close zone
    type: polygon
    points:
      - [183, 183]
      - [2, 2]
      - [364, 2]
```

Formato novo aceito:

```yaml
zones:
  close_zone:
    label: Close Zone
    type: polygon
    role: score
    alliance: neutral
    points:
      - [183, 183]
      - [2, 2]
      - [364, 2]
    visual:
      color: score
      opacity: 0.18
      border: true
      label: true
    analysis:
      count_time: true
      detect_stops: true
      important: true
```

Defaults em memoria para zonas antigas:

```yaml
role: unknown
alliance: neutral
visual:
  color: neutral
  opacity: 0.14
  border: true
  label: true
analysis:
  count_time: true
  detect_stops: true
  important: false
```

Roles aceitos no primeiro corte:

- `collect`
- `score`
- `transit`
- `base`
- `traffic`
- `risk`
- `neutral`
- `unknown`

Alliances aceitas:

- `red`
- `blue`
- `neutral`

Se um valor desconhecido aparecer, o sistema deve cair para `unknown` ou `neutral` sem quebrar o review.

## Analysis JSON

`analysis.json` deve ser gerado ao reconstruir ou salvar o review.

Entradas:

- `positions.csv`
- `tracker_events.csv`
- `tracker_metrics.json`
- `field.yaml` referenciado em `tracker_metrics.json`

Saida:

```text
outputs/analyses/<nome>/analysis.json
```

Estrutura minima:

```json
{
  "metadata": {
    "analysis_name": "teste_robo",
    "video_path": "../../../videos/teste_robo.mp4",
    "field_path": "../../../configs/fields/decode.yaml",
    "arena_image": "../../../assets/arenas/decode_hd_2.png",
    "duration_seconds": 13.936,
    "tracking_ok_percent": 100.0
  },
  "field": {
    "width": 365.76,
    "height": 365.76,
    "units": "cm",
    "image": "../../../assets/arenas/decode_hd_2.png"
  },
  "zones": [],
  "positions": [],
  "segments": [],
  "stops": [],
  "events": [],
  "summary": {}
}
```

`positions` deve conter pelo menos:

- `frame`
- `t`
- `video_x`
- `video_y`
- `field_x`
- `field_y`
- `bbox`
- `tracking_ok`
- `zone_id`
- `zone_role`
- `speed_cm_s`
- `state`

`segments` deve agrupar trechos consecutivos por zona, role e estado.

`stops` deve listar paradas com inicio, fim, duracao, zona, role e posicao media.

`events` deve juntar eventos tecnicos do tracker e eventos analiticos simples, com `category` igual a `tracker` ou `analysis`.

## Analise

### Zone assignment

Para cada posicao com `tracking_ok=true` e coordenadas validas:

1. Testar `field_x`, `field_y` contra cada poligono de zona.
2. Se cair em uma zona, preencher `zone_id` e `zone_role`.
3. Se cair em varias zonas, escolher a primeira por ordem do YAML neste corte.
4. Se nao cair em nenhuma, usar `zone_id=null` e `zone_role=unknown`.

Esta regra e simples de explicar e suficiente para o vertical slice. Prioridade explicita por zona pode entrar depois.

### Velocidade

Calcular velocidade em unidades do campo por segundo. Para campos em `cm`, isso equivale a `cm/s`.

Regra:

- ignorar frames sem tracking para calculo entre pontos;
- usar distancia euclidiana entre a posicao atual e a anterior valida;
- dividir por delta de tempo;
- aplicar media movel simples de 5 amostras validas.

### Estado de movimento

Estados:

- `moving`
- `stopped`
- `unknown`

Constantes iniciais:

```python
STOP_SPEED_THRESHOLD = 8.0
STOP_MIN_DURATION = 1.0
MIN_SEGMENT_DURATION = 0.35
```

Se a velocidade suavizada ficar abaixo do threshold por pelo menos `STOP_MIN_DURATION`, marcar o intervalo como `stopped`. Frames sem tracking ficam `unknown`.

### Segmentos e paradas

Segmentos agrupam frames consecutivos por:

- `zone_id`
- `zone_role`
- `state`

Segmentos menores que `MIN_SEGMENT_DURATION` podem ser mesclados ao vizinho mais longo quando isso reduzir ruido visual.

Stops sao segmentos `stopped` com duracao maior ou igual a `STOP_MIN_DURATION`.

## Review HTML

O review deve continuar sendo um arquivo HTML local e autocontido o suficiente para abrir sem servidor de aplicacao.

Layout:

- Header com nome da analise e metricas principais.
- Coluna esquerda com video original.
- Coluna direita com arena top-down em canvas.
- Timeline visual abaixo de video/arena.
- Painel inferior com tempo, zona, role, estado, velocidade e parada atual.

Arena:

- desenhar imagem da arena;
- desenhar zonas com cor semantica;
- destacar zona atual;
- mostrar trilha recente por padrao;
- controles de trilha: `5s`, `15s`, `Completa`;
- desenhar robo com circulo visivel, contorno e ponto central;
- desenhar marcadores `P1`, `P2`, `P3` para paradas.

Timeline:

- renderizar segmentos com largura proporcional a duracao;
- colorir por role;
- destacar `stopped` com padrao visual diferenciado;
- hover com tempo, zona/role, duracao e velocidade media quando disponivel;
- clique em segmento muda `video.currentTime` para o inicio do segmento.

Debug:

- modo padrao e Review.
- eventos tecnicos, bbox, coordenadas brutas e frame atual ficam atras de um toggle de debug.
- este toggle pode ser simples no primeiro corte; nao deve dominar a tela.

## Modulos e arquivos

Modificar:

- `src/robot_heatmap/zones.py`
  - normalizar zonas antigas e novas;
  - validar roles/alliance;
  - expor poligonos em uma lista canonica.

- `src/robot_heatmap/field_config.py`
  - manter leitura YAML atual;
  - nao reescrever arquivo automaticamente;
  - fornecer acesso ao campo e zonas normalizadas quando necessario.

- `src/robot_heatmap/tracker_review.py`
  - passar a gerar `analysis.json`;
  - renderizar HTML a partir de `analysis.json`;
  - manter compatibilidade do entrypoint existente.

- `scripts/build_tracker_review.py`
  - continuar aceitando `--analysis-dir`;
  - opcionalmente aceitar `--field` se o metrics nao tiver `field_path`.

- `configs/fields/decode.yaml`
  - adicionar roles/alliance/visual/analysis manualmente para zonas atuais.

Criar:

- `src/robot_heatmap/tactical_analysis.py`
  - carregar CSV/JSON/YAML;
  - atribuir zonas;
  - calcular velocidade, estado, segmentos e stops;
  - salvar `analysis.json`.

- `tests/test_tactical_analysis.py`
  - cobrir normalizacao, point-in-polygon, velocidade, estado, segmentos e stops.

Atualizar:

- `tests/test_tracker_review.py`
  - verificar que `analysis.json` e `review.html` sao gerados;
  - verificar presenca de timeline, canvas, modo debug e dados do analysis no HTML.

## Testes e verificacao

Comandos esperados:

```powershell
python -m pytest
python scripts/build_tracker_review.py --analysis-dir outputs/analyses/teste_robo
```

Verificacao manual:

- abrir `outputs/analyses/teste_robo/review.html`;
- dar play no video;
- confirmar que o robo se move na arena;
- clicar em segmento da timeline e confirmar que o video pula;
- alternar trilha `5s`, `15s`, `Completa`;
- confirmar que zona atual, velocidade e estado mudam no painel.

## Riscos e decisoes

- Como o YAML atual usa origem `top_left` e eixo Y para baixo, o review deve respeitar as dimensoes do campo e nao assumir origem `bottom_left`.
- Se zonas se sobrepuserem, a primeira zona no YAML vence neste corte.
- Velocidade em campos `normalized` nao e `cm/s`; o painel deve mostrar a unidade do campo ou tratar como unidade/s.
- O configurador fica fora do escopo para manter o corte pequeno e testavel.
- A API PHP e o client web permanecem intocados.

## Criterios de aceite

- YAML antigo continua abrindo sem erro.
- `decode.yaml` pode receber roles manuais.
- `analysis.json` e gerado em `outputs/analyses/<nome>/`.
- `review.html` usa layout Coach Replay balanceado.
- Timeline e clicavel.
- Trilha recente e padrao.
- Zonas, zona atual, robo e paradas aparecem na arena.
- Testes automatizados cobrem o contrato de analise.
- O fluxo continua offline-first.
