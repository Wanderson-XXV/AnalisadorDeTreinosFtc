# Roadmap — Robot Heatmap Scout

## Diretriz geral

O desenvolvimento inicial é offline-first.

O app local Python deve funcionar sem API PHP, login, banco online ou upload remoto. A integração com o sistema online deve ser preparada por contratos de dados, mas implementada somente depois que o fluxo local estiver validado.

## Fase 1 — Arena Configurator

Objetivo:

> Criar a ferramenta que transforma uma imagem top-down da arena em um YAML reutilizável.

Entregas:

- carregar PNG/JPG da arena;
- criar campo normalizado 1000x1000;
- converter clique na imagem para coordenada lógica da arena;
- desenhar zonas poligonais;
- nomear zonas;
- marcar pontos de referência;
- salvar YAML;
- recarregar YAML;
- renderizar zonas e pontos por cima da imagem.

Critério de sucesso:

> O usuário consegue abrir uma imagem da arena, desenhar pelo menos 3 zonas, marcar 4 pontos de referência e salvar `field.yaml`.

---

## Fase 2 — Video Calibration

Objetivo:

> Ligar um vídeo real da partida à arena configurada.

Entregas:

- abrir frame inicial do vídeo;
- carregar `field.yaml`;
- pedir clique no vídeo para cada ponto de referência;
- calcular homografia;
- salvar `calibration.yaml`;
- criar teste visual clique no vídeo -> ponto na arena.

Critério de sucesso:

> Ao clicar em um ponto no vídeo, o sistema mostra esse ponto no local correspondente da arena top-down.

---

## Fase 3 — Tracker Human-in-the-loop

Objetivo:

> Rastrear um robô específico no vídeo original e projetar sua posição na arena tática.

Entregas:

- selecionar manualmente ROI do robô;
- rastrear com CSRT inicialmente;
- permitir pausar;
- permitir reselecionar com tecla `R`;
- salvar posições em CSV;
- mostrar vídeo original com bounding box;
- mostrar ponto correspondente na arena.

Critério de sucesso:

> O sistema rastreia um robô por pelo menos 30 segundos e salva coordenadas do vídeo + coordenadas da arena.

---

## Fase 4 — Visualizações

Objetivo:

> Transformar posições em análise visual.

Entregas:

- gerar trajetória;
- gerar mapa de calor;
- sobrepor trajetória na arena;
- sobrepor heatmap na arena;
- exportar PNG.

Critério de sucesso:

> Dado um `positions.csv`, o sistema gera `trajectory.png` e `heatmap.png`.

---

## Fase 5 — Métricas de scouting

Objetivo:

> Gerar dados úteis para análise estratégica.

Entregas:

- tempo por zona;
- entradas/saídas por zona;
- distância percorrida aproximada;
- tempo parado aproximado;
- velocidade média aproximada;
- comparação por aliança.

Critério de sucesso:

> O sistema gera um `zones.csv` com tempo e porcentagem por zona.

---

## Fase 6 — Evoluções futuras

Possibilidades:

- interface Streamlit;
- análise de múltiplas partidas por equipe;
- heatmap agregado por equipe;
- separação auto/teleop/endgame;
- normalização vermelho/azul;
- YOLO;
- rastreamento multiobjeto;
- relatório automático por equipe;
- dashboard web.

---

## Fase 7 — Importação opcional da API PHP

Objetivo:

> Permitir que o app local busque dados de torneios, equipes e partidas na API PHP sem tornar isso obrigatório.

Entregas:

- definir contrato `tournament_import`;
- importar metadados de torneio;
- associar uma análise local a uma partida online;
- manter modo manual/local funcionando sem internet.

Critério de sucesso:

> O usuário consegue iniciar uma análise usando dados vindos da API ou preencher os dados localmente quando estiver offline.

---

## Fase 8 — Upload de resultados para API PHP

Objetivo:

> Enviar resultados processados pelo app local para o backend PHP.

Entregas:

- definir contrato `heatmap_package`;
- enviar manifest da análise;
- enviar tracking e métricas;
- enviar imagens renderizadas;
- tratar falha de rede sem perder os arquivos locais.

Critério de sucesso:

> Um pacote gerado localmente aparece no sistema web associado à equipe e à partida corretas.

---

## Fase 9 — Visualização web e simulador

Objetivo:

> Usar a API PHP como hub para visualização online e consumo por simulador Unreal Engine.

Entregas:

- visualizar heatmaps e métricas no client web;
- definir contrato `simulation_package`;
- permitir que o simulador consuma dados de equipes, partidas, robôs e trajetórias;
- estudar envio futuro de resultados de simulação para a API.

Critério de sucesso:

> O site mostra análises espaciais processadas localmente, e o simulador consegue consumir dados estruturados da API.
