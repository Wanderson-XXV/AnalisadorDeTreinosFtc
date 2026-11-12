# Tarefa 01 — Arena Configurator

## Objetivo

Implementar a primeira ferramenta do projeto: um configurador de arena baseado em imagem top-down.

## Entrada

```bash
python scripts/arena_configurator.py \
  --image assets/arenas/the_code_topdown.png \
  --output configs/fields/the_code.yaml
```

## Requisitos funcionais

- Abrir imagem PNG/JPG.
- Criar campo lógico normalizado `1000x1000`.
- Mostrar imagem em janela interativa.
- Permitir criar zona poligonal por cliques.
- Permitir nomear zona com `id` e `label`.
- Permitir criar pontos de referência.
- Salvar YAML.
- Reabrir YAML existente.
- Desenhar zonas e pontos ao reabrir.

## Requisitos técnicos

- Usar OpenCV para interface inicial.
- Usar PyYAML para salvar/carregar YAML.
- Separar funções principais em módulos quando possível.
- Evitar código gigante e acoplado.
- Não depender de medidas oficiais no MVP.

## Teclas sugeridas

- `z`: nova zona;
- `p`: novo ponto de referência;
- `u`: desfazer último ponto;
- `enter`: finalizar polígono;
- `s`: salvar;
- `q`: sair;
- `r`: resetar desenho atual;
- `h`: ajuda.

## Modelo de YAML

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

- O script abre uma imagem.
- O usuário desenha uma zona.
- O usuário salva o YAML.
- O usuário reabre o YAML.
- A zona aparece corretamente por cima da imagem.
- O usuário consegue marcar pelo menos 4 pontos de referência.
