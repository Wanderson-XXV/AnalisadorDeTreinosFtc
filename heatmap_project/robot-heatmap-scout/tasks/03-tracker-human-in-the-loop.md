# Tarefa 03 — Tracker Human-in-the-loop

## Status: CONCLUIDO PARCIAL

## Objetivo

Rastrear um robo no video com auxilio humano, convertendo a posicao para coordenadas da arena.

## Dependencia

Requer Video Calibration concluido (Tarefa 02).

## Requisitos funcionais

- [x] Abrir video a partir do YAML de calibracao.
- [x] Selecionar robo no frame inicial (cv2.selectROI).
- [x] Rastrear usando CSRT ou KCF do OpenCV.
- [x] Permitir pausar com `Space`.
- [x] Permitir reselecionar com tecla `R`.
- [x] Converter posicao do tracker para coordenadas da arena via homografia.
- [x] Mostrar posicao em tempo real na arena (top-down).
- [x] Salvar posicoes em CSV.
- [x] Salvar eventos de tracking em CSV.
- [x] Salvar metricas de qualidade em JSON.
- [x] Gerar review HTML local.
- [x] Rodar em velocidade configuravel (`1`, `2`, `4`, `8`, `max`).
- [ ] Exportar trajetoria como imagem PNG.

## Decisao de escopo

O primeiro corte do tracker entregou o fluxo principal: selecionar um robo,
rastrear, projetar via homografia e salvar `positions.csv`.

O corte Tracker Lab transforma esse fluxo em laboratorio de videos do mundial:
processa em velocidade configuravel, registra reselecoes/perdas, gera metricas
e cria `review.html` para revisar a trajetoria e os pontos problematicos.

A exportacao de `trajectory.png` fica para o proximo passo de visualizacoes,
usando o CSV como entrada.

## Saida esperada

```
outputs/analyses/match_q12_team_16049/
  positions.csv
  trajectory.png
```

No corte atual, a saida padrao e:

```
outputs/analyses/<nome_da_analise>/
  positions.csv
  tracker_events.csv
  tracker_metrics.json
  review.html
```

## Proximo passo apos esta tarefa

Tarefa 04 — Visualizacoes e metricas (heatmap, tempo por zona).
