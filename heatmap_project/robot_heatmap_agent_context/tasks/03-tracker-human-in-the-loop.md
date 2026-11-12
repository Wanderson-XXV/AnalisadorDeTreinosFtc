# Tarefa 03 — Tracker Human-in-the-loop

## Objetivo

Rastrear um robô específico em um vídeo de partida, projetando sua posição para a arena tática.

## Pré-requisitos

- `field.yaml` criado pelo Arena Configurator.
- `calibration.yaml` criado pela calibração do vídeo.

## Comando desejado

```bash
python scripts/track_robot.py \
  --video videos/match_q12.mp4 \
  --field configs/fields/the_code.yaml \
  --calibration calibrations/match_q12.yaml \
  --team 12345 \
  --alliance blue \
  --match Q12 \
  --event worlds_example \
  --output outputs/Q12_12345
```

## Fluxo

1. Abrir vídeo.
2. Carregar arena.
3. Carregar calibração.
4. Usuário seleciona ROI do robô.
5. Tracker acompanha o robô.
6. Sistema calcula centro da bounding box.
7. Centro é projetado para a arena via homografia.
8. Posição é salva em CSV.
9. Usuário pode pausar e reselecionar o robô.
10. Ao final, gerar trajetória e heatmap.

## Tracker inicial

Usar CSRT:

```python
cv2.TrackerCSRT_create()
```

Permitir no futuro:

- KCF;
- MOSSE;
- outros trackers.

## Teclas sugeridas

- `space`: pausa/continua;
- `r`: reselecionar robô;
- `s`: salvar estado atual;
- `q`: sair.

## CSV de saída

```csv
time_seconds,frame,x_video_px,y_video_px,x_field,y_field,unit,team,alliance,match,event,tracker_status
0.000,0,854.2,421.0,500.3,612.7,normalized,12345,blue,Q12,worlds_example,ok
```

## Critérios de aceite

- Seleciona ROI manualmente.
- Tracker acompanha o robô por pelo menos 30 segundos.
- Reseleção manual funciona.
- CSV salva coordenadas do vídeo e da arena.
- Trajetória é gerada.
- Heatmap é gerado.
