# Coordenadas e Calibracao — Documentacao tecnica

## Sistema de coordenadas

O campo logico normalizado usa um plano 1000x1000 com:

- Origem: canto superior esquerdo (0, 0)
- Eixo X: aponta para a direita (0 a 1000)
- Eixo Y: aponta para baixo (0 a 1000)

Tambem e possivel usar dimensoes reais em centimetros:

```yaml
field:
  unit: cm
  width: 365.76
  height: 365.76
```

Nesse caso, os pontos de zonas e referencias passam a representar centimetros dentro da arena.

## Conversao imagem -> campo normalizado

```
campo_x = round((img_x / img_largura) * field.width)
campo_y = round((img_y / img_altura) * field.height)
```

## Conversao campo normalizado -> imagem

```
img_x = int((campo_x / field.width) * img_largura)
img_y = int((campo_y / field.height) * img_altura)
```

No Arena Configurator atual, essa conversao presume que a imagem inteira representa a arena inteira. Se a foto tiver sobras ao redor do campo, recorte antes. Se tiver perspectiva, resolva na etapa de calibracao.

## Calibracao de video (Marco 2)

Na fase de Video Calibration, a conversao e feita via homografia:

1. O usuario clica em 4+ pontos de referencia visiveis no frame do video.
2. Os pontos correspondentes na arena ja estao salvos no YAML.
3. `cv2.findHomography` calcula a matriz de transformacao perspectiva.
4. `cv2.perspectiveTransform` converte posicoes do video para a arena.

Isso permite corrigir distorcoes de angulo de camera e posicao.

O video nao precisa mostrar a arena inteira. O calibrador percorre os pontos do
YAML da arena em ordem estavel; se um ponto estiver fora do enquadramento ou
coberto, pressione `n` para pular. A homografia pode ser calculada assim que
houver pelo menos 4 pontos usados.

Para cameras parciais de treino, cadastre pontos internos no Arena Configurator.
Bons pontos sao cruzamentos de tiles, vertices de linhas, centros de marcas ou
elementos fixos que aparecam tanto na imagem top-down quanto no video.

O YAML de calibracao registra:

- `calibration_mode: partial_reference_subset`;
- `reference_points` com apenas os pontos usados;
- `skipped_reference_points` com os pontos pulados;
- `used_reference_count` e `available_reference_count`.

## Exemplo de uso

```python
from robot_heatmap.coordinates import Coordinates

coords = Coordinates(img_width=1280, img_height=720)

campo_pt = coords.to_field(640, 360)
# => [500, 500]

img_pt = coords.to_image(500, 500)
# => (640, 360)
```
