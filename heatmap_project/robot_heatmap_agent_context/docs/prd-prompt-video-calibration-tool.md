# PRD / Prompt para agente — Video Calibration Tool

Use este prompt para pedir a outro agente que implemente a Fase 2 do Robot Heatmap Scout: uma ferramenta guiada para calibrar um video real contra a arena configurada.

A prioridade desta fase e usabilidade. A ferramenta deve ser boa o suficiente para estudantes operarem, sem precisar entender homografia.

---

## Prompt pronto para copiar

```text
Voce e um agente de desenvolvimento trabalhando dentro do repositorio:

C:\Users\DISUP\Documents\Code\sesi\AnalisadorDeTreinosFtc

O projeto local Python do heatmap fica em:

heatmap_project/robot-heatmap-scout/

Nao mexa em api/ nem client/. Nao implemente integracao PHP, upload remoto, login, dashboard web, YOLO, tracker automatico ou simulador Unreal nesta fase.

Antes de implementar, leia:

1. AGENTS.md
2. heatmap_project/robot-heatmap-scout/AGENTS.md
3. heatmap_project/robot-heatmap-scout/tasks/02-video-calibration.md
4. heatmap_project/robot-heatmap-scout/docs/coordenadas-calibracao.md
5. heatmap_project/robot-heatmap-scout/configs/fields/decode.yaml

Objetivo:

Implementar uma ferramenta guiada de calibracao de video usando OpenCV.

A ferramenta deve abrir um video real, permitir escolher o frame util da partida, pedir cliques nos pontos de referencia definidos no field YAML, calcular homografia e mostrar feedback visual em uma unica janela com video e arena lado a lado.

Entrada de teste disponivel:

- Video: heatmap_project/robot_heatmap_agent_context/videos/v1.mp4
- Field YAML: heatmap_project/robot-heatmap-scout/configs/fields/decode.yaml
- Imagem da arena referenciada pelo YAML: assets/arenas/decode_hd_2.png

Importante:

O arquivo de video deve ser validado antes do fluxo principal. Se o OpenCV nao conseguir abrir o video, a ferramenta deve encerrar com uma mensagem clara explicando que o arquivo esta ausente, corrompido ou invalido.

Comando esperado:

cd heatmap_project/robot-heatmap-scout

python scripts/calibrate_video.py \
  --video ../robot_heatmap_agent_context/videos/v1.mp4 \
  --field configs/fields/decode.yaml \
  --output calibrations/decode_v1.yaml

Experiencia desejada:

Uma unica janela OpenCV chamada "Video Calibration".

A janela deve mostrar:

- lado esquerdo: frame do video;
- lado direito: arena top-down do field YAML;
- instrucoes curtas desenhadas no topo ou rodape;
- estado atual do fluxo: escolher frame, clicar ponto, validar, salvar;
- pontos clicados no video;
- pontos correspondentes na arena;
- apos homografia, ao clicar no video em modo teste, mostrar o ponto projetado na arena.

Nao abrir multiplas janelas para video e arena. Usar uma imagem composta lado a lado.

Fluxo funcional:

1. Carregar o video.
2. Carregar o field YAML.
3. Resolver a imagem da arena a partir de field.image.
4. Entrar em modo "escolher frame util".
5. Permitir navegar no video ate o frame em que a partida deve comecar ou onde a arena esta bem visivel.
6. Confirmar o frame escolhido.
7. Ler reference_points do field YAML, na ordem:
   - top_left
   - top_right
   - bottom_right
   - bottom_left
   - outros pontos, se existirem.
8. Pedir um clique no video para cada reference_point.
9. Calcular homografia com cv2.findHomography usando video_points -> field_points.
10. Entrar em modo de validacao.
11. No modo de validacao, ao clicar no video, desenhar na arena onde esse ponto cai.
12. Permitir refazer os cliques se a calibracao estiver ruim.
13. Salvar YAML de calibracao.
14. Salvar um PNG de verificacao visual em outputs/calibration_checks/.

Teclas recomendadas:

Modo escolher frame:

- space: play/pause;
- d: avancar 1 frame;
- a: voltar 1 frame;
- D: avancar cerca de 1 segundo;
- A: voltar cerca de 1 segundo;
- enter: usar o frame atual;
- q: sair.

Modo clicar pontos:

- clique esquerdo no video: marcar o ponto solicitado;
- u: desfazer ultimo ponto;
- r: reiniciar todos os cliques;
- enter: calcular homografia quando houver pontos suficientes;
- q: sair.

Modo validacao:

- clique esquerdo no video: projetar ponto na arena;
- r: refazer cliques de calibracao;
- s: salvar calibracao;
- q: sair sem salvar.

Formato YAML esperado para calibracao:

video:
  path: "../robot_heatmap_agent_context/videos/v1.mp4"
  start_frame: 540
  start_time_seconds: 18.0
  fps: 30.0

field:
  path: "configs/fields/decode.yaml"
  unit: "cm"
  width: 365.76
  height: 365.76

reference_points:
  top_left:
    label: "Canto superior esquerdo"
    field: [0, 0]
    video: [123, 88]
  top_right:
    label: "Canto superior direito"
    field: [365.76, 0]
    video: [842, 91]

homography:
  direction: "video_to_field"
  matrix:
    - [1.0, 0.0, 0.0]
    - [0.0, 1.0, 0.0]
    - [0.0, 0.0, 1.0]

outputs:
  check_image: "outputs/calibration_checks/decode_v1_check.png"

Arquitetura esperada:

Criar:

- scripts/calibrate_video.py
- src/robot_heatmap/calibration.py
- src/robot_heatmap/video_navigation.py
- tests/test_calibration.py

Responsabilidades:

- scripts/calibrate_video.py:
  - parsear argumentos;
  - criar a ferramenta;
  - chamar o fluxo principal.

- src/robot_heatmap/calibration.py:
  - montar pares video_points / field_points;
  - calcular homografia;
  - projetar ponto do video para campo;
  - salvar YAML de calibracao;
  - carregar YAML de calibracao.

- src/robot_heatmap/video_navigation.py:
  - abrir video;
  - ler FPS, total de frames, frame atual;
  - ir para frame especifico;
  - avancar/voltar frames;
  - extrair frame atual;
  - validar se o video abriu.

- A composicao visual lado a lado pode ficar em calibration.py ou em um modulo pequeno dedicado se o codigo ficar grande.

Testes obrigatorios:

1. Testar que calcular homografia com quatro cantos conhecidos projeta pontos corretamente.
2. Testar save/load do YAML de calibracao.
3. Testar validacao de video inexistente/invalido sem abrir janela OpenCV.
4. Testar que pontos de referencia sao lidos do field YAML no formato esperado.

Nao e necessario automatizar cliques OpenCV nos testes.

Aceite manual:

1. Rodar:

   python -m pytest

2. Rodar:

   python scripts/calibrate_video.py --video ../robot_heatmap_agent_context/videos/v1.mp4 --field configs/fields/decode.yaml --output calibrations/decode_v1.yaml

3. A ferramenta deve abrir uma unica janela lado a lado.
4. Deve ser possivel navegar ate um frame util.
5. Deve pedir os quatro cantos da arena.
6. Deve calcular a homografia.
7. Deve permitir clicar no video e ver o ponto projetado na arena.
8. Deve salvar calibrations/decode_v1.yaml.
9. Deve salvar outputs/calibration_checks/decode_v1_check.png.

Se o video v1.mp4 nao abrir, nao tente contornar com mock visual. Mostre uma mensagem clara e mantenha os testes automatizados passando.

Notas de UX:

- A ferramenta deve falar em linguagem simples: "Clique no canto superior esquerdo da arena no video".
- Desenhar o proximo ponto esperado na tela.
- Mostrar progresso, por exemplo: "Ponto 2/4: Canto superior direito".
- Usar cores consistentes:
  - amarelo para ponto atual;
  - verde para pontos confirmados;
  - vermelho para erro/mensagem critica.
- Evitar exigir que o estudante digite IDs manualmente nesta fase; os IDs ja vem do YAML.
```

---

## Observacao sobre o video `v1.mp4`

Antes da implementacao, confirme se o arquivo abre com OpenCV. Se ele tiver sido salvo parcialmente ou estiver corrompido, a ferramenta deve avisar isso claramente em vez de falhar com stack trace.

O fluxo de calibracao ainda deve ser implementado de forma generica para aceitar qualquer video futuro passado por `--video`.
