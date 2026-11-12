# Arena Configurator

## Objetivo

Criar uma ferramenta para configurar uma arena a partir de uma imagem top-down.

A ferramenta deve permitir que o usuário desenhe manualmente zonas e pontos de referência, exportando tudo em YAML.

## Por que essa ferramenta vem primeiro

O tracker depende da arena.

Sem arena configurada, o rastreamento gera apenas pontos em pixels. Com a arena configurada, o rastreamento gera informações táticas.

Exemplo:

- sem arena: `x=854px, y=421px`;
- com arena: `robô está na zona grande, perto do centro, em x=610, y=740`.

## Entrada

Uma imagem top-down da arena.

Exemplos:

- PNG exportado do manual;
- print recortado da arena;
- render top-down;
- imagem exportada de CAD;
- desenho feito manualmente.

Idealmente, a imagem deve estar recortada apenas na arena, sem legenda, bordas externas ou excesso de margem.

## Saída

Arquivo YAML:

```text
configs/fields/the_code.yaml
```

## Campo normalizado

No MVP, usar:

```yaml
field:
  unit: "normalized"
  width: 1000
  height: 1000
```

Isso evita depender das medidas oficiais no primeiro momento.

Depois, o mesmo formato poderá usar centímetros reais:

```yaml
field:
  unit: "cm"
  width: 365.76
  height: 365.76
```

## Conversão imagem -> arena

Se a imagem está recortada exatamente na arena inteira:

```python
x_field = x_pixel / image_width * field_width
y_field = y_pixel / image_height * field_height
```

Exemplo:

- imagem: 1920 x 1080 px;
- campo: 1000 x 1000;
- clique: 960, 540.

Resultado:

```text
x_field = 500
y_field = 500
```

## Recursos mínimos da ferramenta

### 1. Carregar imagem

Comando desejado:

```bash
python scripts/arena_configurator.py \
  --image assets/arenas/the_code_topdown.png \
  --output configs/fields/the_code.yaml
```

### 2. Criar zona

Fluxo:

1. usuário escolhe criar zona;
2. informa ID e label;
3. clica nos pontos do polígono;
4. pressiona Enter para finalizar;
5. zona aparece desenhada na tela.

### 3. Criar ponto de referência

Fluxo:

1. usuário escolhe criar referência;
2. informa ID e label;
3. clica no ponto;
4. ponto aparece desenhado na tela.

### 4. Salvar YAML

Salvar:

- metadados do campo;
- caminho da imagem;
- dimensões lógicas;
- sistema de coordenadas;
- zonas;
- pontos de referência.

### 5. Reabrir YAML

O script deve conseguir carregar o YAML salvo e redesenhar as zonas/pontos na imagem.

## Teclas sugeridas

- `z`: criar nova zona;
- `p`: criar ponto de referência;
- `u`: desfazer último ponto durante desenho;
- `enter`: finalizar polígono;
- `s`: salvar;
- `q`: sair;
- `r`: resetar desenho atual;
- `h`: mostrar ajuda.

## YAML sugerido

```yaml
field:
  id: "the_code_example"
  name: "The Code - Arena exemplo"
  image: "assets/arenas/the_code_topdown.png"
  unit: "normalized"
  width: 1000
  height: 1000
  coordinate_system:
    origin: "top_left"
    x_axis: "right"
    y_axis: "down"

reference_points:
  top_left:
    label: "Canto superior esquerdo"
    point: [0, 0]
  top_right:
    label: "Canto superior direito"
    point: [1000, 0]
  bottom_right:
    label: "Canto inferior direito"
    point: [1000, 1000]
  bottom_left:
    label: "Canto inferior esquerdo"
    point: [0, 1000]

zones:
  center:
    label: "Centro"
    type: "polygon"
    points:
      - [400, 400]
      - [600, 400]
      - [600, 600]
      - [400, 600]
```

## Critérios de aceite

- Abre imagem.
- Permite desenhar pelo menos uma zona poligonal.
- Permite marcar pelo menos quatro pontos de referência.
- Salva YAML.
- Reabre YAML.
- Renderiza zonas e referências.
