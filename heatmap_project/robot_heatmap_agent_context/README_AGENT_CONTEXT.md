# Pacote de contexto — Robot Heatmap Scout

Este pacote foi feito para ser entregue a um agente de desenvolvimento para preparar o repositório do projeto.

## Ordem recomendada de leitura

1. `00_CONTEXT_MASTER.md`
2. `AGENTS.md`
3. `docs/roadmap.md`
4. `docs/integracao-futura-api-php.md`
5. `docs/arena-configurator.md`
6. `docs/coordenadas-calibracao.md`
7. `tasks/01-arena-configurator.md`
8. `tasks/02-video-calibration.md`
9. `tasks/03-tracker-human-in-the-loop.md`
10. `docs/acompanhamento.md`

## Ideia principal

O projeto deve começar pela ferramenta de configuração da arena, não pelo tracker.

A primeira meta é criar uma ferramenta que recebe uma imagem PNG top-down da arena, permite desenhar zonas e pontos de referência, e exporta um YAML reutilizável.

Depois disso, o projeto deve calibrar um vídeo real para essa arena e só então rastrear um robô com abordagem human-in-the-loop.

O MVP deve ser local e offline-first. A API PHP online será o hub futuro para trocar dados com o site e com um simulador Unreal Engine, mas essa integração não deve bloquear o Arena Configurator nem o fluxo inicial de heatmap.
