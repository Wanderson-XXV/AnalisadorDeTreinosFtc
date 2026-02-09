# Como Alternar entre Desenvolvimento e Produção

## Método Simples (Recomendado)

Edite o arquivo `client/app/lib/api.ts`:

### Para DESENVOLVIMENTO LOCAL:
```typescript
// DESENVOLVIMENTO (local)
export const API_BASE = 'http://localhost:8000';

// PRODUÇÃO (hospedagem) - comente esta linha
// export const API_BASE = '/techfenixscoutapp/api';
```

### Para PRODUÇÃO:
```typescript
// PRODUÇÃO (hospedagem)
export const API_BASE = '/techfenixscoutapp/api';

// DESENVOLVIMENTO (local) - comente esta linha
// export const API_BASE = 'http://localhost:8000';
```

## Comandos

### Desenvolvimento Local:
1. Certifique-se de que `API_BASE = 'http://localhost:8000'` está ativo
2. Execute:
```bash
cd client
npm run dev
```

### Build para Produção:
1. Certifique-se de que `API_BASE = '/techfenixscoutapp/api'` está ativo
2. Execute:
```bash
cd client
npm run build
```
3. Faça upload da pasta `build/` para o servidor

## Dica Rápida

Antes de fazer o build para produção, sempre verifique se a linha correta está ativa no `api.ts`:
- ✅ `export const API_BASE = '/techfenixscoutapp/api';` (sem //)
- ❌ `// export const API_BASE = 'http://localhost:8000';` (com //)
