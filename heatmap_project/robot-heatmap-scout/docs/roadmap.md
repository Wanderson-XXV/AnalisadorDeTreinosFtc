# Roadmap — Robot Heatmap Scout

## Fase 0 — Local offline-first (atual)

### Marco 1 — Arena Configurator [CONCLUIDO]

- Carregar PNG top-down da arena.
- Criar campo logico normalizado 1000x1000.
- Desenhar zonas como poligonos.
- Marcar pontos de referencia.
- Exportar YAML de configuracao.
- Reabrir YAML e renderizar zonas na imagem.

### Marco 2 — Video Calibration

Status: CONCLUIDO.

- [x] Abrir frame de video.
- [x] Clicar nos pontos de referencia da arena no frame.
- [x] Calcular homografia entre video e arena (cv2.findHomography).
- [x] Salvar calibracao em YAML.
- [x] Testar clique no video -> ponto aparece na arena.

### Marco 3 — Tracker Human-in-the-loop

Status: CONCLUIDO PARCIAL.

- [x] Selecionar robo no frame inicial.
- [x] Rastrear usando CSRT ou KCF do OpenCV.
- [x] Converter posicao do tracker para coordenadas da arena.
- [x] Salvar posicoes em CSV.
- [ ] Exportar trajetoria como imagem.

### Marco 4 — Visualizacoes e metricas

- Gerar mapa de calor (heatmap) da trajetoria.
- Calcular tempo por zona.
- Exportar imagens PNG de resultado.
- Exportar CSV com posicoes e timestamps.

## Fase 1 — Importacao opcional da API PHP

- Importar torneios, equipes e partidas da API PHP.
- Manter funcionamento local quando sem rede.

## Fase 2 — Upload de resultados

- Enviar pacote de analise para a API PHP.
- Pacote: manifest.json, positions.csv, zones.csv, trajectory.png, heatmap.png.

## Fase 3 — Visualizacao web

- Dashboard web consome dados enviados pelo app local.
- Pertence a integracao api/ + client/, nao ao MVP.

## Fase 4 — Simulador Unreal Engine

- Reconstruir partidas a partir dos dados da API PHP.
- Enviar resultados do simulador para a API.
