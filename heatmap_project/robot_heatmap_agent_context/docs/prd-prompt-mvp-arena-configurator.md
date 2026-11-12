# PRD / Prompt para agente — Robot Heatmap Scout MVP

Use este prompt para pedir a outro agente que gere o projeto inicial do Robot Heatmap Scout.

O objetivo deste prompt e impedir que o agente tente construir o sistema inteiro de uma vez. A entrega esperada e somente o scaffold do projeto e o primeiro marco funcional: Arena Configurator.

---

## Prompt pronto para copiar

```text
Voce e um agente de desenvolvimento trabalhando dentro do repositorio:

C:\Users\DISUP\Documents\Code\sesi\AnalisadorDeTreinosFtc

Existe um sistema de scout online ja existente em PHP + frontend web. Nao mexa nele agora.

Seu trabalho e criar o projeto local Python do Robot Heatmap Scout dentro de:

heatmap_project/robot-heatmap-scout/

Antes de implementar, leia estes arquivos de contexto:

1. heatmap_project/robot_heatmap_agent_context/00_CONTEXT_MASTER.md
2. heatmap_project/robot_heatmap_agent_context/AGENTS.md
3. heatmap_project/robot_heatmap_agent_context/docs/roadmap.md
4. heatmap_project/robot_heatmap_agent_context/docs/integracao-futura-api-php.md
5. heatmap_project/robot_heatmap_agent_context/tasks/01-arena-configurator.md

Produto:

Criar um prototipo local, offline-first, human-in-the-loop, para scouting visual de robos em videos de partidas de robotica FTC.

O sistema futuro devera gerar trajetoria, mapa de calor, tempo por zona, metricas espaciais e pacotes que poderao ser enviados para uma API PHP online. Mas isso e futuro.

Neste marco, implemente somente o Arena Configurator.

Nao implemente:

- integracao com API PHP;
- login;
- banco online;
- upload remoto;
- dashboard web;
- tracker de robo;
- YOLO;
- reconhecimento automatico de equipe;
- simulador Unreal;
- relatorio estatistico sofisticado.

Regras arquiteturais:

- O MVP deve funcionar localmente, sem internet.
- O backend PHP online sera hub futuro, mas nao e dependencia agora.
- A ferramenta local deve salvar artefatos em arquivos simples.
- Usar Python.
- Usar OpenCV para a interface visual inicial.
- Usar PyYAML para salvar e carregar configuracoes.
- Manter o codigo simples, pequeno e testavel.
- Preferir funcoes e modulos claros em vez de um script gigante.
- Documentar decisoes em docs/acompanhamento.md.

Estrutura esperada:

heatmap_project/robot-heatmap-scout/
  AGENTS.md
  README.md
  requirements.txt
  assets/
    arenas/
      .gitkeep
  configs/
    fields/
      field_example.normalized.yaml
  calibrations/
    .gitkeep
  videos/
    .gitkeep
  outputs/
    .gitkeep
  docs/
    acompanhamento.md
    roadmap.md
    arena-configurator.md
    coordenadas-calibracao.md
  tasks/
    01-arena-configurator.md
    02-video-calibration.md
    03-tracker-human-in-the-loop.md
  scripts/
    arena_configurator.py
  src/
    robot_heatmap/
      __init__.py
      field_config.py
      arena_editor.py
      coordinates.py
      zones.py
  tests/
    test_field_config.py
    test_coordinates.py

Comando principal esperado:

python scripts/arena_configurator.py --image assets/arenas/the_code_topdown.png --output configs/fields/the_code.yaml

Requisitos funcionais do Arena Configurator:

1. Abrir uma imagem PNG/JPG da arena top-down.
2. Criar um campo logico normalizado 1000x1000.
3. Mostrar a imagem em uma janela interativa do OpenCV.
4. Converter cliques na imagem para coordenadas logicas do campo.
5. Permitir criar zonas poligonais por cliques.
6. Permitir nomear cada zona com id e label.
7. Permitir criar pontos de referencia.
8. Salvar a configuracao em YAML.
9. Reabrir um YAML existente.
10. Renderizar zonas e pontos por cima da imagem ao reabrir.

Teclas sugeridas:

- z: iniciar nova zona;
- p: iniciar novo ponto de referencia;
- u: desfazer ultimo ponto;
- enter: finalizar poligono atual;
- s: salvar YAML;
- q: sair;
- r: resetar desenho atual;
- h: mostrar ajuda no terminal.

Formato YAML esperado:

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

Requisitos tecnicos minimos:

- requirements.txt deve incluir pelo menos:
  - opencv-contrib-python
  - numpy
  - pyyaml
  - pytest

- src/robot_heatmap/field_config.py deve conter funcoes para:
  - criar estrutura de field padrao;
  - carregar YAML;
  - salvar YAML;
  - validar campos minimos.

- src/robot_heatmap/coordinates.py deve conter funcoes para:
  - converter coordenada de imagem para campo normalizado;
  - converter coordenada de campo normalizado para imagem.

- src/robot_heatmap/zones.py deve conter funcoes simples para:
  - validar poligono com pelo menos 3 pontos;
  - normalizar estrutura de zona.

- src/robot_heatmap/arena_editor.py deve concentrar a interacao OpenCV.

- scripts/arena_configurator.py deve ser um entrypoint fino que chama os modulos em src.

Testes esperados:

1. Testar save/load de YAML sem depender de OpenCV.
2. Testar conversao imagem -> campo e campo -> imagem.
3. Testar validacao de zona poligonal.

Nao e necessario automatizar a janela OpenCV nos testes.

Critérios de aceite:

- O projeto e criado em heatmap_project/robot-heatmap-scout/.
- Existe AGENTS.md dentro do projeto novo reforcando offline-first e Arena Configurator como prioridade.
- Existe README.md com instalacao e comando de uso.
- Existe requirements.txt.
- Existe scripts/arena_configurator.py.
- Existem modulos em src/robot_heatmap/.
- Existem testes unitarios para YAML, coordenadas e zonas.
- pytest roda com sucesso.
- O script aceita --image e --output.
- O script consegue abrir uma imagem quando houver arquivo valido.
- O script consegue salvar YAML no formato esperado.
- O script consegue reabrir YAML existente e desenhar zonas/pontos.

Importante:

Se faltar uma imagem real da arena, crie apenas um placeholder documentado em assets/arenas/.gitkeep e deixe o README explicar onde colocar a imagem. Nao baixe imagens automaticamente.

Nao altere api/ nem client/.

Nao implemente endpoints, sincronizacao online, upload remoto ou dados mockados de API nesta fase.
```

---

## Resultado esperado do agente

Ao final, o agente deve entregar um projeto local Python inicial, testavel e sem dependencia online.

O primeiro teste pratico depois da geracao sera:

```bash
cd heatmap_project/robot-heatmap-scout
python -m pytest
python scripts/arena_configurator.py --image assets/arenas/the_code_topdown.png --output configs/fields/the_code.yaml
```

Se ainda nao houver imagem real, o `pytest` deve passar e o README deve explicar que o usuario precisa colocar uma imagem top-down em `assets/arenas/`.
