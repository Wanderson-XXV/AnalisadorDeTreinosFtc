# Contexto mestre — Robot Heatmap Scout

## 1. Resumo do projeto

Criar um repositório para um sistema de scouting visual de robôs em partidas de robótica, inspirado em mapas de calor usados em futebol.

O projeto deve transformar vídeos de partidas em dados táticos, como:

- trajetória do robô;
- mapa de calor;
- tempo por zona;
- áreas mais ocupadas;
- comportamento espacial por equipe;
- comparação entre partidas;
- suporte futuro para múltiplos robôs e múltiplas equipes.

A abordagem inicial deve ser **human-in-the-loop**. O sistema não deve tentar reconhecer robôs automaticamente no MVP. Uma pessoa deve ajudar o sistema marcando pontos, zonas e selecionando o robô quando necessário.

## 2. Mudança importante de prioridade

A ordem correta do MVP é:

1. **Arena Configurator**
2. **Video Calibration**
3. **Tracker Human-in-the-loop**
4. **Visualizações e métricas**

O tracker deve vir depois da arena configurada, porque o valor real do sistema não é apenas seguir uma caixa no vídeo, mas traduzir a posição do robô para uma visão tática da arena.

Outra prioridade importante: o MVP deve ser **local e offline-first**.

A API PHP online será o centro de integração no futuro, mas o primeiro fluxo do heatmap não deve depender de login, rede, banco online, endpoints PHP, upload remoto ou mock remoto obrigatório.

## 3. Objetivo atual

Preparar o repositório para seguir uma trilha de desenvolvimento clara.

O primeiro objetivo prático será:

> Criar uma ferramenta que carrega um PNG top-down da arena, permite desenhar zonas e pontos de referência, e exporta um YAML reutilizável.

O usuário já possui um vídeo baixado localmente para testar depois.

## 4. Por que começar pelo Arena Configurator

A ferramenta de arena será a base de todo o sistema.

Ela permitirá:

- usar uma imagem top-down da arena como mapa tático;
- desenhar zonas manualmente;
- nomear áreas importantes;
- marcar pontos de referência;
- exportar configuração em YAML;
- reutilizar a mesma arena em vários vídeos;
- adaptar o projeto para outras arenas/jogos no futuro.

Sem essa etapa, o tracker geraria apenas pontos soltos. Com a arena configurada, o tracker gera dados com significado.

## 5. Escopo do MVP

### Fazer agora

- Estrutura inicial do repositório.
- Documentação de arquitetura e acompanhamento.
- Ferramenta `arena_configurator.py`.
- Carregar PNG top-down da arena.
- Criar campo normalizado `1000x1000`.
- Desenhar zonas como polígonos.
- Marcar pontos de referência.
- Exportar `field.yaml`.
- Reabrir `field.yaml` e renderizar as zonas por cima da imagem.
- Depois: calibrar vídeo usando pontos de referência.
- Depois: testar clique no vídeo -> ponto na arena.
- Depois: tracker human-in-the-loop.
- Documentar contratos futuros com API PHP sem implementar a integração no MVP.

### Não fazer agora

- YOLO.
- Reconhecimento automático de equipe.
- Dashboard web complexo.
- Banco de dados robusto.
- Detecção automática de todos os robôs.
- Normalização avançada vermelho/azul.
- Leitura automática do manual do jogo.
- Parsing direto de CAD.
- Relatório estatístico sofisticado.
- Integração obrigatória com API PHP.
- Login ou autenticação online no app local.
- Upload remoto de heatmaps.
- Dependência de banco online para testar o Arena Configurator.

## 6. Stack sugerida

Linguagem:

- Python

Bibliotecas iniciais:

- opencv-contrib-python
- numpy
- pandas
- matplotlib
- scipy
- pyyaml

Instalação:

```bash
pip install opencv-contrib-python numpy pandas matplotlib scipy pyyaml
```

Opcional no futuro:

- streamlit;
- plotly;
- fastapi;
- react;
- ultralytics/yolo;
- bytetrack/deepsort.

## 7. Conceitos centrais

O sistema deve separar claramente:

### Arena tática

Representação top-down da arena.

Pode começar com:

```yaml
field:
  unit: "normalized"
  width: 1000
  height: 1000
```

### Imagem da arena

PNG top-down usado como referência visual para desenhar zonas.

Exemplo:

```text
assets/arenas/the_code_topdown.png
```

### Configuração da arena

Arquivo YAML gerado pelo configurador.

Exemplo:

```text
configs/fields/the_code.yaml
```

### Calibração de vídeo

Arquivo que liga pontos do vídeo real aos pontos de referência da arena.

Exemplo:

```text
calibrations/match_q12.yaml
```

### Tracking

Rastreamento do robô no vídeo original, convertendo a posição para a arena tática.

### Pacote local de análise

Conjunto de artefatos gerados por uma análise local.

Exemplo:

```text
outputs/analyses/match_q12_team_16049/
├── manifest.json
├── positions.csv
├── zones.csv
├── trajectory.png
├── heatmap.png
├── field.yaml
└── calibration.yaml
```

Esse pacote deve ser suficiente para validar o fluxo local agora e, no futuro, servir como base para upload para a API PHP.

### API PHP futura

O sistema PHP online deve ser o hub de dados entre o scout web, o app local Python e um simulador futuro em Unreal Engine.

Essa integração deve ser planejada, mas não implementada no MVP do heatmap.

## 8. Princípio de projeto

O projeto deve ser útil rápido.

Priorizar:

1. funcionar;
2. ser visual;
3. ser fácil de testar;
4. salvar tudo em YAML/CSV;
5. permitir correção humana;
6. evitar arquitetura complexa antes do primeiro fluxo funcionar.
7. não bloquear o MVP em integração online.

## 9. Primeira prova de valor

O primeiro marco importante será abrir uma imagem top-down da arena, desenhar zonas e gerar um YAML.

O segundo marco será abrir esse YAML e mostrar a arena com as zonas desenhadas.

O terceiro marco será calibrar um frame de vídeo para essa arena e clicar em pontos do vídeo, vendo esses pontos aparecerem na visão tática.

Só depois disso o tracker deve entrar.
