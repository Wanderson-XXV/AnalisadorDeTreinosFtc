# Tarefa 02 — Video Calibration

## Status: CONCLUIDO

## Objetivo

Calibrar um frame de video para a arena configurada usando pontos de referencia e homografia.

## Dependencia

Requer Arena Configurator concluido (Tarefa 01).

## Entradas esperadas

- Frame de video (PNG extraido ou capturado).
- YAML da arena configurada com pontos de referencia.

## Requisitos funcionais

- [x] Abrir video em janela OpenCV e escolher frame util.
- [x] Clicar nos pontos de referencia visiveis no frame.
- [x] Associar cada clique a um ponto de referencia do YAML.
- [x] Permitir pular pontos invisiveis com `n`.
- [x] Calcular homografia com `cv2.findHomography` usando 4+ pontos usados.
- [x] Salvar calibracao em YAML.
- [x] Registrar pontos pulados e contagens de pontos no YAML.
- [x] Testar conversao: clique no video -> ponto na arena.

## Observacao sobre camera parcial

O video nao precisa mostrar a arena inteira. Para treinos com camera fixa que
enquadra apenas parte da arena, cadastre varios pontos internos no Arena
Configurator e, durante a calibracao, clique somente nos pontos visiveis. Pontos
fora do enquadramento devem ser pulados com `n`.

## Saida esperada

```
calibrations/match_q12.yaml
```

## Proximo passo apos esta tarefa

Tarefa 03 — Tracker Human-in-the-loop.
