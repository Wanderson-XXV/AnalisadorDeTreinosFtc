# Tarefa 01 — Arena Configurator

## Status: CONCLUIDO

## Objetivo

Implementar a primeira ferramenta do projeto: um configurador de arena baseado em imagem top-down.

## Entrada

```bash
python scripts/arena_configurator.py \
  --image assets/arenas/the_code_topdown.png \
  --output configs/fields/the_code.yaml
```

## Requisitos funcionais

- [x] Abrir imagem PNG/JPG.
- [x] Criar campo logico normalizado 1000x1000.
- [x] Mostrar imagem em janela interativa.
- [x] Permitir criar zona poligonal por cliques.
- [x] Permitir nomear zona com id e label.
- [x] Permitir criar pontos de referencia.
- [x] Salvar YAML.
- [x] Reabrir YAML existente.
- [x] Desenhar zonas e pontos ao reabrir.

## Teclas implementadas

- z: nova zona
- p: novo ponto de referencia
- u: desfazer ultimo ponto
- Enter: finalizar poligono
- s: salvar YAML
- q: sair
- r: resetar desenho atual
- h: ajuda no terminal

## Modulos criados

- src/robot_heatmap/field_config.py
- src/robot_heatmap/coordinates.py
- src/robot_heatmap/zones.py
- src/robot_heatmap/arena_editor.py
- scripts/arena_configurator.py
