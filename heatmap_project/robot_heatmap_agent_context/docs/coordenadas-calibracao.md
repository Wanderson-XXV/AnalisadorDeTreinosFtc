# Coordenadas e calibração

## 1. Sistemas de coordenadas

O projeto terá pelo menos três sistemas de coordenadas.

### 1.1 Coordenadas da imagem da arena

São pixels da imagem top-down usada no Arena Configurator.

Exemplo:

```text
x_image_px = 960
y_image_px = 540
```

### 1.2 Coordenadas lógicas da arena

São as coordenadas usadas no YAML da arena.

No MVP:

```yaml
unit: "normalized"
width: 1000
height: 1000
```

Exemplo:

```text
x_field = 500
y_field = 500
```

No futuro:

```yaml
unit: "cm"
width: 365.76
height: 365.76
```

Exemplo:

```text
x_field = 183.2 cm
y_field = 183.2 cm
```

### 1.3 Coordenadas do vídeo

São pixels do frame do vídeo original.

Exemplo:

```text
x_video_px = 854
y_video_px = 421
```

## 2. Origem e eixos

Padrão do MVP:

```text
(0,0) ----------> X
  |
  |
  v
  Y
```

Origem:

- canto superior esquerdo.

Eixos:

- X cresce para a direita;
- Y cresce para baixo.

Esse padrão é intencional porque combina com imagens e OpenCV.

## 3. Imagem top-down -> arena lógica

Se a imagem da arena está recortada exatamente no campo inteiro:

```python
x_field = x_image_px / image_width_px * field_width
y_field = y_image_px / image_height_px * field_height
```

Isso permite desenhar zonas clicando na imagem, mas salvando em coordenadas lógicas.

## 4. Vídeo -> arena lógica

Para transformar pontos do vídeo real para a arena lógica, usar homografia.

O usuário marca no vídeo os mesmos pontos de referência já existentes no YAML da arena.

Exemplo:

No YAML:

```yaml
reference_points:
  top_left:
    point: [0, 0]
  top_right:
    point: [1000, 0]
  bottom_right:
    point: [1000, 1000]
  bottom_left:
    point: [0, 1000]
```

No vídeo, o usuário clica onde esses pontos aparecem no frame.

Isso gera:

```python
src_points = [
    [x_video_top_left, y_video_top_left],
    [x_video_top_right, y_video_top_right],
    [x_video_bottom_right, y_video_bottom_right],
    [x_video_bottom_left, y_video_bottom_left],
]

dst_points = [
    [0, 0],
    [1000, 0],
    [1000, 1000],
    [0, 1000],
]
```

Então:

```python
H = cv2.getPerspectiveTransform(src_points, dst_points)
```

Depois, qualquer ponto do vídeo pode ser projetado:

```python
point_field = cv2.perspectiveTransform(point_video, H)
```

## 5. Por que usar pontos de referência

Os pontos de referência ligam a arena tática ao vídeo real.

A ideia é:

> “Este canto/elemento no vídeo corresponde a este canto/elemento no mapa top-down.”

Com quatro pontos, já dá para calcular homografia.

No futuro, com mais pontos, é possível validar erro ou usar técnicas mais robustas.

## 6. Teste visual obrigatório

Antes do tracker, implementar um teste:

```bash
python scripts/test_video_to_field.py \
  --video videos/match_q12.mp4 \
  --field configs/fields/the_code.yaml \
  --calibration calibrations/match_q12.yaml
```

Fluxo:

1. mostra frame do vídeo;
2. mostra arena top-down;
3. usuário clica em um ponto no vídeo;
4. o ponto aparece na arena;
5. usuário valida se a tradução parece correta.

Esse teste é essencial para saber se a calibração está boa antes de rastrear robô.

## 7. Calibração salva

Arquivo sugerido:

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

## 8. Medidas reais depois

O MVP deve começar com `normalized`.

Quando as dimensões oficiais estiverem confiáveis, basta trocar a arena para `cm`.

A lógica de homografia continua igual.

A diferença é que o destino deixa de ser:

```python
[0, 0], [1000, 0], [1000, 1000], [0, 1000]
```

e passa a ser:

```python
[0, 0], [width_cm, 0], [width_cm, height_cm], [0, height_cm]
```
