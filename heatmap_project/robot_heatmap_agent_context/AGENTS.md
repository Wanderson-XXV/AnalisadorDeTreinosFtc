# AGENTS.md

## Objetivo do projeto

Este repositório implementa um protótipo human-in-the-loop para scouting visual de robôs em vídeos de partidas de robótica.

O sistema deve permitir configurar uma arena top-down, calibrar vídeos reais para essa arena, rastrear um robô específico e gerar dados como trajetória, mapa de calor e tempo por zona.

## Prioridade atual

A prioridade atual é implementar o **Arena Configurator**.

Não começar pelo tracker.

Não começar pela integração com a API PHP.

A primeira entrega deve permitir:

- carregar um PNG top-down da arena;
- criar uma configuração de campo normalizada;
- desenhar zonas manualmente;
- marcar pontos de referência;
- exportar um YAML;
- reabrir o YAML e mostrar as zonas por cima da imagem.

## Fases de dependência externa

O projeto deve evoluir em fases para não confundir o MVP local com a arquitetura futura.

### Fase 0 — Local offline-first

Esta é a fase atual.

- Não depender da API PHP.
- Não depender de login.
- Não depender de banco online.
- Não depender de upload remoto.
- Não criar mocks remotos obrigatórios.
- Produzir artefatos locais padronizados em YAML, CSV, JSON e imagens.

### Fase 1 — Importação opcional da API PHP

Quando a API estiver preparada para outros torneios, o app local poderá importar dados online, como torneios, equipes e partidas.

Essa importação deve ser opcional. O heatmap ainda deve funcionar com dados locais.

### Fase 2 — Upload de resultados processados

Depois que o fluxo local estiver validado, o app local poderá enviar resultados prontos para a API PHP, como tracking, heatmaps, métricas e imagens exportadas.

Não enviar dados brutos grandes sem uma decisão explícita.

### Fase 3 — Visualização web

O client web poderá visualizar os heatmaps, trajetórias e estatísticas enviados pelo app local.

Essa fase pertence à integração entre `api/` e `client/`, não ao MVP do configurador de arena.

### Fase 4 — Simulador Unreal Engine

O simulador poderá consumir dados da API PHP para reconstruir partidas, equipes, trajetórias e comportamentos.

No futuro, o simulador também poderá enviar resultados para a API, mas isso deve ser tratado como uma integração própria.

## Regras de desenvolvimento

- Manter o código simples e legível.
- Não superengenhe antes do primeiro fluxo funcionar.
- Preferir scripts pequenos e testáveis.
- Usar Python.
- Usar OpenCV para interação visual inicial.
- Usar YAML para configurações de arena, zonas e calibração.
- Salvar outputs em pastas claras.
- Não versionar vídeos grandes.
- Não versionar outputs pesados.
- Documentar decisões em `docs/acompanhamento.md`.
- Se surgir dúvida entre fazer o MVP local ou preparar integração online, priorizar o MVP local e documentar a integração futura.
- Para detalhes da arquitetura futura com PHP, client web e Unreal, consultar `docs/integracao-futura-api-php.md`.

## Estrutura recomendada

```text
robot-heatmap-scout/
│
├── AGENTS.md
├── README.md
├── requirements.txt
│
├── assets/
│   └── arenas/
│       └── .gitkeep
│
├── configs/
│   └── fields/
│       └── field_example.normalized.yaml
│
├── calibrations/
│   └── .gitkeep
│
├── videos/
│   └── .gitkeep
│
├── outputs/
│   └── .gitkeep
│
├── docs/
│   ├── acompanhamento.md
│   ├── roadmap.md
│   ├── arena-configurator.md
│   └── coordenadas-calibracao.md
│
├── tasks/
│   ├── 01-arena-configurator.md
│   ├── 02-video-calibration.md
│   └── 03-tracker-human-in-the-loop.md
│
├── scripts/
│   ├── arena_configurator.py
│   ├── calibrate_video.py
│   ├── test_video_to_field.py
│   ├── track_robot.py
│   ├── generate_heatmap.py
│   └── analyze_zones.py
│
└── src/
    └── robot_heatmap/
        ├── __init__.py
        ├── field_config.py
        ├── arena_editor.py
        ├── calibration.py
        ├── coordinates.py
        ├── tracking.py
        ├── visualization.py
        └── zones.py
```

## Sistema de coordenadas

No MVP, usar campo normalizado:

```yaml
unit: "normalized"
width: 1000
height: 1000
```

Origem padrão:

- canto superior esquerdo;
- eixo X para direita;
- eixo Y para baixo.

Isso combina com coordenadas de imagem e facilita visualização.

No futuro, o campo pode usar centímetros reais:

```yaml
unit: "cm"
width: 365.76
height: 365.76
```

O código deve ser escrito para aceitar ambos, sem travar valores no código.

## Zonas

Zonas devem ser polígonos por padrão.

Evitar limitar tudo a retângulos.

Formato recomendado:

```yaml
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

## Pontos de referência

A arena deve conter pontos de referência usados para calibrar vídeos.

Exemplo:

```yaml
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
```

## Critérios de aceite do primeiro marco

- Existe `scripts/arena_configurator.py`.
- O script abre uma imagem PNG da arena.
- O usuário consegue desenhar uma zona poligonal clicando.
- O usuário consegue nomear a zona.
- O usuário consegue marcar pontos de referência.
- O script salva um YAML em `configs/fields/`.
- O script consegue reabrir o YAML.
- O script renderiza as zonas e pontos por cima da imagem.
