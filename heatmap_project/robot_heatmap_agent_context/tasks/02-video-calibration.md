# Tarefa 02 — Video Calibration

## Objetivo

Criar ferramenta para calibrar um vídeo real da partida com base no YAML da arena.

## Comando desejado

```bash
python scripts/calibrate_video.py \
  --video videos/match_q12.mp4 \
  --field configs/fields/the_code.yaml \
  --output calibrations/match_q12.yaml
```

## Fluxo

1. Abrir o vídeo.
2. Ler o primeiro frame, ou permitir escolher um frame.
3. Carregar o `field.yaml`.
4. Ler os `reference_points`.
5. Para cada ponto de referência, pedir que o usuário clique no local correspondente no vídeo.
6. Calcular homografia.
7. Salvar `calibration.yaml`.

## Requisitos

- Mostrar nome/label do ponto a ser clicado.
- Permitir desfazer último clique.
- Permitir reiniciar.
- Salvar resolução do vídeo.
- Salvar frame usado.
- Salvar mapping vídeo -> arena.
- Permitir usar 4 pontos inicialmente.

## YAML de calibração esperado

```yaml
video:
  file: "videos/match_q12.mp4"
  frame_used: 0
  resolution:
    width: 1920
    height: 1080

field:
  config: "configs/fields/the_code.yaml"

reference_mapping:
  top_left:
    video_px: [412, 101]
    field: [0, 0]
  top_right:
    video_px: [1510, 98]
    field: [1000, 0]
  bottom_right:
    video_px: [1760, 863]
    field: [1000, 1000]
  bottom_left:
    video_px: [151, 870]
    field: [0, 1000]
```

## Teste associado

Criar script:

```bash
python scripts/test_video_to_field.py \
  --video videos/match_q12.mp4 \
  --field configs/fields/the_code.yaml \
  --calibration calibrations/match_q12.yaml
```

Ele deve permitir clicar em pontos do vídeo e ver esses pontos projetados na arena top-down.

## Critérios de aceite

- O usuário clica 4 pontos no vídeo.
- O script salva calibração.
- O script de teste mostra que um ponto clicado no vídeo aparece na posição correspondente da arena.
