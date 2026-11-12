# Rastreamento de Robôs LEGO com marcadores ArUco

Protótipo em Python para **rastreamento em tempo real da posição e orientação de robôs LEGO**
sobre uma arena plana, usando uma webcam **Logitech C920** e marcadores **ArUco**.

O sistema estima, quadro a quadro, a posição `(x, y)` do robô em milímetros dentro da
arena, além do rumo (`heading`), e grava cada teste em arquivos `CSV`/`JSON` prontos para
análise posterior. Toda a interface é em **português**.

> Este é um protótipo de calibração/validação ("tuning"): o foco é medir a **qualidade**
> do rastreamento (ruído, exatidão, repetibilidade) antes de integrá-lo a um sistema maior.

---

## Índice

- [Principais recursos](#principais-recursos)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Execução rápida](#execução-rápida)
- [Modo demonstração (sem hardware)](#modo-demonstração-sem-hardware)
- [Fluxo de trabalho completo](#fluxo-de-trabalho-completo)
- [Scripts utilitários](#scripts-utilitários)
- [Arquivos de configuração de exemplo](#arquivos-de-configuração-de-exemplo)
- [Formato dos dados de saída](#formato-dos-dados-de-saída)
- [Protocolo de validação física](#protocolo-de-validação-física)
- [Arquitetura do código](#arquitetura-do-código)
- [Testes automatizados](#testes-automatizados)
- [Limitações conhecidas](#limitações-conhecidas)

---

## Principais recursos

- **Detecção de marcadores ArUco** com a API moderna do OpenCV (`cv2.aruco.ArucoDetector`).
- **Calibração intrínseca da câmera** por meio de um tabuleiro **ChArUco** (assistente guiado).
- **Registro da arena**: aprende a relação entre a imagem da câmera e as coordenadas reais
  da arena (em mm) a partir de marcadores de referência fixos.
- **Estimativa de pose do robô** com `SOLVEPNP_IPPE_SQUARE`, considerando a altura do
  marcador acima do plano da arena.
- **Sistema de coordenadas da arena**: origem no canto **superior esquerdo**, eixo **X para a
  direita**, eixo **Y para baixo**, unidade em **milímetros**.
- **Máquina de estados de teste** completa: `READY → NEW_TEST → CAPTURING_START →
  RECORDING → CAPTURING_END → RESULT → SAVED/DISCARDED`.
- **Valores brutos sempre preservados**: a suavização é apenas para exibição; os arquivos
  gravam sempre o dado bruto (`raw_*`) e o processado.
- **Modo demonstração** integrado que gera uma arena virtual — funciona **sem câmera nem
  marcadores físicos**.
- Interface gráfica em **PySide6 (Qt)** e execução **headless** amigável em servidores sem
  display.

---

## Requisitos

- Python **3.10+** (testado em 3.11).
- Sistema operacional Linux, macOS ou Windows.
- Webcam Logitech C920 (ou compatível UVC) para uso com hardware real — **opcional** para
  o modo demonstração.

Dependências Python (ver `requirements.txt`):

```
opencv-python
numpy
scipy
PySide6
PyYAML
matplotlib
```

---

## Instalação

```bash
# 1. (recomendado) crie um ambiente virtual
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
# .venv\Scripts\activate       # Windows

# 2. instale as dependências
pip install -r requirements.txt
```

---

## Execução rápida

```bash
python app.py
```

- Em uma máquina **com interface gráfica**, isso abre a janela principal do aplicativo.
- Em um ambiente **sem display** (servidor/headless), o programa exibe uma mensagem
  amigável explicando como executá-lo em uma máquina com tela ou via modo demonstração —
  em vez de travar com um erro de Qt.

---

## Modo demonstração (sem hardware)

O modo demonstração cria uma **arena virtual sintética** com marcadores de referência e um
robô que se movimenta, renderizando quadros como se viessem de uma câmera real. É ideal
para conhecer o fluxo de trabalho sem nenhum equipamento.

1. Execute `python app.py` em uma máquina com interface gráfica.
2. Na configuração de câmera, selecione a fonte **"Demonstração"**.
3. O registro da arena e as referências são configurados automaticamente para a cena
   virtual — basta iniciar um novo teste.

Internamente, a fonte de demonstração (`DemoSource`) projeta os marcadores ArUco em uma
câmera virtual, permitindo validar toda a cadeia detecção → registro → pose → gravação.

---

## Fluxo de trabalho completo

Com hardware real, o processo recomendado é:

1. **Gerar os marcadores e o tabuleiro** (uma única vez):
   - Marcador(es) ArUco do robô e de referência — `scripts/generate_aruco.py`.
   - Tabuleiro ChArUco de calibração — `scripts/generate_charuco.py`.
   - Imprima em tamanho conhecido e **meça o lado do marcador com precisão** (ver nota
     abaixo).

2. **Calibrar a câmera** (Assistente de Calibração):
   - Capture várias imagens do tabuleiro ChArUco em diferentes ângulos/distâncias.
   - O sistema estima a matriz intrínseca e os coeficientes de distorção e salva em
     `calibrations/`.

3. **Registrar a arena** (Diálogo de Registro):
   - Posicione os marcadores de referência em pontos conhecidos da arena.
   - Informe as coordenadas reais (mm) de cada referência.
   - O sistema calcula a pose extrínseca da câmera e **aprende** as referências fixas.

4. **Executar testes**:
   - `Novo Teste` → capture a pose inicial → `Gravar` → capture a pose final.
   - Ao finalizar, revise o resultado e escolha **Salvar** ou **Descartar**.
   - Cada teste salvo gera uma pasta em `outputs/<sessão>/<teste>/`.

> **Importante — definição de `marker_length_mm`:** o comprimento do marcador é medido da
> **borda externa preta a borda externa preta** (não inclui a margem branca). Um valor
> incorreto causa erro sistemático de escala/distância na pose.

---

## Scripts utilitários

### Gerar marcadores ArUco

```bash
python scripts/generate_aruco.py --dictionary DICT_4X4_50 --id 0 --size 800 --out marker_0.png
```

Gera a imagem de um marcador (com quiet-zone branca) pronta para impressão. Use `--id`
para o robô e para cada referência.

### Gerar tabuleiro ChArUco

```bash
python scripts/generate_charuco.py --squares-x 7 --squares-y 5 \
    --square-mm 30 --marker-mm 22 --dictionary DICT_5X5_1000 --out charuco.png
```

Gera a imagem do tabuleiro **e** salva um arquivo de especificação (`.yaml`) com as
dimensões, usado depois pelo assistente de calibração.

> Consulte `python scripts/generate_aruco.py --help` e
> `python scripts/generate_charuco.py --help` para todas as opções.

---

## Arquivos de configuração de exemplo

A pasta `configs/` traz exemplos prontos, que também servem de referência de formato:

| Arquivo                      | Descrição                                                        |
|------------------------------|------------------------------------------------------------------|
| `configs/camera.yaml`        | Câmera Logitech C920 @ 1920×1080, foco/exposição manuais.        |
| `configs/arena.yaml`         | Arena 2000×1000 mm com 3 zonas (partida, chegada, obstáculo).    |
| `configs/robot.yaml`         | Robô com marcador `DICT_4X4_50` id 0, lado 80 mm, altura 60 mm.  |
| `configs/charuco_board.yaml` | Tabuleiro ChArUco 7×5 (quadrado 30 mm, marcador 22 mm).          |

Para tracking estável recomenda-se **desativar o autofoco e o autoexposição** da C920
(já refletido em `camera.yaml`), evitando variações de nitidez e brilho entre quadros.

---

## Formato dos dados de saída

Cada teste salvo cria a pasta `outputs/<sessão>/<teste>/` contendo:

### `positions.csv` — uma linha por quadro

Colunas (nesta ordem exata):

```
frame, timestamp_seconds, raw_x_mm, raw_y_mm, raw_z_mm,
x_mm, y_mm, heading_deg, pitch_deg, roll_deg,
reprojection_error_px, pose_confidence, marker_visible, arena_reference_count
```

- `raw_*` — valores **brutos** da pose (nunca suavizados).
- `x_mm`, `y_mm`, `heading_deg` — valores processados (podem estar suavizados para exibição).
- `reprojection_error_px` — erro de reprojeção em pixels (qualidade da pose).
- `pose_confidence` — confiança da estimativa (0–1).
- `marker_visible` — se o marcador do robô foi detectado no quadro.
- `arena_reference_count` — número de referências da arena visíveis no quadro.

### `events.csv` — transições da máquina de estados

```
timestamp_seconds, from_state, to_state
```

### `result.json` — documento versionado (schema `1.0`)

Inclui a configuração usada, estatísticas das capturas inicial e final, o resultado do
teste e um campo `manual` reservado para medições manuais de um analisador futuro:

```json
"manual": { "longitudinal": null, "lateral": null }
```

---

## Protocolo de validação física

Para verificar a qualidade do rastreamento com hardware real, siga este protocolo e
registre **média, desvio padrão e valor máximo** de cada métrica:

1. **Jitter (ruído estático):** com o robô **parado**, grave ~30 quadros e meça a
   dispersão de `x_mm`, `y_mm` e `heading_deg`. O desvio padrão indica o ruído de base.
2. **Deslocamentos conhecidos:** mova o robô por distâncias medidas (ex.: 100, 200,
   500 mm) e compare o deslocamento estimado com o real (erro de exatidão/escala).
3. **Centro vs. borda:** repita as medições no **centro** e nas **bordas** do campo de
   visão — a distorção residual costuma ser maior nas bordas.
4. **Alturas diferentes:** teste marcadores em alturas distintas (`marker_height_mm`)
   para confirmar a compensação de paralaxe.
5. **Condições da câmera:** verifique o impacto de **autofoco**, **exposição** e
   **desfoque de movimento** — de preferência mantenha foco/exposição manuais e fixos.
6. Registre `reprojection_error_px` e `pose_confidence` em cada cenário; valores altos de
   erro ou baixa confiança sinalizam calibração/registro inadequados.

Uma planilha simples com médias/desvios por cenário já permite decidir se a precisão
atende ao caso de uso.

---

## Arquitetura do código

O projeto é organizado em camadas, do núcleo (sem Qt) até a interface:

```
app.py                          # ponto de entrada (headless-safe)
configs/                        # configurações de exemplo (YAML)
scripts/                        # geração de marcadores e tabuleiro ChArUco
src/aruco_tuning/
  models.py                     # dataclasses de domínio (configs, pose, estados)
  geometry.py                   # matemática de pose, ângulos e estatística robusta
  aruco_detection.py            # detecção de marcadores (API nova do OpenCV)
  camera.py                     # fontes de vídeo: câmera, arquivo e DemoSource
  camera_calibration.py         # calibração intrínseca via ChArUco
  arena.py                      # ArenaConfig e zonas
  arena_registration.py         # extrínseca da câmera + referências da arena
  robot_pose.py                 # estimativa de pose do robô (IPPE_SQUARE)
  tuning_test.py                # máquina de estados e cálculo do resultado
  recording.py                  # buffer de gravação por quadro
  persistence.py                # leitura/escrita de YAML, CSV e JSON
  ui/                           # camada de interface (PySide6)
    main_window.py              # janela principal e orquestração
    camera_panel.py             # visualização da câmera
    arena_panel.py              # visualização da arena (top-down)
    test_controls.py            # controles do teste
    status_bar.py               # barra de status
    calibration_wizard.py       # assistente de calibração ChArUco
    registration_dialog.py      # diálogo de registro da arena
    review_dialog.py            # revisão do resultado (salvar/descartar)
    config_dialogs.py           # diálogos de configuração
    qt_helpers.py               # utilidades Qt
tests/                          # testes automatizados (pytest)
```

**Princípio-chave:** a camada de núcleo (`src/aruco_tuning/*.py`, exceto `ui/`) não depende
do Qt e pode ser usada de forma programática/headless. A interface é apenas uma casca sobre
esse núcleo.

---

## Testes automatizados

```bash
pytest tests/
```

Cobrem geometria/estatística, a máquina de estados de teste, o cálculo do resultado,
a persistência (YAML/CSV/JSON) e a detecção ArUco de ponta a ponta.

---

## Limitações conhecidas

- Protótipo focado em **validação/tuning**, não em produção.
- A precisão depende diretamente da **calibração intrínseca** e do **registro da arena**;
  medições descuidadas dos marcadores propagam erro para a pose.
- Assume uma arena **plana** e marcadores em altura conhecida (`marker_height_mm`).
- A qualidade cai com **desfoque de movimento**, oclusão parcial e iluminação irregular.
- O modo demonstração é sintético e **não substitui** a validação com hardware real.
- Testado com a **API nova** do OpenCV (`ArucoDetector`/`CharucoDetector`, OpenCV ≥ 4.7).
  A função antiga `calibrateCameraCharuco` foi removida em versões recentes; a calibração
  usa `matchImagePoints` + `calibrateCamera`.
```
