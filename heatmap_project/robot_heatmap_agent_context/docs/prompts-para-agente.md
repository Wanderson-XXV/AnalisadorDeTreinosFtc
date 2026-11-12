# Prompts úteis para o agente

## Prompt inicial

Crie o repositório `robot-heatmap-scout` com base nos arquivos de contexto fornecidos. Priorize a implementação do Arena Configurator antes do tracker. Não implemente YOLO, dashboard web ou reconhecimento automático de robôs nesta fase.

O primeiro objetivo é carregar uma imagem PNG top-down da arena, permitir desenhar zonas e pontos de referência, salvar um YAML e reabrir esse YAML renderizando as zonas por cima da imagem.

## Prompt para primeira implementação

Implemente `scripts/arena_configurator.py` usando Python, OpenCV e PyYAML. A ferramenta deve abrir uma imagem, permitir desenhar zonas poligonais por cliques, marcar pontos de referência e exportar um YAML compatível com `configs/fields/field_example.normalized.yaml`.

Mantenha o código simples. Não implemente interface web. Não implemente tracker ainda.

## Prompt para revisar arquitetura

Revise a estrutura do repositório e confirme se o projeto está seguindo esta ordem:

1. Arena Configurator
2. Video Calibration
3. Tracker Human-in-the-loop
4. Visualizações
5. Métricas

Aponte qualquer parte que esteja complexa demais para o MVP.

## Prompt para calibração

Implemente `scripts/calibrate_video.py` e `scripts/test_video_to_field.py`. Eles devem carregar o `field.yaml`, pedir cliques no vídeo para os pontos de referência, calcular homografia e permitir testar clique no vídeo -> ponto na arena.

Não implemente tracking nesta etapa.

## Prompt para tracking

Implemente `scripts/track_robot.py` usando OpenCV CSRT. O script deve selecionar manualmente uma ROI, rastrear o robô, projetar o centro da bounding box na arena usando a calibração e salvar `positions.csv`.
