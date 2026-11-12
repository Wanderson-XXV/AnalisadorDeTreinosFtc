# FTC Scout System — PRD v1.2

**Projeto:** AnalisadorDeTreinosFtc  
**Temporada:** INTO THE DEEP 2024-2025  
**Data:** 5 de Março de 2026  
**Versão:** 1.2 — Continuação pós-nacional

---

## STATUS DA v1.1 (já implementado)

| Área | Componentes/Arquivos | Status |
|---|---|---|
| Auth simples | `scouts.php`, `useAuth.ts`, `LoginForm.tsx`, `UserBadge.tsx` | ✅ |
| Teams CRUD | `teams.php`, `TeamsList.tsx`, `TeamForm.tsx`, `TeamCard.tsx`, `useTeams.ts` | ✅ |
| Matches CRUD | `matches.php`, `MatchForm.tsx`, `MatchModal.tsx`, `MatchListCard.tsx`, `useMatches.ts` | ✅ |
| Scouting flow | `scouting.php`, `scouting_cycles.php`, `ChampionshipTimer.tsx`, `ScoutingViewModal.tsx`, `useScoutingRound.ts` | ✅ |
| TeamCardInMatch | `TeamCardInMatch.tsx`, `TeamSearchInput.tsx` | ✅ |
| Tipos TS | `types.ts` com todos os tipos de campeonato | ✅ |
| DB Schema | Tabelas: `teams`, `scouts`, `matches`, `scouting_rounds`, `scouting_cycles` | ✅ |

---

## NOVAS FEATURES — v1.2

---

### 1. Mídia no Modal de Partida

#### 1.1 Visão Geral

O `MatchModal` ganha duas novas seções de mídia:

- **Header de vídeos** — logo abaixo do cabeçalho do modal, antes das alianças: exibe os vídeos com `category = 'full_match'` em faixa horizontal, prontos para assistir
- **Galeria geral** — seção no rodapé do modal, após as alianças e placar: todas as mídias da partida organizadas por categoria

#### 1.2 Layout do MatchModal atualizado

```
┌─────────────────────────────────────────────────────────────────┐
│  Q3 — Qualificatória          09:30     [✏️] [🗑️] [✕]          │
├─────────────────────────────────────────────────────────────────┤
│  🎬 VÍDEOS DA PARTIDA                                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │ ▶ Partida  │ │ ▶ Partida  │ ┤ + Upload   │                  │
│  │  Inteira 1 │ │  Inteira 2 │ │            │                  │
│  └────────────┘ └────────────┘ └────────────┘                  │
│  (scroll horizontal, clique abre player em overlay)             │
├─────────────────────────────────────────────────────────────────┤
│  RED ALLIANCE              │  BLUE ALLIANCE                     │
│  [TeamCardInMatch x2]      │  [TeamCardInMatch x2]              │
├─────────────────────────────────────────────────────────────────┤
│  Placar / Vencedor                                              │
├─────────────────────────────────────────────────────────────────┤
│  📷 GALERIA DA PARTIDA                    [+ Adicionar Mídia]   │
│  [Todos] [Momentos-chave] [Outros]                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                          │
│  │img/  │ │img/  │ │img/  │ │ +12  │                          │
│  │video │ │video │ │video │ │ mais │                          │
│  └──────┘ └──────┘ └──────┘ └──────┘                          │
│  (clique abre lightbox; vídeos mostram ▶ overlay)              │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.3 Reprodução de Vídeo

- Arquivos locais (`.mp4`, `.webm`): `<video>` nativo em overlay fullscreen
- URLs do YouTube (detectado por `youtube.com` ou `youtu.be`): `<iframe>` embed
- Thumbnail: frame automático do `<video>` ou thumb da YouTube API para URLs externas

#### 1.4 Database Schema — `match_media`

```sql
CREATE TABLE IF NOT EXISTS match_media (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,          -- relativo: uploads/matches/{match_id}/...
    file_type TEXT NOT NULL,          -- 'image' | 'video'
    file_size INTEGER,
    mime_type TEXT,
    category TEXT NOT NULL,           -- 'full_match' | 'key_moment' | 'other'
    title TEXT,
    description TEXT,
    tagged_teams TEXT,                -- JSON array: [24888, 16052]
    uploaded_by TEXT,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_match ON match_media(match_id);
CREATE INDEX IF NOT EXISTS idx_media_category ON match_media(category);
CREATE INDEX IF NOT EXISTS idx_media_tagged ON match_media(tagged_teams);
```

Adicionar ao `config.php` em `initDatabase()` e migration em `runMigrations()`.

#### 1.5 API — `media.php`

```
GET    /media.php?match_id=X          # Lista mídia de uma partida
GET    /media.php?team_number=X       # Mídia onde a equipe está marcada (tagged_teams)
POST   /media.php                     # Upload — multipart/form-data
       Campos: match_id, category, title?, description?, tagged_teams? (JSON), file
DELETE /media.php?id=X                # Remove mídia e arquivo físico
```

Limites:
- Imagens: máx 10 MB — `image/jpeg`, `image/png`, `image/webp`
- Vídeos: máx 500 MB — `video/mp4`, `video/webm`, `video/quicktime`

Estrutura de pastas no servidor:
```
uploads/
└── matches/
    └── {match_id}/
        ├── full_match/
        ├── key_moments/
        └── other/
```

#### 1.6 Frontend — Novos Componentes

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| `MediaGallery` | `components/championships/MediaGallery.tsx` | Galeria com abas por categoria, lightbox, player de vídeo |
| `MediaUpload` | `components/championships/MediaUpload.tsx` | Modal de upload com campo de categoria, título e marcação de equipes |
| `useMedia` | `hooks/useMedia.ts` | Fetch, upload e delete de mídias de uma partida |

#### 1.7 TypeScript — Tipo `MatchMedia`

Adicionar em `types.ts`:

```typescript
export type MediaCategory = 'full_match' | 'key_moment' | 'other';

export interface MatchMedia {
  id: string;
  match_id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_type: 'image' | 'video';
  file_size: number;
  mime_type: string;
  category: MediaCategory;
  title?: string;
  description?: string;
  tagged_teams?: number[];
  uploaded_by?: string;
  uploaded_at: string;
}
```

Adicionar `media?: MatchMedia[]` na interface `Match` existente.

---

### 2. Marcação de Equipes em Mídias

#### 2.1 No Upload

O `MediaUpload` exibe os 4 times da partida como checkboxes para marcar quem aparece no clipe/foto:

```
Equipes presentes nesta mídia:
☑ #24888 Tech Fenix (Red)
☐ #16052 HYDRA (Red)
☐ #23184 ATLAS (Blue)
☑ #31692 SPARTAN (Blue)
```

Salvo como `tagged_teams = [24888, 31692]` no banco.

#### 2.2 No Perfil da Equipe

A página/aba de perfil da equipe consome `GET /media.php?team_number=X` e exibe galeria de todos os clipes/fotos onde ela foi marcada, independente de qual partida.

```
┌─────────────────────────────────────────────────────────────────┐
│  #24888 Tech Fenix                                              │
│  ─────────────────────────────────────────────────────────────  │
│  [Estatísticas] [Partidas] [Clipes & Fotos ←]                   │
│  ─────────────────────────────────────────────────────────────  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Q3 · Clipe   │ │ Q7 · Foto    │ │ SF1 · Vídeo  │            │
│  │ ▶ thumbnail  │ │ 📷 thumbnail │ │ ▶ thumbnail  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Upload Real de Foto de Equipe (não apenas URL)

#### 3.1 Problema atual

`TeamForm` aceita somente URL de imagem externa. Não há upload de arquivo, o que exige que a foto já esteja hospedada em algum lugar.

#### 3.2 Solução

O `TeamForm` ganha duas abas na seção de logo:

```
Logo da Equipe
[  URL externa  |  Fazer Upload  ]

── Aba "Fazer Upload" ──────────────────────────────────────────
  [  Arraste ou clique para selecionar imagem  ]
  Formatos: JPG, PNG, WEBP · Máx 5 MB

  Preview:
  ┌─────────────────────┐
  │                     │
  │   [imagem aqui]     │   ← atualiza em tempo real
  │                     │
  └─────────────────────┘
────────────────────────────────────────────────────────────────
```

Upload via `POST /teams.php` com `Content-Type: multipart/form-data`. Backend salva em `uploads/teams/{team_number}/logo.{ext}` e devolve o caminho como `logo_url`.

#### 3.3 Editor de Posição — Grid 3×3

Substitui o dropdown atual (`center`, `top`, `bottom`, etc.) por um grid visual clicável:

```
  Posição da imagem:

  ┌───┬───┬───┐
  │ ↖ │ ↑ │ ↗ │   clique em qualquer célula
  ├───┼───┼───┤   para definir o ponto de ancoragem
  │ ← │ ● │ → │   (mapeado para object-position CSS)
  ├───┼───┼───┤
  │ ↙ │ ↓ │ ↘ │
  └───┴───┴───┘
```

| Célula | `logo_position` salvo | CSS resultante |
|---|---|---|
| canto superior esquerdo | `top left` | `object-position: top left` |
| centro topo | `top center` | `object-position: top center` |
| centro | `center` | `object-position: center` |
| etc. | ... | ... |

Expandir o tipo `LogoPosition` em `types.ts` para incluir os 9 valores (`top left`, `top center`, `top right`, `center left`, `center`, `center right`, `bottom left`, `bottom center`, `bottom right`).

---

### 4. Logo das Equipes nos Cards de Partida e Modal

#### 4.1 Problema atual

`MatchListCard` e `TeamCardInMatch` exibem apenas número e nome da equipe, sem foto/logo.

#### 4.2 Solução

Carregar as equipes registradas (`useTeams`) e fazer lookup por `team_number` para obter `logo_url` e `logo_position`. Exibir avatar compacto:

**No `MatchListCard`** — avatar 24×24 px ao lado do número:
```
● #24888 [🖼] Tech Fenix + #16052 [🖼] HYDRA
```

**No `TeamCardInMatch`** — banner 100% width, altura 64 px no topo do card, antes do número/nome:
```
┌─────────────────────────────┐
│  [===== logo banner =====]  │  64px, object-fit: cover
├─────────────────────────────┤
│  #24888  Tech Fenix         │
│  3 ciclos registrados       │
│                [▶ Scout]    │
└─────────────────────────────┘
```

Se `logo_url` for `null`, mostrar placeholder com as iniciais da equipe (fundo na cor da aliança).

#### 4.3 Passagem de dados

Os componentes recebem `teamLogo?: string` e `teamLogoPosition?: string` como props. O `MatchModal` e a página de partidas resolvem o lookup antes de renderizar os cards.

---

### 5. Criação em Lote de Partidas

#### 5.1 Problema atual

Criar partidas uma a uma é lento quando há um campeonato com 30+ qualificatórias.

#### 5.2 Solução — `BulkMatchForm`

Modal com tabela editável inline. Cada linha = uma partida. Botão **"+ Adicionar linha"** insere nova linha. Botão **"Criar todas"** faz POST em batch.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  CRIAR PARTIDAS EM LOTE                                                  [X] │
├──┬────┬──────────────┬──────────────┬──────────────┬──────────────┬─────────┤
│Tp│ Nº │  Red 1       │  Red 2       │  Blue 1      │  Blue 2      │ Horário │
├──┼────┼──────────────┼──────────────┼──────────────┼──────────────┼─────────┤
│Q │  1 │ [buscar eq.] │ [buscar eq.] │ [buscar eq.] │ [buscar eq.] │ [time]  │
│Q │  2 │ [buscar eq.] │ [buscar eq.] │ [buscar eq.] │ [buscar eq.] │ [time]  │
│Q │  3 │ [buscar eq.] │ [buscar eq.] │ [buscar eq.] │ [buscar eq.] │ [time]  │
│  │    │              │              │              │              │         │
│                                              [+ Linha]  [Cancelar] [Criar]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Tipo (`Q`/`E`/`T`) e número são editáveis por célula
- O campo de equipe reutiliza `TeamSearchInput` existente
- Auto-incremento: ao adicionar linha, o número incrementa automaticamente
- Validação inline: linhas com erro ficam destacadas antes de salvar
- `matches.php` ganha suporte a `POST` com array `[{...}, {...}]` para batch

#### 5.3 Acesso

Na página de campeonatos, o botão atual **"+ Nova Partida"** ganha um dropdown:
```
[ + Nova Partida ▾ ]
  ├─ Criar uma partida
  └─ Criar várias (lote)
```

---

### 6. Importação em Lote de Equipes

#### 6.1 Problema atual

Cadastrar 30+ equipes de um campeonato uma a uma é inviável.

#### 6.2 Solução — `BulkTeamImport`

Modal com textarea para colar lista de equipes. Formato aceito: `número,nome` por linha (nome opcional).

```
┌──────────────────────────────────────────────────────┐
│  IMPORTAR EQUIPES                                [X] │
├──────────────────────────────────────────────────────┤
│  Cole a lista abaixo (uma equipe por linha):         │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 24888,Tech Fenix                               │  │
│  │ 16052,HYDRA                                    │  │
│  │ 23184                                          │  │  ← nome opcional
│  │ 31692,SPARTAN                                  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Preview (4 equipes):                                │
│  ✅ #24888  Tech Fenix                               │
│  ✅ #16052  HYDRA                                    │
│  ⚠️ #23184  (sem nome — será salvo só com número)   │
│  ✅ #31692  SPARTAN                                  │
│                                                      │
│  Equipes já existentes serão ignoradas.              │
│                              [Cancelar] [Importar]   │
└──────────────────────────────────────────────────────┘
```

- `teams.php` ganha suporte a `POST` com array para batch insert (`INSERT OR IGNORE`)
- `useTeams` ganha método `bulkCreateTeams(teams[])`

---

## PENDÊNCIAS DA v1.1 NÃO IMPLEMENTADAS

Itens do PRD original que ainda não foram feitos:

| Item | Descrição | Prioridade |
|---|---|---|
| Lock mechanism | Avisar se equipe já está sendo scoutada por outro scout | Alta |
| Match scores input | Campos para preencher placar após a partida | Alta |
| StatsComparison | Gráficos comparativos entre equipes no MatchModal | Média |
| `scouting-stats.php` | Endpoint de stats agregadas por equipe | Média |
| TeamCard enriquecido | Stats inline no card de equipe no modal | Média |
| Filtros na lista | Busca e filtros por status/tipo na lista de partidas | Média |
| Página de stats de equipes | `team-stats.tsx` com histórico e análise | Baixa |
| Comparador de equipes | `compare.tsx` para análise estratégica | Baixa |

---

## ARQUIVOS A CRIAR / MODIFICAR

### Backend

| Arquivo | Ação | Descrição |
|---|---|---|
| `api/config.php` | Modificar | Adicionar tabela `match_media` em `initDatabase()` + migration |
| `api/media.php` | Criar | Upload, listagem, delete de mídia; query por `team_number` |
| `api/teams.php` | Modificar | Suporte a upload de arquivo (`multipart/form-data`) + bulk insert |
| `api/matches.php` | Modificar | Suporte a POST com array (bulk create) |

### Frontend — Novos

| Arquivo | Descrição |
|---|---|
| `components/championships/MediaGallery.tsx` | Galeria com abas, lightbox e player de vídeo |
| `components/championships/MediaUpload.tsx` | Modal de upload com marcação de equipes |
| `components/championships/BulkMatchForm.tsx` | Tabela editável para criar partidas em lote |
| `components/teams/BulkTeamImport.tsx` | Textarea de importação de equipes em lote |
| `hooks/useMedia.ts` | Fetch, upload e delete de mídias |

### Frontend — Modificar

| Arquivo | Mudança |
|---|---|
| `lib/types.ts` | Adicionar `MatchMedia`, `MediaCategory`; expandir `LogoPosition`; adicionar `media?` na `Match` |
| `components/championships/MatchModal.tsx` | Header com vídeos `full_match` + seção de galeria no rodapé |
| `components/championships/MatchListCard.tsx` | Avatar do logo das equipes (24px) |
| `components/championships/TeamCardInMatch.tsx` | Banner do logo da equipe (64px altura) + props `teamLogo` / `teamLogoPosition` |
| `components/teams/TeamForm.tsx` | Tabs URL/Upload + editor de posição grid 3×3 |

---

## ESTRUTURA DE PASTAS — UPLOADS

```
uploads/                          ← criar na raiz do servidor ao lado de api/
├── teams/
│   └── {team_number}/
│       └── logo.{ext}
└── matches/
    └── {match_id}/
        ├── full_match/
        ├── key_moments/
        └── other/
```

O `.htaccess` deve permitir acesso direto aos arquivos de `uploads/` mas bloquear listagem de diretório.

---

## DECISÕES TÉCNICAS

| Decisão | Escolha | Motivo |
|---|---|---|
| Player de vídeo local | `<video>` HTML nativo | Sem dependência extra, funciona offline |
| YouTube embed | Detecção por URL + `<iframe>` | Suporte ao caso mais comum de vídeos externos |
| Posição de logo | Grid 3×3 clicável | Mais intuitivo que dropdown de texto |
| Formato bulk teams | `número,nome` por linha | Cópia fácil de planilhas e listas do FTC |
| Batch insert teams | `INSERT OR IGNORE` | Evita erro em equipes já existentes, idempotente |
| Lookup de logo nos cards | Props explícitas | Evita fetch extra por card; resolver no pai |
