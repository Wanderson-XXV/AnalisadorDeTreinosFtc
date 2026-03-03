# FTC Scout System - Championship Feature PRD

## Product Requirements Document v1.1

**Projeto:** AnalisadorDeTreinosFtc - Extensão para Campeonatos  
**Temporada:** INTO THE DEEP 2024-2025 (Season-Specific)  
**Data:** 3 de Março de 2026  
**Versão:** 1.1  
**Prioridade:** CRÍTICA - Nacional amanhã

---

## CHANGELOG

### v1.1 - 3 de Março de 2026

- ⏱️ **Endgame Timing Correction**: Alterado período de endgame de 30 segundos para **20 segundos** (últimos 20s da partida)
- 🎯 **Season-Specific Clarification**: Sistema é específico para temporada DECODE 2025-2026, não season-agnostic
- 👥 **Teams Management Feature (CRITICAL)**: Adicionada funcionalidade completa de gerenciamento de equipes
    - Nova tabela `teams` no banco de dados
    - Novo endpoint `teams.php` com CRUD completo
    - Novos componentes frontend: TeamsList, TeamForm, TeamCard
    - Interface TypeScript Team
    - Atualização do schema de matches para referenciar teams
- 📊 **Data Flow Update**: Teams adicionado como entidade core no fluxo de dados

---

## 1. Executive Summary

### 1.1 Objetivo

Estender o sistema de scouting de treinos existente para suportar funcionalidades de campeonato/torneio FTC, permitindo que múltiplos usuários façam scouting simultâneo de diferentes equipes durante partidas oficiais.

### 1.2 Contexto

O sistema atual permite análise de rounds de treino da própria equipe. A nova funcionalidade deve:

- Gerenciar partidas de campeonato (Qualificatórias e Eliminatórias)
- Permitir scouting de QUALQUER equipe em uma partida (não apenas a própria)
- Suportar 4 scouts simultâneos (1 por equipe na partida)
- Manter compatibilidade total com a funcionalidade de treinos

### 1.3 Mudança Conceitual Crítica

|Conceito|Sistema Atual (Treinos)|Sistema Novo (Campeonato)|
|---|---|---|
|**Round**|Uma sessão de treino completa|Performance de UMA equipe em UMA partida|
|**Ciclo**|Ação de scoring durante treino|Ação de scoring de uma equipe específica|
|**Usuário**|N/A (sem autenticação)|Scout identificado por username|
|**Contexto**|Apenas própria equipe|Qualquer equipe no campeonato|

---

## 2. Current System Analysis

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ RoundTimer  │ │  Dashboard  │ │   History   │            │
│  │    .tsx     │ │    .tsx     │ │    .tsx     │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
│         │               │               │                    │
│  ┌──────┴───────────────┴───────────────┴──────┐            │
│  │              Custom Hooks                     │            │
│  │  useRounds  useCycles  useStats  useTimer    │            │
│  └──────────────────┬───────────────────────────┘            │
│                     │ fetch                                  │
└─────────────────────┼───────────────────────────────────────┘
                      │ HTTP/JSON
┌─────────────────────┼───────────────────────────────────────┐
│                     ▼        BACKEND (PHP)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ rounds.php  │ │ cycles.php  │ │  stats.php  │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
│         │               │               │                    │
│  ┌──────┴───────────────┴───────────────┴──────┐            │
│  │              config.php                       │            │
│  │    getDB() | migrations | helpers            │            │
│  └──────────────────┬───────────────────────────┘            │
│                     │                                        │
│              ┌──────▼──────┐                                 │
│              │   data.db   │ SQLite                          │
│              └─────────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Current Data Models

```sql
-- Tabela: rounds (sessões de treino)
rounds (
    id TEXT PRIMARY KEY,           -- UUID gerado
    start_time TEXT NOT NULL,      -- ISO timestamp
    end_time TEXT,                 -- ISO timestamp (NULL se em andamento)
    observations TEXT,             -- Notas do round
    total_duration INTEGER,        -- Duração em ms
    round_type TEXT DEFAULT 'teleop_only',  -- 'teleop_only' | 'full_match'
    battery_name TEXT,             -- Nome da bateria usada
    battery_volts REAL,            -- Voltagem inicial
    strategy TEXT,                 -- 'near' | 'hybrid' | 'far'
    created_at TEXT,
    updated_at TEXT
)

-- Tabela: cycles (ações de scoring)
cycles (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,        -- FK para rounds
    cycle_number INTEGER NOT NULL, -- Sequência no round
    duration INTEGER NOT NULL,     -- Tempo do ciclo em ms
    hits INTEGER DEFAULT 0,        -- Acertos
    misses INTEGER DEFAULT 0,      -- Erros
    timestamp INTEGER NOT NULL,    -- Momento no round (ms)
    time_interval TEXT NOT NULL,   -- '0-30s', '30-60s', etc.
    zone TEXT,                     -- 'near' | 'far'
    is_autonomous INTEGER DEFAULT 0,
    created_at TEXT
)
```

### 2.3 Key Components and Responsibilities

|Componente|Arquivo|Responsabilidade|
|---|---|---|
|**RoundTimer**|`RoundTimer.tsx`|Componente principal de scouting - timer, marcação de ciclos, modal de scoring|
|**CycleModal**|`CycleModal.tsx`|Modal para registrar hits/misses/zone de um ciclo|
|**CycleList**|`CycleList.tsx`|Lista de ciclos do round atual|
|**Sidebar**|`Sidebar.tsx`|Navegação principal, toggle de som|
|**StatsCards**|`StatsCards.tsx`|Cards de estatísticas agregadas|
|**TimerDisplay**|`TimerDisplay.tsx`|Display do cronômetro com fases|

### 2.4 Current API Endpoints

|Endpoint|Método|Descrição|
|---|---|---|
|`/rounds.php`|GET|Lista rounds (opcional: ?date=YYYY-MM-DD)|
|`/rounds.php?id=X`|GET|Busca round específico com ciclos|
|`/rounds.php`|POST|Cria novo round|
|`/rounds.php?id=X`|PATCH|Atualiza round|
|`/rounds.php?id=X`|DELETE|Remove round|
|`/cycles.php`|POST|Cria novo ciclo|
|`/cycles.php?id=X`|PATCH|Atualiza ciclo|
|`/stats.php`|GET|Estatísticas agregadas|

### 2.5 Frontend Routes

```typescript
// routes.ts
index("routes/home.tsx"),           // Timer principal
route("dashboard", ...),            // Stats e gráficos
route("history", ...),              // Histórico de rounds
route("championships", ...),        // PLACEHOLDER - a implementar
```

---

## 3. FTC Rules Summary (Relevantes para Scouting)

### 3.1 Estrutura de Partida FTC (INTO THE DEEP 2024-2025)

```
┌────────────────────────────────────────────────────────────────┐
│                     PARTIDA FTC (2:30 total)                    │
├────────────────┬────────────┬──────────────────────────────────┤
│   AUTÔNOMO     │ TRANSIÇÃO  │           TELEOPERADO            │
│    30 seg      │   8 seg    │            120 seg               │
│  (sem driver)  │ (pick up)  │     (controle do driver)         │
├────────────────┴────────────┴──────────────────────────────────┤
│                    ENDGAME (últimos 20 seg do TeleOp)          │
└────────────────────────────────────────────────────────────────┘
```

> **Nota:** Este sistema é **específico para a temporada INTO THE DEEP 2024-2025**. Funciona de forma similar ao sistema atual de scouting de treinos, sendo específico para os elementos e regras desta temporada.

### 3.2 Estrutura de Alianças

```
                    PARTIDA
        ┌─────────────┴─────────────┐
    ALIANÇA RED              ALIANÇA BLUE
    ┌────┴────┐              ┌────┴────┐
  Team A   Team B          Team C   Team D
```

- Cada partida tem **2 alianças** (Red e Blue)
- Cada aliança tem **2 equipes**
- Total: **4 equipes por partida**
- Pontuação é por **aliança**, mas scouting é por **equipe individual**

### 3.3 Tipos de Partida

|Tipo|Identificador|Descrição|
|---|---|---|
|**Qualificatória**|Q1, Q2, Q3...|Rounds preliminares, todas equipes participam|
|**Eliminatória**|SF1, SF2, F1...|Brackets, top equipes|

### 3.4 Elementos de Scoring (INTO THE DEEP 2024-2025)

Este sistema é **específico para a temporada INTO THE DEEP 2024-2025**, seguindo o mesmo modelo do sistema atual de scouting de treinos:

- **Autônomo (30s)**: Tasks pré-programadas, navegação, scoring de samples/specimens
- **TeleOp (120s)**: Ciclos de intake/score de samples e specimens
- **Endgame (últimos 20s)**: Ascent levels (parking, touch bar, low rung, high rung)

---

## 4. New Features Specification

### 4.1 Simple Authentication

#### 4.1.1 Requirements

- **Sem senha** - apenas identificação do scout
- Username único (obrigatório)
- Foto de perfil (opcional)
- Persistência via localStorage + validação backend

#### 4.1.2 User Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Primeiro Acesso ou Username não encontrado                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │          Bem-vindo ao FTC Scout                      │   │
│   │                                                      │   │
│   │   Nome de usuário: [________________]                │   │
│   │                                                      │   │
│   │   Foto (opcional): [Escolher arquivo] ou [Câmera]   │   │
│   │                                                      │   │
│   │                  [ Entrar ]                          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 4.1.3 Data Model

```sql
CREATE TABLE scouts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    photo_path TEXT,           -- Caminho do arquivo de foto
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_active TEXT
);
```

---

### 4.2 Teams Management (CRITICAL ADDITION)

> **IMPORTANTE**: Esta funcionalidade é fundamental e estava faltando. Equipes devem existir antes de criar partidas. O fluxo de scouting precisa das informações de equipe, e o modal de partida exibe dados das equipes.

#### 4.2.1 Database Schema

```sql
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_number INTEGER UNIQUE NOT NULL,
    team_name TEXT NOT NULL,
    logo_url TEXT,
    logo_position TEXT DEFAULT 'center', -- 'center', 'top', 'bottom', 'left', 'right', 'contain', 'cover'
    instagram TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_number ON teams(team_number);
```

#### 4.2.2 API Endpoint - teams.php

```
GET    /api/teams.php                    # Lista todas as equipes
GET    /api/teams.php?id={id}            # Busca equipe por ID
GET    /api/teams.php?team_number={num}  # Busca equipe por número
POST   /api/teams.php                    # Criar nova equipe
PUT    /api/teams.php                    # Atualizar equipe
DELETE /api/teams.php?id={id}            # Remover equipe
```

**Request/Response Examples:**

```json
// POST /api/teams.php - Criar equipe
{
  "team_number": 24888,
  "team_name": "Tech Dragons",
  "logo_url": "https://media.easy-peasy.ai/27feb2bb-aeb4-4a83-9fb6-8f3f2a15885e/9b703ac4-ac9b-4c40-a4f7-39e2d75fabba_medium.webp",
  "logo_position": "center",
  "instagram": "@techdragonsFTC"
}

// Response
{
  "success": true,
  "data": {
    "id": 1,
    "team_number": 24888,
    "team_name": "Tech Dragons",
    "logo_url": "https://cdn.media.amplience.net/s/hottopic/32516985_hi",
    "logo_position": "center",
    "instagram": "@techdragonsFTC",
    "created_at": "2026-03-03T10:30:00Z",
    "updated_at": "2026-03-03T10:30:00Z"
  }
}
```

#### 4.2.3 Frontend Components

|Componente|Arquivo|Responsabilidade|
|---|---|---|
|**TeamsList**|`components/teams/TeamsList.tsx`|Lista todas equipes com busca e filtros|
|**TeamForm**|`components/teams/TeamForm.tsx`|Formulário para criar/editar equipe|
|**TeamCard**|`components/teams/TeamCard.tsx`|Card de exibição de equipe|

#### 4.2.4 TypeScript Interface

```typescript
interface Team {
  id: number;
  team_number: number;
  team_name: string;
  logo_url?: string;
  logo_position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'contain' | 'cover';
  instagram?: string;
  created_at: string;
  updated_at: string;
}

// Para formulários
interface TeamFormData {
  team_number: number;
  team_name: string;
  logo_url?: string;
  logo_position?: string;
  instagram?: string;
}
```

#### 4.2.5 TeamsList Component Layout

```
┌──────────────────────────────────────────────────────────────┐
│  EQUIPES                                      [+ Nova Equipe] │
├──────────────────────────────────────────────────────────────┤
│  🔍 [Buscar por número ou nome...]                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ #24888         │  │ #16052         │  │ #23184         │ │
│  │ ┌────────────┐ │  │ ┌────────────┐ │  │ ┌────────────┐ │ │
│  │ │   LOGO     │ │  │ │   LOGO     │ │  │ │   LOGO     │ │ │
│  │ └────────────┘ │  │ └────────────┘ │  │ └────────────┘ │ │
│  │ Tech Dragons   │  │ HYDRA          │  │ ATLAS          │ │
│  │ @techdragonsFTC│  │ @hydra_ftc     │  │ @atlas_team    │ │
│  │ [✏️] [🗑️]     │  │ [✏️] [🗑️]     │  │ [✏️] [🗑️]     │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 4.2.6 TeamForm Component Layout

```
┌──────────────────────────────────────────────────────────────┐
│  NOVA EQUIPE / EDITAR EQUIPE                            [X]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Número da Equipe *: [________]                             │
│                                                              │
│   Nome da Equipe *:   [________________________]             │
│                                                              │
│   Logo URL:           [________________________]             │
│                                                              │
│   Posição do Logo:    [▼ center ]                           │
│                       • center                               │
│                       • top                                  │
│                       • contain                              │
│                       • cover                                │
│                                                              │
│   Instagram:          [@___________________]                 │
│                                                              │
│                 [ Cancelar ]  [ Salvar Equipe ]             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 4.2.7 Integration with Matches

A tabela `matches` deve referenciar equipes por `team_number`. Ao criar uma partida:

1. O sistema busca informações da equipe na tabela `teams`
2. Se a equipe não existir, pode ser criada automaticamente ou mostrar um aviso
3. O modal de partida exibe logo, nome e Instagram das equipes

```sql
-- Relacionamento lógico (não FK por flexibilidade)
-- matches.red_team1_number → teams.team_number
-- matches.red_team2_number → teams.team_number
-- matches.blue_team1_number → teams.team_number
-- matches.blue_team2_number → teams.team_number
```

#### 4.2.8 Future Features (Phase 3)

- **Página de Perfil Completo da Equipe**: Stats detalhados, histórico de partidas
- **Análise Estratégica com IA**:
    - Como jogar COM equipes específicas (estratégia de aliança)
    - Como jogar CONTRA equipes específicas (análise de oponente)
    - Recomendações de seleção de aliança para playoffs
    - Reconhecimento de padrões e predição de comportamento

---

### 4.3 Match Management

#### 4.3.1 Match Data Structure

```sql
CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    championship_id TEXT,              -- FK para campeonatos (futuro)
    match_type TEXT NOT NULL,          -- 'qualification' | 'elimination'
    match_number INTEGER NOT NULL,     -- Q1, Q2, etc.
    
    -- Aliança Red
    red_team1_number INTEGER NOT NULL,
    red_team1_name TEXT,
    red_team2_number INTEGER NOT NULL,
    red_team2_name TEXT,
    
    -- Aliança Blue
    blue_team1_number INTEGER NOT NULL,
    blue_team1_name TEXT,
    blue_team2_number INTEGER NOT NULL,
    blue_team2_name TEXT,
    
    -- Scores (preenchidos após partida)
    red_score_auto INTEGER DEFAULT 0,
    red_score_teleop INTEGER DEFAULT 0,
    red_penalties INTEGER DEFAULT 0,
    red_total INTEGER DEFAULT 0,
    
    blue_score_auto INTEGER DEFAULT 0,
    blue_score_teleop INTEGER DEFAULT 0,
    blue_penalties INTEGER DEFAULT 0,
    blue_total INTEGER DEFAULT 0,
    
    -- Metadata
    scheduled_time TEXT,               -- Horário previsto
    actual_start_time TEXT,            -- Início real
    status TEXT DEFAULT 'scheduled',   -- 'scheduled' | 'in_progress' | 'completed'
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matches_type ON matches(match_type);
CREATE INDEX idx_matches_status ON matches(status);
```

#### 4.2.2 Match Creation Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    CRIAR NOVA PARTIDA                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Tipo: (●) Qualificatória  ( ) Eliminatória                │
│                                                              │
│   Número: [___3___]  →  Resultado: "Q3"                     │
│                                                              │
│   ┌─────────────────────┐  ┌─────────────────────┐          │
│   │   ALIANÇA RED       │  │   ALIANÇA BLUE      │          │
│   │                     │  │                     │          │
│   │ Team 1: [#_____]    │  │ Team 1: [#_____]    │          │
│   │ Nome:   [_________] │  │ Nome:   [_________] │          │
│   │                     │  │                     │          │
│   │ Team 2: [#_____]    │  │ Team 2: [#_____]    │          │
│   │ Nome:   [_________] │  │ Nome:   [_________] │          │
│   └─────────────────────┘  └─────────────────────┘          │
│                                                              │
│   Horário Previsto: [__:__]                                 │
│                                                              │
│              [ Cancelar ]  [ Criar Partida ]                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Match List View

```
┌──────────────────────────────────────────────────────────────┐
│  PARTIDAS DO CAMPEONATO               [+ Nova] [↓ Importar]  │
├──────────────────────────────────────────────────────────────┤
│  🔍 [Buscar por equipe ou número...]        [Filtros ▼]     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Q1 - Qualificatória           ⏱️ 09:30    ✅ Completa  │ │
│  │ 🔴 #24888 Tech Dragons + #23184 ATLAS         0        │ │
│  │ 🔵 #16052 HYDRA + #31692 SPARTAN             76        │ │
│  │                                    [👁️ Ver] [✏️ Editar] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Q2 - Qualificatória           ⏱️ 09:45    🔄 Em breve  │ │
│  │ 🔴 #19045 Phoenix + #22301 Infinity         --         │ │
│  │ 🔵 #24888 Tech Dragons + #18772 Titans      --         │ │
│  │                        [▶️ Iniciar Scouting] [✏️ Editar] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 4.4 Match Card/Modal (COMPONENTE MAIS IMPORTANTE)

#### 4.3.1 Overview

O Match Card é o hub central de informações de uma partida. Deve permitir:

1. Visualização de todas as 4 equipes
2. Comparação de stats entre equipes
3. Acesso à galeria de mídia
4. Início do scouting de uma equipe específica

#### 4.3.2 Layout Detalhado

```
┌─────────────────────────────────────────────────────────────────────┐
│  MATCH DETAILS                                              [X]    │
│  Qualificatória Q3                              [Editar] [Excluir] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────┐  ┌────────────────────────────┐    │
│  │      RED ALLIANCE          │  │      BLUE ALLIANCE         │    │
│  ├────────────────────────────┤  ├────────────────────────────┤    │
│  │                            │  │                            │    │
│  │  ┌──────────────────────┐  │  │  ┌──────────────────────┐  │    │
│  │  │ #24888 Tech Dragons  │  │  │  │ #16052 HYDRA         │  │    │
│  │  │ ┌────────────────┐   │  │  │  │ ┌────────────────┐   │  │    │
│  │  │ │  TEAM BANNER   │   │  │  │  │ │  TEAM BANNER   │   │  │    │
│  │  │ │    (image)     │   │  │  │  │ │    (image)     │   │  │    │
│  │  │ └────────────────┘   │  │  │  │ └────────────────┘   │  │    │
│  │  │ TOTAL: 0 pts         │  │  │  │ TOTAL: 53 pts        │  │    │
│  │  │ [Auto: 0] [TeleOp: 0]│  │  │  │ [Auto: 9] [TeleOp:32]│  │    │
│  │  │ [▶️ Scout This Team] │  │  │  │ [▶️ Scout This Team] │  │    │
│  │  └──────────────────────┘  │  │  └──────────────────────┘  │    │
│  │                            │  │                            │    │
│  │  ┌──────────────────────┐  │  │  ┌──────────────────────┐  │    │
│  │  │ #23184 ATLAS         │  │  │  │ #31692 SPARTAN       │  │    │
│  │  │ ...                  │  │  │  │ ...                  │  │    │
│  │  └──────────────────────┘  │  │  └──────────────────────┘  │    │
│  │                            │  │                            │    │
│  │  ALLIANCE TOTAL: 0         │  │  ALLIANCE TOTAL: 76        │    │
│  └────────────────────────────┘  └────────────────────────────┘    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  📊 COMPARAÇÃO DE STATS                                     [▼]    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Gráfico de radar/barras comparando equipes]               │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  📷 MÍDIA DA PARTIDA                           [+ Upload] [▼]      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Thumb1] [Thumb2] [Thumb3] [+12 mais...]                   │   │
│  │   Full     Key      Other                                    │   │
│  │  Match    Moment                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                      Vencedor: Blue Alliance                        │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Team Card Component

```typescript
interface TeamCardProps {
  teamNumber: number;
  teamName: string;
  alliance: 'red' | 'blue';
  matchId: string;
  
  // Stats (opcional - se já scoutado)
  stats?: {
    autoScore: number;
    teleopScore: number;
    totalScore: number;
    cycles: number;
    hitRate: number;
  };
  
  // Estado de scouting
  scoutingStatus?: {
    isBeingScouted: boolean;
    scoutUsername?: string;
  };
  
  // Actions
  onStartScouting: () => void;
  onViewDetails: () => void;
}
```

#### 4.3.4 Stats Comparison Section

Gráficos para comparação rápida:

- **Radar Chart**: Performance geral (Auto, TeleOp, Cycles, Accuracy)
- **Bar Chart**: Pontuação por fase
- **Timeline**: Distribuição de scoring ao longo da partida

---

### 4.5 Scouting Flow (Championship)

#### 4.4.1 Flow Completo

```
┌────────────────────────────────────────────────────────────────────┐
│                    CHAMPIONSHIP SCOUTING FLOW                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. Match List                                                    │
│      │                                                             │
│      ▼                                                             │
│   2. Click Match Card ──────────────────────────────────────┐      │
│      │                                                      │      │
│      ▼                                                      ▼      │
│   3. Match Modal Opens                              (View Only)    │
│      │                                                             │
│      ▼                                                             │
│   4. Click "Scout This Team" on specific team card                 │
│      │                                                             │
│      ├──────────────────────────────────────────────────────┐      │
│      │ CHECK: Is another scout already scouting this team? │      │
│      └──────────────────────────────────────────────────────┘      │
│      │                                                             │
│      ├─── YES ──▶ Show warning: "João está scoutando esta equipe"  │
│      │           [ Continuar mesmo assim ] [ Escolher outra ]      │
│      │                                                             │
│      └─── NO ───▶ Create new scouting_round                        │
│                    │                                               │
│                    ▼                                               │
│   5. Open RoundTimer (modified for championship)                   │
│      ┌──────────────────────────────────────────────────────┐      │
│      │ SCOUTANDO: #24888 Tech Dragons                       │      │
│      │ Partida: Q3 | Aliança: Red | Scout: @maria           │      │
│      │ ─────────────────────────────────────────────────────│      │
│      │              [TIMER + CYCLE MARKING]                 │      │
│      │              (mesmo UI do treino)                    │      │
│      └──────────────────────────────────────────────────────┘      │
│      │                                                             │
│      ▼                                                             │
│   6. Finish Scouting                                               │
│      │                                                             │
│      ▼                                                             │
│   7. Add comments (optional)                                       │
│      │                                                             │
│      ▼                                                             │
│   8. Data saved to scouting_rounds + scouting_cycles               │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

#### 4.4.2 Scouting Round Data Model

```sql
-- Rounds de scouting de campeonato (diferente de treinos)
CREATE TABLE scouting_rounds (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,            -- FK para matches
    team_number INTEGER NOT NULL,       -- Equipe sendo scoutada
    scout_id TEXT NOT NULL,             -- FK para scouts
    
    -- Timing
    start_time TEXT NOT NULL,
    end_time TEXT,
    total_duration INTEGER,
    
    -- Metadata
    observations TEXT,                  -- Comentários do scout
    robot_issues TEXT,                  -- Problemas observados no robô
    strategy_notes TEXT,                -- Notas sobre estratégia
    
    -- Lock
    is_locked INTEGER DEFAULT 0,        -- 1 = em progresso, não permitir outro scout
    locked_at TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (scout_id) REFERENCES scouts(id)
);

CREATE INDEX idx_scouting_rounds_match ON scouting_rounds(match_id);
CREATE INDEX idx_scouting_rounds_team ON scouting_rounds(team_number);
CREATE UNIQUE INDEX idx_scouting_unique ON scouting_rounds(match_id, team_number);

-- Ciclos de scouting (ações durante a partida)
CREATE TABLE scouting_cycles (
    id TEXT PRIMARY KEY,
    scouting_round_id TEXT NOT NULL,   -- FK para scouting_rounds
    cycle_number INTEGER NOT NULL,
    
    -- Timing
    duration INTEGER NOT NULL,          -- Duração do ciclo em ms
    timestamp INTEGER NOT NULL,         -- Momento na partida (ms)
    time_interval TEXT NOT NULL,        -- 'auto', 'transition', '0-30s', etc.
    is_autonomous INTEGER DEFAULT 0,
    
    -- Scoring
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    zone TEXT,                          -- 'near' | 'far'
    
    -- Extended data (para análise detalhada)
    action_type TEXT,                   -- 'sample', 'specimen', 'climb', etc.
    notes TEXT,                         -- Notas específicas do ciclo
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (scouting_round_id) REFERENCES scouting_rounds(id) ON DELETE CASCADE
);

CREATE INDEX idx_scouting_cycles_round ON scouting_cycles(scouting_round_id);
```

#### 4.4.3 Modified RoundTimer Header

```typescript
// Novo header para modo campeonato
interface ChampionshipTimerHeaderProps {
  matchInfo: {
    matchType: 'qualification' | 'elimination';
    matchNumber: number;
    displayName: string;  // "Q3", "SF1", etc.
  };
  teamInfo: {
    number: number;
    name: string;
    alliance: 'red' | 'blue';
  };
  scoutInfo: {
    username: string;
    photoUrl?: string;
  };
}
```

---

### 4.5 Data Integrity (CRÍTICO)

#### 4.6.1 Separação de Dados

O sistema DEVE separar dados precisamente por:

```
                         HIERARQUIA DE DADOS
                         
    ┌─────────────────────────────────────────────────────────────┐
    │                         TEAMS                                │
    │  (Entidade core - deve existir antes de criar partidas)      │
    │  teams: id, team_number, team_name, logo_url, instagram     │
    └─────────────────────────────────────────────────────────────┘
                                │
                                ▼
    Championship (futuro) ◀─── Agrupa múltiplas partidas
           │
           ▼
        Match ─────────────────────────────────────────┐
           │                                           │
           ▼                                           ▼
    Alliance (Red/Blue)                         Alliance (Red/Blue)
    (referencia teams                          (referencia teams
     por team_number)                           por team_number)
           │                                           │
           ├──────┬──────┐                  ┌──────┬──────┤
           ▼      ▼      ▼                  ▼      ▼      ▼
        Team 1  Team 2                   Team 1  Team 2
           │                                           │
           ▼                                           ▼
    ScoutingRound ◀─────── 1 round por team/match ────▶ ScoutingRound
           │                                           │
           ▼                                           ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                        CYCLES                                 │
    │  ┌─────────────────────────────────────────────────────────┐ │
    │  │ Autonomous Period (0-30s)                                │ │
    │  │   - is_autonomous = 1                                    │ │
    │  │   - time_interval = 'auto'                               │ │
    │  └─────────────────────────────────────────────────────────┘ │
    │  ┌─────────────────────────────────────────────────────────┐ │
    │  │ Transition (30-38s)                                      │ │
    │  │   - time_interval = 'transition'                         │ │
    │  └─────────────────────────────────────────────────────────┘ │
    │  ┌─────────────────────────────────────────────────────────┐ │
    │  │ TeleOp Period (38-158s / 0-120s in teleop time)         │ │
    │  │   - is_autonomous = 0                                    │ │
    │  │   - time_interval = '0-30s', '30-60s', etc.             │ │
    │  └─────────────────────────────────────────────────────────┘ │
    └──────────────────────────────────────────────────────────────┘
```

#### 4.5.2 Validation Rules

```php
// Validações obrigatórias no backend

// 1. Um round de scouting por equipe por partida
function validateUniqueScoutingRound($matchId, $teamNumber) {
    $existing = $db->query(
        "SELECT id FROM scouting_rounds 
         WHERE match_id = ? AND team_number = ?",
        [$matchId, $teamNumber]
    )->fetch();
    
    if ($existing) {
        throw new Exception("Já existe scouting para esta equipe nesta partida");
    }
}

// 2. Timestamp dentro do range válido
function validateTimestamp($timestamp, $isFullMatch) {
    $maxTime = $isFullMatch ? 158000 : 120000;
    if ($timestamp < 0 || $timestamp > $maxTime + 10000) { // +10s tolerance
        throw new Exception("Timestamp inválido");
    }
}

// 3. Ciclo pertence ao período correto
function validateCyclePeriod($timestamp, $isAutonomous, $isFullMatch) {
    if ($isFullMatch && $isAutonomous && $timestamp >= 30000) {
        throw new Exception("Ciclo marcado como autônomo mas timestamp é do teleop");
    }
}
```

#### 4.5.3 Accurate Calculations

```sql
-- View para estatísticas precisas por equipe
CREATE VIEW team_stats AS
SELECT 
    sr.team_number,
    COUNT(DISTINCT sr.id) as matches_scouted,
    
    -- Auto stats
    SUM(CASE WHEN sc.is_autonomous = 1 THEN sc.hits ELSE 0 END) as auto_hits,
    SUM(CASE WHEN sc.is_autonomous = 1 THEN sc.misses ELSE 0 END) as auto_misses,
    AVG(CASE WHEN sc.is_autonomous = 1 THEN sc.duration ELSE NULL END) as avg_auto_cycle,
    
    -- TeleOp stats  
    SUM(CASE WHEN sc.is_autonomous = 0 THEN sc.hits ELSE 0 END) as teleop_hits,
    SUM(CASE WHEN sc.is_autonomous = 0 THEN sc.misses ELSE 0 END) as teleop_misses,
    AVG(CASE WHEN sc.is_autonomous = 0 THEN sc.duration ELSE NULL END) as avg_teleop_cycle,
    
    -- Overall
    SUM(sc.hits) as total_hits,
    SUM(sc.misses) as total_misses,
    ROUND(100.0 * SUM(sc.hits) / (SUM(sc.hits) + SUM(sc.misses)), 1) as hit_rate
    
FROM scouting_rounds sr
JOIN scouting_cycles sc ON sc.scouting_round_id = sr.id
GROUP BY sr.team_number;
```

---

### 4.6 Media Management

#### 4.6.1 Storage Structure

```
/home/ubuntu/public_html/   (ou diretório do site)
└── uploads/
    └── media/
        └── matches/
            └── {match_id}/
                ├── full_match/
                │   ├── video_001.mp4
                │   └── video_002.mp4
                ├── key_moments/
                │   ├── img_001.jpg
                │   └── img_002.jpg
                └── other/
                    └── img_003.jpg
```

#### 4.6.2 Media Database Schema

```sql
CREATE TABLE match_media (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    
    -- File info
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,           -- Caminho relativo
    file_type TEXT NOT NULL,           -- 'image' | 'video'
    file_size INTEGER,                 -- Bytes
    mime_type TEXT,
    
    -- Metadata
    category TEXT NOT NULL,            -- 'full_match' | 'key_moment' | 'other'
    title TEXT,                        -- Título opcional
    description TEXT,
    
    -- Team tagging (opcional)
    tagged_teams TEXT,                 -- JSON array: [24888, 16052]
    
    -- Upload info
    uploaded_by TEXT,                  -- FK para scouts
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES scouts(id)
);

CREATE INDEX idx_media_match ON match_media(match_id);
CREATE INDEX idx_media_category ON match_media(category);
```

#### 4.6.3 Upload API

```php
// media.php - Endpoints

// POST /media.php - Upload de mídia
// Content-Type: multipart/form-data
// Fields: match_id, category, title (optional), tagged_teams (optional), file

// GET /media.php?match_id=X - Lista mídia de uma partida
// GET /media.php?id=X - Metadata de um arquivo específico
// DELETE /media.php?id=X - Remove mídia
```

#### 4.6.4 Upload Limits

```php
// config.php
define('MAX_IMAGE_SIZE', 10 * 1024 * 1024);  // 10MB
define('MAX_VIDEO_SIZE', 500 * 1024 * 1024); // 500MB
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/webp']);
define('ALLOWED_VIDEO_TYPES', ['video/mp4', 'video/webm', 'video/quicktime']);
```

---

### 4.7 Compatibility Requirements

#### 4.7.1 Coexistence Matrix

|Feature|Training Mode|Championship Mode|Shared|
|---|---|---|---|
|Rounds table|✅ Usa|❌ Não usa|-|
|Cycles table|✅ Usa|❌ Não usa|-|
|scouting_rounds|❌ Não usa|✅ Usa|-|
|scouting_cycles|❌ Não usa|✅ Usa|-|
|RoundTimer UI|✅ Original|✅ Com header modificado|Core logic|
|Stats calculations|✅ Treinos|✅ Campeonato|Algorithms|
|scouts table|❌ Opcional|✅ Obrigatório|Auth|

#### 4.7.2 Navigation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        SIDEBAR                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   📦 TREINOS                                                │
│   ├── ⏱️  Novo Round (home.tsx)                            │
│   ├── 📊 Dashboard (dashboard.tsx)                         │
│   └── 📜 Histórico (history.tsx)                           │
│                                                             │
│   ─────────────────────────────                             │
│                                                             │
│   🏆 COMPETIÇÕES                                            │
│   ├── 📋 Partidas (championships.tsx) ◀── NOVO             │
│   ├── 📈 Stats Equipes (team-stats.tsx) ◀── NOVO          │
│   └── 🎯 Comparador (compare.tsx) ◀── FUTURO              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Technical Specifications

### 5.1 New Database Schema (Complete)

```sql
-- ============================================================
-- CHAMPIONSHIP TABLES (NEW)
-- ============================================================

-- Equipes (FUNDAMENTAL - deve existir antes de matches)
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_number INTEGER UNIQUE NOT NULL,
    team_name TEXT NOT NULL,
    logo_url TEXT,
    logo_position TEXT DEFAULT 'center', -- 'center', 'top', 'bottom', 'left', 'right', 'contain', 'cover'
    instagram TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_number ON teams(team_number);

-- Scouts (usuários simples)
CREATE TABLE IF NOT EXISTS scouts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    photo_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_active TEXT
);

-- Partidas de campeonato
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    championship_id TEXT,
    match_type TEXT NOT NULL DEFAULT 'qualification',
    match_number INTEGER NOT NULL,
    
    -- Red Alliance
    red_team1_number INTEGER NOT NULL,
    red_team1_name TEXT,
    red_team2_number INTEGER NOT NULL,
    red_team2_name TEXT,
    
    -- Blue Alliance
    blue_team1_number INTEGER NOT NULL,
    blue_team1_name TEXT,
    blue_team2_number INTEGER NOT NULL,
    blue_team2_name TEXT,
    
    -- Scores
    red_score_auto INTEGER DEFAULT 0,
    red_score_teleop INTEGER DEFAULT 0,
    red_penalties INTEGER DEFAULT 0,
    red_total INTEGER DEFAULT 0,
    
    blue_score_auto INTEGER DEFAULT 0,
    blue_score_teleop INTEGER DEFAULT 0,
    blue_penalties INTEGER DEFAULT 0,
    blue_total INTEGER DEFAULT 0,
    
    -- Timing
    scheduled_time TEXT,
    actual_start_time TEXT,
    status TEXT DEFAULT 'scheduled',
    
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Rounds de scouting (1 por equipe por partida)
CREATE TABLE IF NOT EXISTS scouting_rounds (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    team_number INTEGER NOT NULL,
    scout_id TEXT,
    
    start_time TEXT NOT NULL,
    end_time TEXT,
    total_duration INTEGER,
    
    observations TEXT,
    robot_issues TEXT,
    strategy_notes TEXT,
    
    is_locked INTEGER DEFAULT 0,
    locked_at TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (scout_id) REFERENCES scouts(id)
);

CREATE INDEX IF NOT EXISTS idx_scouting_rounds_match ON scouting_rounds(match_id);
CREATE INDEX IF NOT EXISTS idx_scouting_rounds_team ON scouting_rounds(team_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scouting_unique ON scouting_rounds(match_id, team_number);

-- Ciclos de scouting
CREATE TABLE IF NOT EXISTS scouting_cycles (
    id TEXT PRIMARY KEY,
    scouting_round_id TEXT NOT NULL,
    cycle_number INTEGER NOT NULL,
    
    duration INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    time_interval TEXT NOT NULL,
    is_autonomous INTEGER DEFAULT 0,
    
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    zone TEXT,
    
    action_type TEXT,
    notes TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (scouting_round_id) REFERENCES scouting_rounds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scouting_cycles_round ON scouting_cycles(scouting_round_id);

-- Mídia de partidas
CREATE TABLE IF NOT EXISTS match_media (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    
    category TEXT NOT NULL,
    title TEXT,
    description TEXT,
    tagged_teams TEXT,
    
    uploaded_by TEXT,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES scouts(id)
);

CREATE INDEX IF NOT EXISTS idx_media_match ON match_media(match_id);
```

### 5.2 API Endpoints (PHP)

#### 5.2.1 New Files Structure

```
api/
├── config.php           # Existente (add migrations)
├── rounds.php           # Existente (treinos)
├── cycles.php           # Existente (treinos)
├── stats.php            # Existente (treinos)
│
├── teams.php            # NOVO - CRUD equipes (CRÍTICO)
├── scouts.php           # NOVO - Auth simples
├── matches.php          # NOVO - CRUD partidas
├── scouting.php         # NOVO - Scouting de campeonato
├── scouting-stats.php   # NOVO - Stats de campeonato
└── media.php            # NOVO - Upload/manage mídia
```

#### 5.2.2 Endpoint Specifications

**teams.php** (CRÍTICO - MVP)

```
GET    /teams.php                    # Lista todas as equipes
GET    /teams.php?id=X               # Busca equipe por ID
GET    /teams.php?team_number=X      # Busca equipe por número
POST   /teams.php                    # Criar nova equipe
PUT    /teams.php                    # Atualizar equipe
DELETE /teams.php?id=X               # Remover equipe
```

**scouts.php**

```
POST   /scouts.php              # Criar/login scout
GET    /scouts.php              # Lista scouts
GET    /scouts.php?username=X   # Busca scout por username
PATCH  /scouts.php?id=X         # Atualiza scout (foto, etc)
```

**matches.php**

```
GET    /matches.php             # Lista partidas (filtros: ?type, ?status, ?team)
GET    /matches.php?id=X        # Detalhes da partida + rounds de scouting
POST   /matches.php             # Criar partida
PATCH  /matches.php?id=X        # Atualizar partida (scores, status, etc)
DELETE /matches.php?id=X        # Remover partida
```

**scouting.php**

```
GET    /scouting.php?match_id=X             # Rounds de scouting da partida
GET    /scouting.php?id=X                   # Round específico com ciclos
GET    /scouting.php?team=X                 # Todos rounds de uma equipe
POST   /scouting.php                        # Iniciar scouting (body: match_id, team_number, scout_id)
PATCH  /scouting.php?id=X                   # Finalizar/atualizar round
DELETE /scouting.php?id=X                   # Cancelar round

POST   /scouting.php?action=cycle           # Adicionar ciclo (body: scouting_round_id, ...)
PATCH  /scouting.php?action=cycle&id=X      # Editar ciclo
```

**scouting-stats.php**

```
GET    /scouting-stats.php?team=X           # Stats de uma equipe
GET    /scouting-stats.php?match=X          # Stats de uma partida
GET    /scouting-stats.php?compare=X,Y,Z    # Comparar equipes
```

**media.php**

```
GET    /media.php?match_id=X                # Lista mídia da partida
POST   /media.php                           # Upload (multipart/form-data)
DELETE /media.php?id=X                      # Remover mídia
```

### 5.3 Frontend Components Structure

#### 5.3.1 New Files

```
client/app/
├── routes/
│   ├── championships.tsx     # REWRITE - Lista de partidas
│   ├── match.$id.tsx         # NOVO - Detalhes da partida
│   └── scout.$matchId.$team.tsx  # NOVO - Scouting de equipe
│
├── components/
│   ├── championships/
│   │   ├── MatchList.tsx         # Lista de partidas
│   │   ├── MatchCard.tsx         # Card de partida na lista
│   │   ├── MatchModal.tsx        # Modal de detalhes (PRINCIPAL)
│   │   ├── MatchForm.tsx         # Form criar/editar partida
│   │   ├── TeamCard.tsx          # Card de equipe no modal
│   │   ├── AllianceSection.tsx   # Seção de aliança
│   │   ├── StatsComparison.tsx   # Gráficos comparativos
│   │   ├── MediaGallery.tsx      # Galeria de mídia
│   │   ├── MediaUpload.tsx       # Upload de mídia
│   │   └── ScoutingIndicator.tsx # Indicador "sendo scoutado por..."
│   │
│   ├── auth/
│   │   ├── LoginForm.tsx         # Form de login simples
│   │   └── UserBadge.tsx         # Badge do usuário logado
│   │
│   └── scouting/
│       ├── ChampionshipTimer.tsx # Timer adaptado para campeonato
│       └── ScoutingHeader.tsx    # Header com info da partida/equipe
│
├── hooks/
│   ├── useMatches.ts         # CRUD partidas
│   ├── useScouting.ts        # Scouting rounds/cycles
│   ├── useScoutingStats.ts   # Stats de campeonato
│   ├── useMedia.ts           # Upload/gestão mídia
│   └── useAuth.ts            # Auth simples
│
└── lib/
    ├── types.ts              # ADD tipos de campeonato
    └── championshipApi.ts    # NOVO - API helpers
```

#### 5.3.2 New Types

```typescript
// types.ts - Additions

export type MatchType = 'qualification' | 'elimination';
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed';
export type MediaCategory = 'full_match' | 'key_moment' | 'other';

export interface Scout {
  id: string;
  username: string;
  photoPath?: string;
  createdAt: string;
  lastActive?: string;
}

export interface TeamInMatch {
  number: number;
  name?: string;
}

export interface AllianceData {
  team1: TeamInMatch;
  team2: TeamInMatch;
  scoreAuto: number;
  scoreTeleop: number;
  penalties: number;
  total: number;
}

export interface Match {
  id: string;
  championshipId?: string;
  matchType: MatchType;
  matchNumber: number;
  displayName: string;  // "Q1", "SF2", etc.
  
  redAlliance: AllianceData;
  blueAlliance: AllianceData;
  
  scheduledTime?: string;
  actualStartTime?: string;
  status: MatchStatus;
  
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Populated on detail fetch
  scoutingRounds?: ScoutingRound[];
  media?: MatchMedia[];
}

export interface ScoutingRound {
  id: string;
  matchId: string;
  teamNumber: number;
  scoutId?: string;
  scoutUsername?: string;
  
  startTime: string;
  endTime?: string;
  totalDuration?: number;
  
  observations?: string;
  robotIssues?: string;
  strategyNotes?: string;
  
  isLocked: boolean;
  lockedAt?: string;
  
  cycles: ScoutingCycle[];
  
  // Computed
  autoHits?: number;
  autoMisses?: number;
  teleopHits?: number;
  teleopMisses?: number;
  totalHits?: number;
  totalMisses?: number;
}

export interface ScoutingCycle {
  id: string;
  scoutingRoundId: string;
  cycleNumber: number;
  
  duration: number;
  timestamp: number;
  timeInterval: string;
  isAutonomous: boolean;
  
  hits: number;
  misses: number;
  zone: CycleZone;
  
  actionType?: string;
  notes?: string;
}

export interface MatchMedia {
  id: string;
  matchId: string;
  
  filename: string;
  originalFilename: string;
  filePath: string;
  fileType: 'image' | 'video';
  fileSize: number;
  mimeType: string;
  
  category: MediaCategory;
  title?: string;
  description?: string;
  taggedTeams?: number[];
  
  uploadedBy?: string;
  uploadedAt: string;
}

export interface TeamStats {
  teamNumber: number;
  teamName?: string;
  matchesScouted: number;
  
  autoHits: number;
  autoMisses: number;
  avgAutoCycleTime: number;
  
  teleopHits: number;
  teleopMisses: number;
  avgTeleopCycleTime: number;
  
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  
  avgCyclesPerMatch: number;
  bestMatch?: {
    matchId: string;
    matchName: string;
    hits: number;
  };
}
```

### 5.4 File Storage Structure

```
/var/www/html/               # ou diretório do site Hostinger
├── api/
│   ├── data.db              # SQLite database
│   └── *.php
├── uploads/
│   ├── scouts/
│   │   └── {scout_id}/
│   │       └── photo.jpg
│   └── matches/
│       └── {match_id}/
│           ├── full_match/
│           ├── key_moments/
│           └── other/
└── client/
    └── (built React app)
```

---

## 6. Implementation Phases

### 🔴 PHASE 1: MVP for Nacional (HOJE)

**Objetivo:** Funcionalidade mínima para amanhã  
**Tempo estimado:** 6-8 horas  
**Prioridade:** CRÍTICA

#### 6.1.1 Backend Tasks

|Task|File|Descrição|Est.|
|---|---|---|---|
|1.1|config.php|Add migrations para novas tabelas|30min|
|1.2|scouts.php|CRUD básico de scouts|45min|
|1.3|matches.php|CRUD completo de partidas|1.5h|
|1.4|scouting.php|Rounds + cycles de scouting|2h|

#### 6.1.2 Frontend Tasks

|Task|File|Descrição|Est.|
|---|---|---|---|
|1.5|types.ts|Adicionar tipos de campeonato|30min|
|1.6|LoginForm.tsx|Form simples username only|30min|
|1.7|useAuth.ts|Hook de auth com localStorage|30min|
|1.8|championships.tsx|Lista de partidas básica|1h|
|1.9|MatchForm.tsx|Form criar partida|45min|
|1.10|MatchModal.tsx|Modal básico (sem gráficos)|1.5h|
|1.11|ChampionshipTimer.tsx|Timer adaptado com header|1h|

#### 6.1.3 Acceptance Criteria

- [ ]  Scout pode fazer login com username
- [ ]  Scout pode criar partida manualmente
- [ ]  Scout pode ver lista de partidas
- [ ]  Scout pode abrir modal de partida
- [ ]  Scout pode iniciar scouting de uma equipe
- [ ]  Ciclos são salvos com match_id e team_number corretos
- [ ]  Dados estão corretamente separados por equipe/período

---

### 🟡 PHASE 2: Polish & Features (Próxima semana)

**Objetivo:** UX melhorada e features adicionais  
**Tempo estimado:** 8-12 horas

#### 6.2.1 Tasks

|Task|Descrição|Est.|
|---|---|---|
|2.1|Lock mechanism - avisar se equipe já sendo scoutada|1h|
|2.2|Match scores - input e cálculo de totais|1h|
|2.3|StatsComparison.tsx - gráficos comparativos|2h|
|2.4|scouting-stats.php - endpoint de stats|1.5h|
|2.5|TeamCard enriquecido com stats inline|1h|
|2.6|Filtros e busca na lista de partidas|1h|
|2.7|Edit/Delete match confirmations|30min|
|2.8|Improve mobile UX|2h|
|2.9|Team stats page (team-stats.tsx)|2h|

---

### 🟢 PHASE 3: Nice to Have (Futuro)

**Objetivo:** Features avançadas  
**Tempo estimado:** Variable

|Task|Descrição|Priority|
|---|---|---|
|3.1|Media upload e galeria|Medium|
|3.2|Import matches from API (se disponível)|Medium|
|3.3|Export dados para CSV/Excel|Low|
|3.4|Comparador de equipes avançado|Low|
|3.5|Histórico de partidas da equipe|Low|
|3.6|Notificações de próxima partida|Low|
|3.7|Offline support (PWA)|Low|
|3.8|Championship management (múltiplos eventos)|Low|

---

## 7. Data Flow Diagrams

### 7.1 Scouting Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SCOUTING DATA FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

Scout Opens App
       │
       ▼
  ┌─────────┐     localStorage      ┌──────────────────────┐
  │  Login  │ ◀─────────────────────│  Check stored user   │
  │  Form   │                       └──────────────────────┘
  └────┬────┘
       │ username
       ▼
  ┌─────────────────┐
  │  POST /scouts   │─────▶ scouts table
  └────────┬────────┘
           │ scout_id stored in localStorage
           ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                     MATCH LIST VIEW                              │
  │  GET /matches.php                                                │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                     MATCH MODAL                                  │
  │  GET /matches.php?id=X (includes scouting_rounds)               │
  └──────────────────────────────┬──────────────────────────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
           ▼                     ▼                     ▼
    View Only Mode        Edit Match Mode       Start Scouting
                                │                     │
                                ▼                     ▼
                      PATCH /matches.php    ┌─────────────────────┐
                                           │ POST /scouting.php   │
                                           │ {match_id, team, id} │
                                           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │ scouting_rounds     │
                                           │ (is_locked = 1)     │
                                           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │ CHAMPIONSHIP TIMER  │
                                           │ (Mark Cycles)       │
                                           └──────────┬──────────┘
                                                      │
                                                      │ Each cycle:
                                           ┌──────────▼──────────┐
                                           │POST /scouting.php   │
                                           │?action=cycle        │
                                           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │ scouting_cycles     │
                                           │ table               │
                                           └──────────┬──────────┘
                                                      │
                                                      │ Finish:
                                           ┌──────────▼──────────┐
                                           │PATCH /scouting.php  │
                                           │?id=X                │
                                           │{end_time, obs, ...} │
                                           └──────────┬──────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │ scouting_rounds     │
                                           │ (is_locked = 0)     │
                                           │ (end_time = NOW)    │
                                           └─────────────────────┘
```

### 7.2 Stats Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STATS CALCULATION FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

Request: GET /scouting-stats.php?team=24888
                    │
                    ▼
         ┌──────────────────────┐
         │  Query scouting_     │
         │  rounds WHERE        │
         │  team_number = X     │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  For each round,     │
         │  join scouting_      │
         │  cycles              │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────────────────────────────────┐
         │  AGGREGATE BY PERIOD                              │
         │                                                   │
         │  Auto:                                            │
         │    WHERE is_autonomous = 1                        │
         │    SUM(hits), SUM(misses), AVG(duration)         │
         │                                                   │
         │  TeleOp:                                          │
         │    WHERE is_autonomous = 0                        │
         │    GROUP BY time_interval ('0-30s', etc.)        │
         │    SUM(hits), SUM(misses), AVG(duration)         │
         └──────────────────────┬───────────────────────────┘
                                │
                                ▼
         ┌──────────────────────────────────────────────────┐
         │  CALCULATE DERIVED METRICS                        │
         │                                                   │
         │  hitRate = 100 * hits / (hits + misses)          │
         │  avgCycleTime = totalDuration / cycleCount       │
         │  cyclesPerMatch = totalCycles / matchCount       │
         └──────────────────────┬───────────────────────────┘
                                │
                                ▼
         ┌──────────────────────────────────────────────────┐
         │  RETURN JSON                                      │
         │  {                                                │
         │    teamNumber: 24888,                            │
         │    matchesScouted: 5,                            │
         │    autoHits: 12,                                 │
         │    teleopHits: 45,                               │
         │    hitRate: 78.2,                                │
         │    ...                                           │
         │  }                                                │
         └──────────────────────────────────────────────────┘
```

---

## 8. Edge Cases & Considerations

### 8.1 Concurrent Access

#### 8.1.1 Problem: Two Scouts Same Team

```
Scout A clicks "Scout #24888"     Scout B clicks "Scout #24888"
        │                                  │
        ▼                                  ▼
   Check lock                         Check lock
   (is_locked = 0)                   (is_locked = 0)
        │                                  │
        ▼                                  ▼
   Create round                       Create round
   set is_locked = 1                 set is_locked = 1
        │                                  │
        ▼                                  ▼
     CONFLICT! Both think they're scouting
```

#### 8.1.2 Solution: Pessimistic Locking

```php
// scouting.php - POST handler

$db->beginTransaction();

try {
    // 1. Check for existing locked round
    $existing = $db->prepare("
        SELECT id, scout_id, locked_at 
        FROM scouting_rounds 
        WHERE match_id = ? AND team_number = ? AND is_locked = 1
        FOR UPDATE
    ")->execute([$matchId, $teamNumber])->fetch();
    
    if ($existing) {
        // Check if lock is stale (> 5 minutes)
        $lockAge = time() - strtotime($existing['locked_at']);
        if ($lockAge < 300) {
            // Get scout name
            $scout = getScoutById($existing['scout_id']);
            throw new Exception(json_encode([
                'error' => 'team_locked',
                'message' => "Esta equipe está sendo scoutada por {$scout['username']}",
                'lockedBy' => $scout['username'],
                'lockedAt' => $existing['locked_at']
            ]));
        }
        // Stale lock - release it
        $db->prepare("UPDATE scouting_rounds SET is_locked = 0 WHERE id = ?")
           ->execute([$existing['id']]);
    }
    
    // 2. Create or get round
    $existingRound = $db->prepare("
        SELECT id FROM scouting_rounds 
        WHERE match_id = ? AND team_number = ?
    ")->execute([$matchId, $teamNumber])->fetch();
    
    if ($existingRound) {
        // Resume existing round
        $roundId = $existingRound['id'];
        $db->prepare("
            UPDATE scouting_rounds 
            SET is_locked = 1, locked_at = ?, scout_id = ?
            WHERE id = ?
        ")->execute([date('c'), $scoutId, $roundId]);
    } else {
        // Create new round
        $roundId = generateId();
        $db->prepare("
            INSERT INTO scouting_rounds (id, match_id, team_number, scout_id, start_time, is_locked, locked_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        ")->execute([$roundId, $matchId, $teamNumber, $scoutId, date('c'), date('c')]);
    }
    
    $db->commit();
    
    jsonResponse(['id' => $roundId, 'status' => 'locked']);
    
} catch (Exception $e) {
    $db->rollBack();
    $data = json_decode($e->getMessage(), true);
    if ($data && isset($data['error'])) {
        jsonResponse($data, 409); // Conflict
    }
    throw $e;
}
```

#### 8.1.3 Frontend Handling

```typescript
// useScouting.ts

const startScouting = async (matchId: string, teamNumber: number) => {
  try {
    const response = await fetchApi<{ id: string }>('/scouting.php', {
      method: 'POST',
      body: JSON.stringify({ matchId, teamNumber, scoutId: auth.user.id })
    });
    
    return { success: true, roundId: response.id };
    
  } catch (error: any) {
    if (error.status === 409 && error.data?.error === 'team_locked') {
      // Show confirmation dialog
      const proceed = await showConfirmDialog({
        title: 'Equipe Já Está Sendo Scoutada',
        message: `${error.data.lockedBy} está scoutando esta equipe desde ${formatTime(error.data.lockedAt)}. Deseja continuar mesmo assim?`,
        confirmText: 'Continuar',
        cancelText: 'Escolher Outra'
      });
      
      if (proceed) {
        // Force start (backend should handle releasing old lock)
        return startScouting(matchId, teamNumber); // Retry
      }
      return { success: false, reason: 'user_cancelled' };
    }
    throw error;
  }
};
```

### 8.2 Data Validation

```php
// Validações críticas

function validateMatchData($data) {
    $errors = [];
    
    // Required fields
    $required = ['match_type', 'match_number', 'red_team1_number', 'red_team2_number', 
                 'blue_team1_number', 'blue_team2_number'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            $errors[] = "Campo obrigatório: $field";
        }
    }
    
    // Team numbers must be unique in match
    $teams = [
        $data['red_team1_number'] ?? 0,
        $data['red_team2_number'] ?? 0,
        $data['blue_team1_number'] ?? 0,
        $data['blue_team2_number'] ?? 0
    ];
    if (count($teams) !== count(array_unique($teams))) {
        $errors[] = "Números de equipe devem ser únicos na partida";
    }
    
    // Match type validation
    if (!in_array($data['match_type'], ['qualification', 'elimination'])) {
        $errors[] = "Tipo de partida inválido";
    }
    
    // Match number must be positive
    if (($data['match_number'] ?? 0) < 1) {
        $errors[] = "Número da partida deve ser maior que 0";
    }
    
    return $errors;
}

function validateCycleData($data, $scoutingRound) {
    $errors = [];
    
    // Timestamp must be within match duration
    $maxTimestamp = 168000; // 2:48 with buffer
    if (($data['timestamp'] ?? 0) > $maxTimestamp) {
        $errors[] = "Timestamp excede duração da partida";
    }
    
    // is_autonomous must match timestamp
    $isAuto = $data['timestamp'] < 30000;
    if (isset($data['is_autonomous']) && $data['is_autonomous'] != $isAuto) {
        $errors[] = "Flag is_autonomous não corresponde ao timestamp";
    }
    
    // Hits and misses must be non-negative
    if (($data['hits'] ?? 0) < 0 || ($data['misses'] ?? 0) < 0) {
        $errors[] = "Hits e misses devem ser >= 0";
    }
    
    return $errors;
}
```

### 8.3 Error Handling

```typescript
// Frontend error handling patterns

// Global error handler
const handleApiError = (error: ApiError) => {
  switch (error.status) {
    case 400:
      toast.error(`Dados inválidos: ${error.message}`);
      break;
    case 404:
      toast.error('Recurso não encontrado');
      break;
    case 409:
      // Conflict - handled specifically by each action
      break;
    case 500:
      toast.error('Erro no servidor. Tente novamente.');
      console.error('Server error:', error);
      break;
    default:
      toast.error('Erro desconhecido');
  }
};

// Auto-save for scouting rounds (prevent data loss)
const useAutoSave = (roundId: string, cycles: Cycle[]) => {
  useEffect(() => {
    if (!roundId || cycles.length === 0) return;
    
    const saveToLocalStorage = () => {
      localStorage.setItem(`scouting_backup_${roundId}`, JSON.stringify({
        cycles,
        savedAt: Date.now()
      }));
    };
    
    // Save every 10 seconds
    const interval = setInterval(saveToLocalStorage, 10000);
    
    // Also save on visibility change (user switching tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveToLocalStorage();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roundId, cycles]);
};
```

### 8.4 Network Issues

```typescript
// Retry logic for critical operations

const saveWithRetry = async (endpoint: string, data: any, maxRetries = 3) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        // Wait before retry: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }
  
  // All retries failed - save locally
  const pendingOps = JSON.parse(localStorage.getItem('pending_operations') || '[]');
  pendingOps.push({ endpoint, data, timestamp: Date.now() });
  localStorage.setItem('pending_operations', JSON.stringify(pendingOps));
  
  toast.warning('Dados salvos localmente. Serão sincronizados quando a conexão voltar.');
  
  throw lastError;
};

// Sync pending operations on app start
const syncPendingOperations = async () => {
  const pending = JSON.parse(localStorage.getItem('pending_operations') || '[]');
  if (pending.length === 0) return;
  
  for (const op of pending) {
    try {
      await fetchApi(op.endpoint, {
        method: 'POST',
        body: JSON.stringify(op.data)
      });
    } catch {
      // Keep in pending if still fails
      continue;
    }
  }
  
  // Remove synced operations
  localStorage.setItem('pending_operations', JSON.stringify(
    pending.filter(op => /* still failed */)
  ));
};
```

---

## 9. Glossary

|Term|Portuguese|Definition|
|---|---|---|
|Match|Partida|Um jogo entre duas alianças|
|Alliance|Aliança|Grupo de 2 equipes (Red ou Blue)|
|Round|Round|Performance de 1 equipe em 1 partida|
|Cycle|Ciclo|Uma ação de scoring|
|Scout|Scout|Pessoa fazendo o scouting|
|Hit|Acerto|Tentativa bem-sucedida de scoring|
|Miss|Erro|Tentativa falha de scoring|
|Auto|Autônomo|Período de 30s sem controle do driver|
|TeleOp|Teleoperado|Período de 120s com controle do driver|
|Endgame|Endgame|Últimos 30s do TeleOp|

---

## 10. Appendix

### 10.1 Reference Images

Os arquivos `image.png` e `image (2).png` mostram exemplos de Match Modal com:

- Layout de 2 alianças lado a lado
- Cards de equipe com banner, número, nome
- Breakdown de scores (Auto, TeleOp, Penalties)
- Dropdowns expansíveis para detalhes
- Indicação de vencedor

### 10.2 Contact & Resources

- **FTC Game Manual**: Consultar para regras específicas da temporada
- **API externa**: Verificar disponibilidade para import de partidas

---

_Documento gerado para o projeto AnalisadorDeTreinosFtc_  
_Versão 1.0 - Nacional 2026_