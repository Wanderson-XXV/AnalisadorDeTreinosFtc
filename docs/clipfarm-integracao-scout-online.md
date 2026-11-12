# Estudo: integracao ClipFarm no Scout Online

Data do estudo: 2026-07-08

Superficie principal: `api/` + `client/` (Scout Online).

Fora de escopo neste passo: conectar o heatmap local Python ao backend online, baixar videos automaticamente, criar endpoints remotos para o heatmap ou mudar a arquitetura offline-first do `heatmap_project/`.

## Resumo executivo

Integrar ClipFarm e uma boa evolucao para o Scout Online.

O caminho mais forte nao e pedir que alunos subam videos grandes para o nosso servidor. O melhor MVP e tratar videos como midia externa vinculada a partida: YouTube/ClipFarm entram como links embedaveis, ficam salvos no nosso banco por partida, aparecem na galeria/analise, e podem ser usados na tela de scout com um offset manual de inicio real da partida.

O teste no evento do Mundial indicado retornou:

- Evento: `2026 FIRST World Championships`, ClipFarm id `cmnqxlbzy0000rv9klfqfpgiq`.
- `events.getEventMatches`: 948 partidas retornadas.
- 947 partidas com clipe.
- 946 clips marcados como `youtube`.
- 1 clip marcado como `direct-cdn`, mas com URL `youtu.be`, entao o importador deve normalizar pelo conteudo da URL tambem.
- 1 partida sem clipe.
- 911 IDs unicos de YouTube para 947 URLs, entao nao devemos deduplicar somente por video id. O id de partida/clip do ClipFarm tambem importa.

Conclusao: da para fazer importacao assistida/automatica dos links do ClipFarm com dados publicos consumidos pelo proprio site. A dependencia mais sensivel e que a API tRPC do ClipFarm nao parece documentada publicamente; por isso o sistema deve importar e persistir os links, nao depender do ClipFarm em tempo real toda vez que o usuario abrir uma partida.

## Estado atual apos o teste Ross

Implementado e validado no Scout Online:

- `matches` agora guarda `source_match_id`, `source_match_number` e `source_system`.
- `match_media` agora aceita midia externa com `source_type`, `external_provider`, `external_url`, `external_event_id`, `external_match_id`, `external_clip_id`, `thumbnail_url`, `metadata_json`, `video_match_start_ms` e `video_duration_ms`.
- Endpoint `api/clipfarm_import.php` faz preview/importacao por URL ou ID de evento ClipFarm.
- Endpoint `api/media.php` aceita `POST application/json` para link manual rapido.
- Tela de gerenciamento de campeonatos ganhou bloco "Importar videos ClipFarm".
- Modal de partida ganhou modo "Link" em "Adicionar Midia", com campo opcional de inicio real da partida em segundos.
- Galeria, modal de partida e perfil de equipe resolvem corretamente URL local ou externa.

Teste real feito em `api/data.db` com:

```json
{
  "clipfarm_event_url": "https://www.clipfarm.watch/en/events/cmnqxlbzy0000rv9klfqfpgiq",
  "event_code": "FTCCMP1ROSS"
}
```

Resultado da preview antes de gravar:

```json
{
  "matches_found": 154,
  "matched": 153,
  "unmatched": 1,
  "ambiguous": 0,
  "matches_without_clips": 0,
  "clips_found": 154,
  "media_created": 153,
  "media_updated": 0
}
```

Resultado gravado:

- 153 links ClipFarm/YouTube vinculados a partidas Ross.
- 153 partidas Ross com `source_match_number` preservado.
- Playoffs ficaram com exibicao normalizada (`M1`, `M2`, etc.) e bruto preservado (`21001`, `22001`, etc.).
- A unica partida sem par local foi `FTCCMP1ROSS` qualificatoria `24`; a ClipFarm tem o clipe, mas a partida nao existe/nao casou no banco local atual.
- Reexecutar em dry-run depois da importacao retornou `media_created: 0` e `media_updated: 153`, confirmando upsert sem duplicar.

Checagem visual:

- `http://localhost:5173/championship-management` mostra o bloco ClipFarm.
- A divisao Ross mostra as partidas carregadas.
- Abrir `M1` mostra "VIDEOS DA PARTIDA" com o video importado.
- Clicar no video abriu iframe `https://www.youtube.com/embed/b3AAF5vQSho?autoplay=1`.
- O modo manual "Link" mostra URL, inicio da partida em segundos e "Salvar link".

## Fluxo operacional recomendado

### Quando o evento esta na ClipFarm

1. Importar/atualizar partidas pelo FTCScout primeiro, mantendo `event_code` correto na divisao.
2. Abrir `Campeonatos`.
3. Em "Importar videos ClipFarm", colar a URL do evento.
4. Preencher `Codigo externo` quando quiser limitar a uma divisao, por exemplo `FTCCMP1ROSS`.
5. Rodar "Previa".
6. Se a preview mostrar casamentos corretos, rodar "Importar".
7. Repetir durante o evento sempre que novos clipes aparecerem; o upsert atualiza sem duplicar.

### Quando so existe link manual

1. Abrir a partida.
2. Clicar em "Adicionar Midia".
3. Escolher "Link".
4. Colar o YouTube do clipe/partida.
5. Se souber, preencher o inicio real da partida no video em segundos.
6. Salvar.

Esse caminho manual e importante para torneio ao vivo: se alguem clipar no YouTube antes da ClipFarm sincronizar tudo, o scout ja ganha o video na partida sem upload pesado.

## O que foi testado no ClipFarm

### Pagina e bundles

URLs testadas:

- `https://www.clipfarm.watch/en`
- `https://www.clipfarm.watch/en/events/cmnqxlbzy0000rv9klfqfpgiq`

Achados:

- O site e um app Next.js.
- A pagina publica consome `https://www.clipfarm.watch/api/trpc`.
- O HTML tambem referencia `https://relay.clipfarm.watch` e `https://clipfarm-mock-api.clipfarm.workers.dev`.
- O bundle da pagina de evento chama:
  - `events.getById`
  - `events.getDivisions`
  - `events.getTeams`
  - `events.getEventMatches`
  - `events.getMatchClipsFromMatchName`
  - `clips.recordView`

### Endpoint do evento

Chamada validada:

```text
GET https://www.clipfarm.watch/api/trpc/events.getById?input=...
```

Input usado:

```json
{"json":{"id":"cmnqxlbzy0000rv9klfqfpgiq"}}
```

Campos relevantes retornados:

```json
{
  "id": "cmnqxlbzy0000rv9klfqfpgiq",
  "code": "FTCCMP1",
  "name": "2026 FIRST World Championships",
  "season": 2026,
  "ftcScoutSeason": 2025,
  "ftcScoutEventCode": "FTCCMP1",
  "status": "completed",
  "location": "Houston, TX",
  "divisions": [
    {
      "name": "Ross",
      "code": "FTCCMP1ROSS",
      "ftcScoutSeason": 2025,
      "ftcScoutEventCode": "FTCCMP1ROSS",
      "streamType": "youtube"
    }
  ]
}
```

Divisoes encontradas:

| Divisao | FTCScout event code |
| --- | --- |
| da Vinci | `FTCCMP1` |
| Goodall | `FTCCMP1GOOD` |
| Jackson | `FTCCMP1JACK` |
| Ross | `FTCCMP1ROSS` |
| Franklin | `FTCCMP1FRAN` |
| Edison | `FTCCMP1EDIS` |
| Lovelace | `FTCCMP1LOVE` |

### Endpoint de partidas

Chamada validada:

```text
GET https://www.clipfarm.watch/api/trpc/events.getEventMatches?batch=1&input=...
```

Input usado:

```json
{"0":{"json":{"eventId":"cmnqxlbzy0000rv9klfqfpgiq"}}}
```

A resposta veio como lista de partidas com este formato:

```json
{
  "id": "ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1EDIS-1",
  "number": 1,
  "type": "qualification",
  "divisionId": "cmnxwe06a0003l104kvj7k01k",
  "red": [26501, 506],
  "blue": [7477, 19066],
  "winner": "blue",
  "redScore": 324,
  "blueScore": 365,
  "clips": [
    {
      "type": "youtube",
      "url": "https://youtu.be/T3LgNHkZg6s?si=732uLTCEi1vsEC8F",
      "duration": 0
    }
  ]
}
```

Resumo por divisao:

| Divisao | Partidas | Com clip |
| --- | ---: | ---: |
| Edison | 157 | 157 |
| Franklin | 157 | 157 |
| Jackson | 152 | 152 |
| Ross | 154 | 154 |
| Lovelace | 157 | 157 |
| Goodall | 154 | 154 |
| da Vinci | 17 | 16 |

Tipos:

| Tipo ClipFarm | Quantidade |
| --- | ---: |
| `qualification` | 847 |
| `playoff` | 101 |

### Endpoint de clipe pontual

Chamada validada:

```text
GET https://www.clipfarm.watch/api/trpc/events.getMatchClipsFromMatchName?batch=1&input=...
```

Input usado:

```json
{
  "0": {
    "json": {
      "eventId": "cmnqxlbzy0000rv9klfqfpgiq",
      "matchNumber": 1,
      "matchId": "ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1EDIS-1"
    }
  }
}
```

Resposta:

```json
[
  {
    "id": "cmowamyh50001le04lllw8at7",
    "title": "Q1",
    "type": "youtube",
    "url": "https://youtu.be/T3LgNHkZg6s?si=732uLTCEi1vsEC8F",
    "duration": 0,
    "views": 3,
    "status": "published",
    "teams": ["26501", "506", "7477", "19066"]
  }
]
```

### Endpoint que nao serviu

Chamada testada:

```text
GET https://clipfarm-mock-api.clipfarm.workers.dev/v2/matches/ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1EDIS-1
```

Resultado:

```json
{"message":"Match not found"}
```

Nao recomendo depender deste endpoint para o nosso importador.

### YouTube embed/oEmbed

Chamada validada:

```text
GET https://www.youtube.com/oembed?url=https%3A%2F%2Fyoutu.be%2FT3LgNHkZg6s&format=json
```

Resultado relevante:

- Titulo: `Qualification 1 - FIRST Championship - FIRST Tech Challenge - Edison`
- Provider: YouTube
- Thumbnail: `https://i.ytimg.com/vi/T3LgNHkZg6s/hqdefault.jpg`
- Iframe embed oficial: `https://www.youtube.com/embed/T3LgNHkZg6s?...`

### Teste visual com Playwright

Comando executado:

```powershell
npx --yes playwright screenshot --timeout=60000 --wait-for-selector "iframe[title='Match video']" "https://www.clipfarm.watch/en/events/cmnqxlbzy0000rv9klfqfpgiq?match=ftcscout-cmnqxlbzy0000rv9klfqfpgiq-2025-FTCCMP1EDIS-1" output\playwright\clipfarm-event-match-modal.png
```

Resultado:

- A pagina abriu com o modal da partida.
- O seletor `iframe[title='Match video']` apareceu.
- A captura ficou em `output/playwright/clipfarm-event-match-modal.png`.
- O frame do YouTube aparece preto no screenshot headless, mas o DOM carregou o iframe correto. Isso e esperado em captura headless/autoplay.

## Estado atual do nosso repo

### Backend de midia

Arquivo: `api/media.php`

Hoje o endpoint de midia trabalha como upload de arquivo:

- `POST /media.php` exige `$_FILES['file']`.
- `match_media.file_path` guarda caminho local do arquivo.
- `thumbnail_path` e opcional.
- `GET /media.php?match_id=...` lista midias da partida.

Tabela atual em `api/config.php`:

```text
match_media (
  id,
  match_id,
  filename,
  original_filename,
  file_path,
  file_type,
  file_size,
  mime_type,
  category,
  title,
  description,
  tagged_teams,
  uploaded_by,
  uploaded_at,
  thumbnail_path
)
```

### Frontend de midia

Arquivo: `client/app/components/championships/MediaGallery.tsx`

O frontend ja tem uma brecha boa:

- `isYoutube(item.file_path)` detecta `youtube.com` e `youtu.be`.
- Se for YouTube, usa thumbnail `https://img.youtube.com/vi/{id}/mqdefault.jpg`.
- No lightbox, renderiza iframe `https://www.youtube.com/embed/{id}?autoplay=1`.

Ou seja: se uma linha `match_media` externa existir com `file_type = video`, `category = full_match` e `file_path = url do YouTube`, a galeria atual ja esta perto de tocar o video.

Limites atuais:

- O backend ainda nao cria esse tipo de registro por JSON/link.
- `MatchMedia` no TypeScript so conhece `image | video`; ainda nao distingue `local`, `youtube`, `clipfarm`, `hls`, `direct-cdn`.
- `matches.php` busca `first_video_thumb` apenas quando existe `thumbnail_path`; links externos podem nao aparecer com thumb na lista.
- O player atual nao possui API de seek por ciclo.

### Tela de scout

Arquivo: `client/app/routes/scouting.tsx`

Hoje a rota renderiza:

```tsx
<ChampionshipTimer scoutingRoundId={id!} />
```

Arquivo principal: `client/app/components/championships/ChampionshipTimer.tsx`

O timer:

- Carrega `scoutingRound` via `useScoutingRound`.
- `scouting.php` ja retorna `match`.
- Ciclos sao salvos em `scouting_cycles.timestamp` como milissegundos desde o inicio do scouting/partida.
- A tela atual e centralizada (`max-w-3xl`) e nao carrega midias da partida.

Isso encaixa bem com a proposta de layout dividido:

- esquerda ou topo: video da partida;
- direita ou abaixo: timer, botao de marcar ciclo, resumo e lista de ciclos;
- desktop: duas colunas;
- celular/tablet: abas ou video recolhivel.

## Cruzamento com a base local

Base local atual (`api/data.db`) no momento do estudo:

- `championships`: 3
- `matches`: 297
- `match_media`: 37
- `scouting_rounds`: 161
- `scouting_cycles`: 1776

O grupo mundial local encontrado:

```json
{
  "name": "FIRST Championship - FIRST Tech Challenge",
  "short_name": "Mundial DECODE 25/26",
  "season": "2025",
  "event_code": "FTCCMP1",
  "scope_type": "event_group"
}
```

Divisao local importada:

```json
{
  "name": "FTCScout FTCCMP1ROSS",
  "season": "2025",
  "event_code": "FTCCMP1ROSS",
  "scope_type": "division"
}
```

Cruzamento Ross:

- Matches locais mundiais: 153.
- Matches locais Ross: 153.
- Matches com chave unica ClipFarm por `season + event_code + type + number`: 139.
- Ambiguos: 0.
- Sem match por chave simples: 14.

Motivo dos 14 sem match:

- Sao playoffs.
- ClipFarm usa numeros brutos do FTCScout: `21001`, `22001`, `23001` etc.
- Nosso importador normaliza playoffs para `M1`, `M2`, `M3` etc.

Exemplo Ross:

```text
Local: match_type=elimination, match_number=1, display_name=M1
ClipFarm: type=playoff, number=21001
```

Impacto:

- Para qualificatorias, a chave simples e suficiente.
- Para playoffs, precisamos de uma destas estrategias:
  - guardar no nosso `matches` o `source_match_id`/`external_match_number` original do FTCScout no momento da importacao;
  - ou casar playoffs por conjunto de times das aliancas e revisar quando houver terceiro time reserva/no-show;
  - ou manter uma tela de preview com "nao casados" para o operador confirmar.

## Modelo de dados recomendado

Manter `match_media` como tabela central, mas expandir para midia externa.

Colunas novas sugeridas:

```text
source_type TEXT DEFAULT 'local'
external_provider TEXT
external_url TEXT
external_id TEXT
external_event_id TEXT
external_match_id TEXT
external_clip_id TEXT
video_match_start_ms INTEGER
video_duration_ms INTEGER
thumbnail_url TEXT
metadata_json TEXT
```

Sem quebrar compatibilidade:

- Para arquivos locais: `source_type = 'local'`, `file_path` continua caminho local.
- Para YouTube/ClipFarm: `source_type = 'youtube'` ou `clipfarm`, `external_url` guarda o link original, `file_path` pode temporariamente espelhar a URL para compatibilidade com `MediaGallery`.
- `thumbnail_url` evita depender de `thumbnail_path` local.
- `metadata_json` guarda payload original do ClipFarm para auditoria e futuras migracoes.

Restricoes/indices recomendados:

```text
idx_media_external_match ON match_media(external_provider, external_match_id)
idx_media_external_clip ON match_media(external_provider, external_clip_id)
idx_media_match_category ON match_media(match_id, category)
```

Unicidade pratica:

```text
provider + external_clip_id
```

Fallback se nao houver clip id:

```text
match_id + category + external_provider + external_url
```

## Fluxo de importacao ClipFarm

### Entrada do operador

Na tela de gerenciamento de campeonato, adicionar uma acao:

```text
Importar clips do ClipFarm
```

Entrada principal:

```text
URL do evento ClipFarm
```

Exemplo:

```text
https://www.clipfarm.watch/en/events/cmnqxlbzy0000rv9klfqfpgiq
```

O sistema extrai:

```text
cmnqxlbzy0000rv9klfqfpgiq
```

### Dry-run/preview

O backend chama:

1. `events.getById`
2. `events.getEventMatches`

Depois cruza:

```text
ClipFarm ftcScoutSeason -> championships.season
ClipFarm division.ftcScoutEventCode -> championships.event_code
ClipFarm match.type qualification -> matches.match_type qualification
ClipFarm match.type playoff -> matches.match_type elimination
ClipFarm match.number -> matches.match_number, quando qualification
```

Para playoffs:

1. tentar `external_match_number/source_match_id`, se existir no futuro;
2. tentar composicao de aliancas;
3. deixar para revisao manual quando nao for seguro.

Preview recomendado:

```text
Evento ClipFarm: 2026 FIRST World Championships
Campeonato local: Mundial DECODE 25/26
Divisoes encontradas: Edison, Franklin, Jackson, Ross, Lovelace, Goodall, da Vinci
Partidas no ClipFarm: 948
Clips encontrados: 947
Casamentos automaticos: N
Ja existentes: N
Novos links: N
Sem match local: N
Ambiguos: N
Sem clip: N
```

Lista de revisao:

- division;
- match display;
- times vermelho/azul;
- URL do clip;
- status: novo, existente, sem match, ambiguo.

### Upsert

Para cada match casado:

- criar/atualizar `match_media`;
- `category = full_match`;
- `file_type = video`;
- `source_type = youtube` quando URL for YouTube, mesmo se ClipFarm `type` vier como `direct-cdn`;
- `external_provider = clipfarm`;
- `external_event_id = ClipFarm event id`;
- `external_match_id = ClipFarm match id`;
- `external_clip_id = ClipFarm clip id`, se disponivel;
- `external_url = clip url`;
- `title = Q1`, `Qualification 1`, ou formato local;
- `tagged_teams = [todos os times da partida]`;
- `video_match_start_ms = null` inicialmente.

## Tela de scout com video

### Objetivo

Permitir que o scout seja feito olhando o video da partida ao lado do cronometro.

Primeiro MVP:

- carregar o video `full_match` da partida;
- mostrar player ao lado do `ChampionshipTimer`;
- permitir "definir inicio da partida neste ponto";
- salvar `video_match_start_ms`;
- permitir que clique em ciclo pule para:

```text
video_match_start_ms + cycle.timestamp
```

### Componente sugerido

```text
MatchVideoPanel
```

Responsabilidades:

- escolher video principal da partida;
- renderizar YouTube iframe ou video HTML;
- expor comandos:
  - play;
  - pause;
  - seekTo(ms);
  - getCurrentTime();
- exibir/editar offset da partida;
- abrir fallback em YouTube/ClipFarm.

Para YouTube, usar a YouTube IFrame Player API em vez de recriar iframe a cada seek. Isso evita recarregar o video quando o usuario clica em varios ciclos.

### Layout sugerido

Desktop:

```text
[ Video 56% ][ Timer + controles + ciclos 44% ]
```

Mobile/tablet:

```text
[ Video ]
[ Timer ]
[ Ciclos ]
```

Ou tabs:

```text
Video | Scout | Ciclos
```

### Offset manual

Campo recomendado no registro de midia:

```text
video_match_start_ms
```

Comandos de UI:

- "Marcar inicio da partida aqui"
- "-1s"
- "+1s"
- "Testar inicio"
- "Limpar offset"

Por que no registro de midia, e nao na partida:

- uma partida pode ter mais de um video;
- um video pode ser substituido;
- o mesmo match pode ter ClipFarm, YouTube manual e arquivo local com offsets diferentes.

### Ciclos clicaveis

Hoje `CycleList` recebe `onEdit`.

Evolucao:

```tsx
<CycleList
  cycles={localCycles}
  onEdit={handleEditCycle}
  onSeek={cycle => video.seekTo(videoMatchStartMs + cycle.timestamp)}
/>
```

No modo de scout ao vivo, clicar no ciclo pode ser menos importante.

No modo de analise/review, clicar no ciclo vira a interacao principal.

## Analise pos-partida

Na visualizacao de scouting salvo (`ScoutingViewModal` e/ou pagina de analise), adicionar:

- video da partida;
- lista de ciclos da equipe;
- clique no ciclo para pular para o momento;
- filtro por autonomo/teleop;
- marcador visual de acerto/erro/zona.

Isso da valor antes mesmo do heatmap:

- aluno revê se marcou certo;
- drive team assiste so os ciclos importantes;
- mentor salta direto para problemas de robo;
- evita ficar procurando manualmente no YouTube.

## Ponte futura com heatmap

Nao implementar integracao remota agora.

O contrato futuro mais seguro e um manifesto local/exportavel:

```json
{
  "match": {
    "id": "local-match-id",
    "season": "2025",
    "event_code": "FTCCMP1ROSS",
    "match_type": "qualification",
    "match_number": 1
  },
  "video": {
    "provider": "youtube",
    "url": "https://youtu.be/...",
    "clipfarm_event_id": "cmnqxlbzy0000rv9klfqfpgiq",
    "clipfarm_match_id": "ftcscout-...",
    "match_start_ms": 12340
  },
  "cycles": [
    {
      "cycle_number": 1,
      "team_number": 14270,
      "timestamp_ms": 21500,
      "duration_ms": 4300,
      "phase": "teleop",
      "zone": "near",
      "hits": 1,
      "misses": 0
    }
  ]
}
```

O `heatmap_project/` pode consumir esse manifesto no futuro, mas ainda offline-first:

- o Scout Online exporta dados;
- a ferramenta local recebe o manifesto;
- se o tracker precisar do arquivo de video local, o operador fornece o arquivo ou um fluxo separado prepara esse arquivo;
- nao exigir login, API PHP ou upload remoto no MVP do heatmap.

## Riscos e mitigacoes

### API ClipFarm nao documentada

Risco: rotas tRPC ou formato mudarem.

Mitigacao:

- usar importacao pontual, nao dependencia em tempo real;
- armazenar payload original em `metadata_json`;
- deixar importador com mensagens claras de erro;
- permitir cadastro manual de link.

### YouTube embed pode falhar

Risco: video removido, restricao de embed, cookie/autoplay, rede escolar.

Mitigacao:

- sempre mostrar botao "Abrir no YouTube";
- permitir outro link/manual;
- salvar thumbnail se disponivel;
- player deve falhar sem quebrar a tela de scout.

### Dedupe por YouTube ID e perigoso

Risco: 947 URLs do teste deram 911 IDs unicos.

Mitigacao:

- deduplicar por `external_clip_id` quando existir;
- caso contrario, por `match_id + provider + external_url`;
- guardar `external_match_id` do ClipFarm.

### Playoffs tem numeracao divergente

Risco: qualificatorias batem por numero; playoffs podem nao bater.

Mitigacao:

- guardar `source_match_id`/`source_match_number` do FTCScout em importacoes futuras;
- para dados atuais, casar playoffs por aliancas e revisar;
- nao fazer upsert automatico de playoff quando houver ambiguidade.

### Ciclo depende de offset correto

Risco: se o usuario marcar o inicio errado, os saltos ficam deslocados.

Mitigacao:

- ajuste fino `-1s/+1s`;
- botao "testar inicio";
- permitir offset por video;
- mostrar se o offset ainda nao foi calibrado.

### Heatmap com YouTube

Risco: tracking OpenCV normalmente precisa de arquivo/frame local, e baixar YouTube pode bater em termos de uso.

Mitigacao:

- por enquanto exportar manifesto e nao baixar;
- manter o heatmap offline-first;
- quando chegar nessa fase, definir fluxo explicito para arquivo local autorizado ou fonte de video permitida.

## Plano recomendado

### Fase 1: link externo manual (MVP implementado)

Objetivo: provar valor sem depender de ClipFarm API.

Mudancas:

- permitir adicionar link YouTube/ClipFarm em midia da partida: feito;
- salvar como `match_media`: feito;
- galeria renderiza link externo: feito;
- lista de partidas mostra thumbnail externa: feito para `thumbnail_url`;
- permitir `video_match_start_ms` manual: backend e formulario inicial feitos.

Teste:

- adicionar link do Edison Q1;
- abrir galeria;
- abrir lightbox;
- salvar offset;
- reabrir e confirmar persistencia.

### Fase 2: importador ClipFarm com preview (MVP implementado)

Objetivo: preencher dezenas/centenas de partidas automaticamente.

Mudancas:

- acao "Importar clips do ClipFarm": feita na gestao de campeonatos;
- backend PHP busca tRPC: feito com cURL e fallback;
- preview de casamentos: feito;
- upsert de links: feito sem duplicar.

Teste:

- usar evento `cmnqxlbzy0000rv9klfqfpgiq`;
- validar Ross local: 153 de 154 partidas casadas;
- playoffs casaram automaticamente porque os numeros brutos `21001`, `22001`, etc. sao preservados em `source_match_number`.

### Fase 3: scout com video ao lado

Objetivo: fazer scout assistindo ao video.

Mudancas:

- `scouting.tsx` deixa de limitar tudo a `max-w-3xl`;
- `ChampionshipTimer` recebe/usa video panel;
- carregar midia por `match.id`;
- YouTube IFrame API para seek;
- `CycleList` ganha `onSeek`.

Teste:

- criar scouting round;
- abrir com video;
- definir offset;
- marcar 2 ciclos;
- finalizar;
- clicar ciclos e verificar salto.

### Fase 4: review pos-partida

Objetivo: transformar dados de scout em replay navegavel.

Mudancas:

- modal/pagina de scouting salvo com video + ciclos clicaveis;
- filtros por fase/time/zona;
- abrir video no momento do ciclo.

### Fase 5: manifesto para heatmap

Objetivo: preparar a futura ponte sem quebrar offline-first.

Mudancas:

- exportar `replay_manifest.json`;
- incluir video URL, offset e ciclos;
- ferramenta local decide depois como usar.

## Decisao recomendada

Implementar primeiro a Fase 1 e Fase 2.

Motivo:

- entrega valor rapido;
- reduz uso de internet/servidor;
- aproveita a galeria de midia existente;
- nao mistura heatmap antes da hora;
- deixa a tela de scout com video muito mais simples depois, porque os videos ja estarao normalizados como midia da partida.

Depois disso, a Fase 3 vira uma evolucao natural: a tela de scout so precisa consumir a midia principal e controlar o offset/seek.
