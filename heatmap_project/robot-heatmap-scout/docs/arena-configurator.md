# Arena Configurator — Documentacao tecnica

## Objetivo

Ferramenta visual para configurar uma arena top-down, desenhar zonas e pontos de referencia, e exportar YAML reutilizavel.

## Uso

```bash
python scripts/arena_configurator.py --image assets/arenas/the_code_topdown.png --output configs/fields/the_code.yaml
```

Para reabrir configuracao existente:

```bash
python scripts/arena_configurator.py \
  --output configs/fields/the_code.yaml \
  --load configs/fields/the_code.yaml
```

Quando `--load` e usado sem `--image`, a imagem e lida de `field.image` no YAML. O script procura esse caminho a partir do diretorio atual e dos ancestrais do proprio YAML.

## Dimensoes reais

O MVP pode operar em dois modos:

- `normalized`: campo logico `1000x1000`, recomendado para o primeiro desenho de zonas.
- `cm`: campo em centimetros reais, recomendado quando as medidas oficiais ja importam.

Exemplo para campo FTC padrao:

```bash
python scripts/arena_configurator.py \
  --image assets/arenas/decode_topdown.png \
  --output configs/fields/decode.yaml \
  --unit cm \
  --field-width 365.76 \
  --field-height 365.76
```

Se o YAML ja existe em `normalized`, voce pode converter depois criando uma nova configuracao ou ajustando conscientemente `field.unit`, `field.width` e `field.height`. As coordenadas das zonas mudam de escala, entao nao basta trocar a unidade se voce quiser medidas em cm exatas.

## Limite da arena na imagem

Nesta fase, a conversao imagem -> campo assume que a imagem inteira corresponde a arena inteira.

Para uma imagem top-down com bordas sobrando, recorte a imagem antes de marcar zonas. Para imagem com perspectiva ou camera inclinada, use a fase de Video Calibration com pontos de referencia e homografia.

## Fluxo interno

1. `arena_configurator.py` parseia argumentos e chama `ArenaEditor`.
2. `ArenaEditor` carrega a imagem com OpenCV.
3. Se `--load` for passado, carrega o YAML existente via `FieldConfig.from_file`.
4. Zonas e pontos ja salvos sao renderizados sobre a imagem.
5. O usuario interage com teclas e cliques do mouse.
6. Ao clicar, `Coordinates.to_field` converte a posicao para o espaco normalizado.
7. Ao pressionar Enter, o usuario informa ID e label no terminal.
8. Ao pressionar `s`, o YAML e salvo via `FieldConfig.save`.

## Modulos envolvidos

- `arena_editor.py` — janela OpenCV, captura de mouse, renderizacao.
- `field_config.py` — criacao, leitura, escrita e validacao do YAML.
- `coordinates.py` — conversao de coordenadas imagem <-> campo.
- `zones.py` — validacao de poligonos.

## Formato de saida

Ver `configs/fields/field_example.normalized.yaml` para exemplo completo.

## Limitacoes desta fase

- A conversao imagem -> campo e linear (sem correcao de perspectiva).
- A area util da arena deve ocupar a imagem inteira ou uma imagem previamente recortada.
- A correcao de perspectiva entra no Marco 2 (Video Calibration) com homografia.
- O input de texto (ID, label) e feito no terminal, nao em janela popup.
