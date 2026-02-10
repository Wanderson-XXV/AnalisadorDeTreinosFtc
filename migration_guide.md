# Guia de Migração: Novas Funcionalidades FTC Cycle Timer

Este documento descreve todas as alterações necessárias para adicionar as funcionalidades de:
- **Zona de lançamento** (perto/longe) por ciclo
- **Tipo de round** (só teleop / completo com autônomo)
- **Rastreamento de bateria** (nome e voltagem)
- **Estratégia calculada** automaticamente
- **Marcação de ciclos autônomos**

---

## 1. Banco de Dados SQLite

### 1.1 Novas Colunas

No arquivo `api/config.php`, adicione as migrations após criar as tabelas:

```php
// Adicionar após a criação das tabelas originais
$migrations = [
    // Tabela rounds
    "ALTER TABLE rounds ADD COLUMN round_type TEXT DEFAULT 'teleop_only'",
    "ALTER TABLE rounds ADD COLUMN battery_name TEXT",
    "ALTER TABLE rounds ADD COLUMN battery_volts REAL",
    "ALTER TABLE rounds ADD COLUMN strategy TEXT",
    
    // Tabela cycles
    "ALTER TABLE cycles ADD COLUMN zone TEXT",
    "ALTER TABLE cycles ADD COLUMN is_autonomous INTEGER DEFAULT 0"
];

foreach ($migrations as $sql) {
    try {
        $pdo->exec($sql);
    } catch (PDOException $e) {
        // Coluna já existe, ignorar erro
    }
}
```

### 1.2 Compatibilidade com Dados Antigos

| Campo | Default | Comportamento |
|-------|---------|---------------|
| `round_type` | `'teleop_only'` | Rounds antigos = apenas teleop |
| `battery_name` | `NULL` | UI mostra "-" ou esconde |
| `battery_volts` | `NULL` | UI mostra "-" ou esconde |
| `strategy` | `NULL` | Nenhum badge mostrado |
| `zone` | `NULL` | UI mostra "-" |
| `is_autonomous` | `0` | Ciclos antigos = não autônomos |

---

## 2. Tipos TypeScript (`lib/types.ts`)

### 2.1 Novos Tipos

```typescript
// Zona do ciclo
export type CycleZone = 'near' | 'far' | null;

// Tipo do round
export type RoundType = 'teleop_only' | 'full_match';

// Estratégia calculada
export type RoundStrategy = 'near' | 'hybrid' | 'far' | null;

// Lista de baterias (hardcoded)
export const BATTERIES = ['Bat1', 'Bat2', 'Bat3', 'Bat4', 'Bat5', 'Bat6'] as const;
export type BatteryName = typeof BATTERIES[number];
```

### 2.2 Constantes de Tempo

```typescript
export const TELEOP_DURATION = 120000;      // 2 minutos em ms
export const AUTO_DURATION = 30000;         // 30 segundos em ms
export const TRANSITION_DURATION = 8000;    // 8 segundos em ms
export const FULL_MATCH_DURATION = AUTO_DURATION + TRANSITION_DURATION + TELEOP_DURATION; // 2:38
```

### 2.3 Função para Calcular Estratégia

```typescript
export function calculateStrategy(cycles: CycleData[]): RoundStrategy {
  const validCycles = cycles.filter(c => c.zone !== null);
  if (validCycles.length === 0) return null;
  
  const nearCount = validCycles.filter(c => c.zone === 'near').length;
  const farCount = validCycles.filter(c => c.zone === 'far').length;
  const total = validCycles.length;
  
  const nearPercent = nearCount / total;
  const farPercent = farCount / total;
  
  if (nearPercent >= 0.7) return 'near';   // ≥70% perto
  if (farPercent >= 0.7) return 'far';     // ≥70% longe
  return 'hybrid';                          // híbrido
}
```

### 2.4 Interfaces Atualizadas

```typescript
export interface CycleData {
  id: number;
  roundId: number;
  cycleNumber: number;
  duration: number;        // em ms
  hits: number;
  misses: number;
  timestamp: number;       // em ms desde início do round
  timeInterval: string;    // '0-30s', '30-60s', etc. ou 'auto', 'transition'
  zone: CycleZone;         // NOVO: 'near', 'far', ou null
  isAutonomous: boolean;   // NOVO: true se foi durante autônomo
}

export interface RoundData {
  id: number;
  startTime: string;       // ISO date
  endTime: string | null;
  observations: string | null;
  totalDuration: number | null;
  cycles: CycleData[];
  roundType: RoundType;           // NOVO: 'teleop_only' ou 'full_match'
  batteryName: string | null;     // NOVO: 'Bat1', 'Bat2', etc.
  batteryVolts: number | null;    // NOVO: voltagem inicial
  strategy: RoundStrategy;        // NOVO: calculado ao finalizar
}
```

---

## 3. API PHP

### 3.1 `api/rounds.php` - POST (Criar Round)

```php
// Receber dados do body
$data = json_decode(file_get_contents('php://input'), true);

$startTime = $data['startTime'];
$roundType = $data['roundType'] ?? 'teleop_only';
$batteryName = $data['batteryName'] ?? null;
$batteryVolts = isset($data['batteryVolts']) ? (float)$data['batteryVolts'] : null;

// INSERT com novos campos
$stmt = $pdo->prepare("
    INSERT INTO rounds (start_time, round_type, battery_name, battery_volts) 
    VALUES (?, ?, ?, ?)
");
$stmt->execute([$startTime, $roundType, $batteryName, $batteryVolts]);
```

### 3.2 `api/rounds.php` - PATCH (Finalizar Round)

```php
$data = json_decode(file_get_contents('php://input'), true);

$endTime = $data['endTime'];
$totalDuration = $data['totalDuration'];
$observations = $data['observations'] ?? null;
$strategy = $data['strategy'] ?? null;  // NOVO: receber strategy calculada

$stmt = $pdo->prepare("
    UPDATE rounds 
    SET end_time = ?, total_duration = ?, observations = ?, strategy = ? 
    WHERE id = ?
");
$stmt->execute([$endTime, $totalDuration, $observations, $strategy, $roundId]);
```

### 3.3 `api/rounds.php` - GET (Listar Rounds)

Adicionar os novos campos no SELECT:

```php
$stmt = $pdo->query("
    SELECT id, start_time, end_time, observations, total_duration,
           round_type, battery_name, battery_volts, strategy
    FROM rounds 
    ORDER BY start_time DESC
");
```

### 3.4 `api/cycles.php` - POST (Criar Ciclo)

```php
$data = json_decode(file_get_contents('php://input'), true);

$roundId = $data['roundId'];
$cycleNumber = $data['cycleNumber'];
$duration = $data['duration'];
$hits = $data['hits'];
$misses = $data['misses'];
$timestamp = $data['timestamp'];
$zone = $data['zone'] ?? null;              // NOVO
$isFullMatch = $data['isFullMatch'] ?? false; // NOVO

// Calcular timeInterval
$timeInterval = getTimeInterval($timestamp, $isFullMatch);

// Determinar se é autônomo (apenas se full_match e timestamp < 30s)
$isAutonomous = ($isFullMatch && $timestamp < 30000) ? 1 : 0;

// INSERT
$stmt = $pdo->prepare("
    INSERT INTO cycles (round_id, cycle_number, duration, hits, misses, timestamp, time_interval, zone, is_autonomous)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->execute([$roundId, $cycleNumber, $duration, $hits, $misses, $timestamp, $timeInterval, $zone, $isAutonomous]);

// Função auxiliar
function getTimeInterval($timestamp, $isFullMatch) {
    if ($isFullMatch) {
        // Round completo: 30s auto + 8s transição + 2min teleop
        if ($timestamp < 30000) {
            return 'auto';
        }
        if ($timestamp < 38000) {
            return 'transition';
        }
        // Teleop começa após 38s
        $teleopTime = $timestamp - 38000;
    } else {
        // Só teleop
        $teleopTime = $timestamp;
    }
    
    // Intervalos de 30s do teleop
    $intervals = ['0-30s', '30-60s', '60-90s', '90-120s'];
    $idx = min(floor($teleopTime / 30000), 3);
    return $intervals[$idx];
}
```

### 3.5 `api/cycles.php` - GET (Listar Ciclos)

Adicionar novos campos no SELECT:

```php
$stmt = $pdo->prepare("
    SELECT id, round_id, cycle_number, duration, hits, misses, 
           timestamp, time_interval, zone, is_autonomous
    FROM cycles 
    WHERE round_id = ?
    ORDER BY cycle_number ASC
");
```

---

## 4. Frontend - Alterações nos Componentes

### 4.1 RoundTimer (ou equivalente)

#### Novos Estados

```typescript
const [roundType, setRoundType] = useState<RoundType>('teleop_only');
const [batteryName, setBatteryName] = useState<string | null>(null);
const [batteryVolts, setBatteryVolts] = useState<number | null>(null);
```

#### Duração Dinâmica

```typescript
const roundDuration = roundType === 'full_match' ? FULL_MATCH_DURATION : TELEOP_DURATION;
```

#### UI Pré-Round (mostrar quando !isRunning && !roundId)

```tsx
{/* Seletor de Modo */}
<div className="flex gap-2">
  <button 
    onClick={() => setRoundType('teleop_only')}
    className={roundType === 'teleop_only' ? 'bg-orange-500' : 'bg-slate-700'}
  >
    Só Teleop (2:00)
  </button>
  <button 
    onClick={() => setRoundType('full_match')}
    className={roundType === 'full_match' ? 'bg-blue-500' : 'bg-slate-700'}
  >
    Completo (2:38)
  </button>
</div>

{/* Seletor de Bateria */}
<select value={batteryName || ''} onChange={(e) => setBatteryName(e.target.value || null)}>
  <option value="">Selecionar bateria</option>
  {BATTERIES.map(bat => (
    <option key={bat} value={bat}>{bat}</option>
  ))}
</select>

{/* Input de Voltagem */}
<input 
  type="number" 
  step="0.1" 
  placeholder="Volts"
  value={batteryVolts || ''}
  onChange={(e) => setBatteryVolts(e.target.value ? parseFloat(e.target.value) : null)}
/>
```

#### Ao Iniciar Round

```typescript
const handleStart = async () => {
  const response = await fetch('/api/rounds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startTime: new Date().toISOString(),
      roundType,
      batteryName,
      batteryVolts
    })
  });
  // ...
};
```

#### Indicador de Fase (durante round full_match)

```typescript
const getCurrentPhase = () => {
  if (roundType !== 'full_match') return 'teleop';
  if (elapsedTime < AUTO_DURATION) return 'auto';
  if (elapsedTime < AUTO_DURATION + TRANSITION_DURATION) return 'transition';
  return 'teleop';
};

// Na UI:
{roundType === 'full_match' && (
  <div className="phase-indicator">
    {getCurrentPhase() === 'auto' && '🤖 AUTÔNOMO'}
    {getCurrentPhase() === 'transition' && '⏳ TRANSIÇÃO'}
    {getCurrentPhase() === 'teleop' && '🎮 TELEOP'}
  </div>
)}
```

#### Ao Registrar Ciclo

```typescript
const handleCycleSubmit = async (hits: number, misses: number, zone: CycleZone) => {
  const isAutonomous = roundType === 'full_match' && pendingCycle.timestamp < AUTO_DURATION;
  
  await fetch('/api/cycles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roundId,
      cycleNumber: cycles.length + 1,
      duration: pendingCycle.duration,
      hits,
      misses,
      timestamp: pendingCycle.timestamp,
      zone,
      isFullMatch: roundType === 'full_match'
    })
  });
  
  // Atualizar lista local
  setCycles(prev => [...prev, {
    ...newCycle,
    zone,
    isAutonomous
  }]);
};
```

#### Ao Finalizar Round

```typescript
const handleFinish = async () => {
  const strategy = calculateStrategy(cycles);
  
  await fetch(`/api/rounds/${roundId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endTime: new Date().toISOString(),
      totalDuration: elapsedTime,
      observations,
      strategy
    })
  });
};
```

#### Estatísticas Resumidas

```typescript
const nearCycles = cycles.filter(c => c.zone === 'near').length;
const farCycles = cycles.filter(c => c.zone === 'far').length;
const autoCycles = cycles.filter(c => c.isAutonomous).length;

// Na UI:
<div>Perto: {nearCycles}</div>
<div>Longe: {farCycles}</div>
{roundType === 'full_match' && <div>Auto: {autoCycles}</div>}
```

---

### 4.2 CycleModal

#### Novo Estado

```typescript
const [zone, setZone] = useState<CycleZone>('near');
```

#### Props Atualizadas

```typescript
interface CycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (hits: number, misses: number, zone: CycleZone) => void;
  cycleNumber: number;
  cycleDuration: number;
  isAutonomous?: boolean;  // NOVO
}
```

#### Toggle de Zona na UI

```tsx
<div className="zone-selector">
  <label>Zona de Lançamento:</label>
  <div className="flex gap-2">
    <button
      onClick={() => setZone('near')}
      className={zone === 'near' ? 'bg-green-500' : 'bg-slate-700'}
    >
      🎯 Perto
    </button>
    <button
      onClick={() => setZone('far')}
      className={zone === 'far' ? 'bg-blue-500' : 'bg-slate-700'}
    >
      ✕ Longe
    </button>
  </div>
</div>
```

#### Título com Indicador de Autônomo

```tsx
<h2>
  {isAutonomous && <span className="text-yellow-400">[AUTO] </span>}
  Ciclo {cycleNumber}
</h2>
```

#### onSubmit Atualizado

```typescript
const handleSubmit = () => {
  onSubmit(hits, misses, zone);
  setHits(0);
  setMisses(0);
  setZone('near'); // Reset para próximo ciclo
};
```

---

### 4.3 CycleList

#### Exibir Zona e Autônomo

```tsx
{cycles.map(cycle => (
  <div 
    key={cycle.id} 
    className={`cycle-item ${cycle.isAutonomous ? 'border-l-4 border-yellow-400' : ''}`}
  >
    {/* Indicador de autônomo */}
    {cycle.isAutonomous && (
      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">
        🤖 Auto
      </span>
    )}
    
    {/* Intervalo */}
    <span className={`interval-badge ${cycle.timeInterval === 'auto' ? 'bg-yellow-500/20' : 'bg-slate-700'}`}>
      {cycle.timeInterval}
    </span>
    
    {/* Zona */}
    {cycle.zone ? (
      <span className={`zone-badge ${
        cycle.zone === 'near' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
      }`}>
        {cycle.zone === 'near' ? '🎯 Perto' : '✕ Longe'}
      </span>
    ) : (
      <span className="text-slate-500">-</span>
    )}
    
    {/* Resto das infos: duração, acertos, erros */}
    <span>{(cycle.duration / 1000).toFixed(2)}s</span>
    <span className="text-green-400">{cycle.hits} acertos</span>
    <span className="text-red-400">{cycle.misses} erros</span>
  </div>
))}
```

---

### 4.4 TimerDisplay

#### Props Atualizadas

```typescript
interface TimerDisplayProps {
  timeMs: number;
  isRunning: boolean;
  totalMs: number;
  roundType?: RoundType;  // NOVO
}
```

#### Intervalos Dinâmicos

```typescript
const getIntervals = () => {
  if (roundType === 'full_match') {
    return [
      { label: '🤖 Auto', start: 0, end: AUTO_DURATION },
      { label: '⏳', start: AUTO_DURATION, end: AUTO_DURATION + TRANSITION_DURATION },
      { label: '0-30s', start: 38000, end: 68000 },
      { label: '30-60s', start: 68000, end: 98000 },
      { label: '60-90s', start: 98000, end: 128000 },
      { label: '90-120s', start: 128000, end: 158000 },
    ];
  }
  return [
    { label: '0-30s', start: 0, end: 30000 },
    { label: '30-60s', start: 30000, end: 60000 },
    { label: '60-90s', start: 60000, end: 90000 },
    { label: '90-120s', start: 90000, end: 120000 },
  ];
};
```

---

### 4.5 HistoryContent

#### Exibir Novos Dados do Round

```tsx
{/* Header do Round */}
<div className="round-header">
  {/* Tipo do round */}
  <span className={`badge ${
    round.roundType === 'full_match' ? 'bg-blue-500' : 'bg-orange-500'
  }`}>
    {round.roundType === 'full_match' ? 'Completo' : 'Teleop'}
  </span>
  
  {/* Estratégia */}
  {round.strategy && (
    <span className={`badge ${
      round.strategy === 'near' ? 'bg-green-500' :
      round.strategy === 'far' ? 'bg-blue-500' : 'bg-purple-500'
    }`}>
      {round.strategy === 'near' ? '🎯 Perto' :
       round.strategy === 'far' ? '✕ Longe' : '🔄 Híbrido'}
    </span>
  )}
  
  {/* Bateria */}
  {round.batteryName && (
    <span className="text-slate-400">
      🔋 {round.batteryName}
      {round.batteryVolts && ` (${round.batteryVolts}V)`}
    </span>
  )}
</div>
```

#### Tabela de Ciclos com Zona

```tsx
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Tempo</th>
      <th>Intervalo</th>
      <th>Zona</th>  {/* NOVO */}
      <th>Acertos</th>
      <th>Erros</th>
    </tr>
  </thead>
  <tbody>
    {round.cycles.map(cycle => (
      <tr key={cycle.id} className={cycle.isAutonomous ? 'bg-yellow-500/10' : ''}>
        <td>
          {cycle.cycleNumber}
          {cycle.isAutonomous && ' 🤖'}
        </td>
        <td>{(cycle.duration / 1000).toFixed(2)}s</td>
        <td>{cycle.timeInterval}</td>
        <td>
          {cycle.zone === 'near' && <span className="text-green-400">Perto</span>}
          {cycle.zone === 'far' && <span className="text-blue-400">Longe</span>}
          {!cycle.zone && '-'}
        </td>
        <td className="text-green-400">{cycle.hits}</td>
        <td className="text-red-400">{cycle.misses}</td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## 5. Mapeamento de Campos PHP ↔ TypeScript

| PHP (snake_case) | TypeScript (camelCase) |
|------------------|------------------------|
| `round_type` | `roundType` |
| `battery_name` | `batteryName` |
| `battery_volts` | `batteryVolts` |
| `is_autonomous` | `isAutonomous` |
| `time_interval` | `timeInterval` |
| `cycle_number` | `cycleNumber` |
| `start_time` | `startTime` |
| `end_time` | `endTime` |
| `total_duration` | `totalDuration` |
| `round_id` | `roundId` |

**Lembre-se:** No PHP, ao retornar JSON, converta para camelCase. Ao receber JSON, aceite camelCase.

---

## 6. Resumo das Alterações por Arquivo

| Arquivo | Alterações |
|---------|------------|
| `api/config.php` | Adicionar migrations para novas colunas |
| `api/rounds.php` | GET: retornar novos campos; POST: aceitar roundType, battery; PATCH: aceitar strategy |
| `api/cycles.php` | GET: retornar zone, isAutonomous; POST: aceitar zone, isFullMatch, calcular timeInterval |
| `lib/types.ts` | Adicionar tipos, constantes, interfaces, função calculateStrategy |
| `RoundTimer` | Estados de config, UI pré-round, indicador de fase, passar zone/isFullMatch |
| `CycleModal` | Toggle de zona, indicador de autônomo |
| `CycleList` | Badges de zona e autônomo |
| `TimerDisplay` | Intervalos dinâmicos para full_match |
| `HistoryContent` | Exibir tipo, estratégia, bateria, zona na tabela |

---

## 7. Fluxo Completo de um Round

1. **Pré-round:** Usuário seleciona modo (teleop/completo), bateria e voltagem
2. **Iniciar:** POST `/api/rounds` com `roundType`, `batteryName`, `batteryVolts`
3. **Durante:** Timer roda, fases mudam (se full_match)
4. **Marcar ciclo:** Abre modal, usuário seleciona zona (perto/longe)
5. **Salvar ciclo:** POST `/api/cycles` com `zone`, `isFullMatch`
6. **Finalizar:** Calcula `strategy` no frontend, PATCH `/api/rounds/{id}`

---

Pronto! Use este documento como contexto para adaptar seu projeto existente.