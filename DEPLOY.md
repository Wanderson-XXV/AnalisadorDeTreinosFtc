# Guia de Deploy - Hospedagem Compartilhada

## Estrutura de Pastas no Servidor

```
seu-dominio.com/
└── techfenixscoutapp/
    ├── client/ (build do frontend)
    │   ├── index.html
    │   ├── assets/
    │   └── .htaccess
    └── api/ (backend PHP)
        ├── config.php
        ├── rounds.php
        ├── cycles.php
        ├── stats.php
        ├── export.php
        ├── data.db
        └── .htaccess
```

## Passos para Deploy

### 1. Build do Frontend

No seu computador, execute:

```bash
cd client
npm install
npm run build
```

Isso vai gerar uma pasta `build` ou `dist` com os arquivos estáticos.

### 2. Upload dos Arquivos

#### Via FTP/SFTP:

1. Crie a pasta `techfenixscoutapp` no seu domínio
2. Dentro dela, crie duas pastas: `client` e `api`
3. Faça upload do conteúdo da pasta `build/` para `techfenixscoutapp/client/`
4. Faça upload de todos os arquivos da pasta `api/` para `techfenixscoutapp/api/`

#### Via cPanel File Manager:

1. Acesse o File Manager do cPanel
2. Navegue até `public_html` (ou `www`)
3. Crie a pasta `techfenixscoutapp`
4. Crie as subpastas `client` e `api`
5. Faça upload dos arquivos

### 3. Configurar Permissões

Certifique-se de que:
- A pasta `api/` tem permissão de escrita (755 ou 775)
- O arquivo `data.db` tem permissão 666 (leitura/escrita)
- Se o arquivo `data.db` não existir, será criado automaticamente

### 4. Testar a Aplicação

Acesse: `https://seu-dominio.com/techfenixscoutapp/`

## Verificações Importantes

### PHP
- Versão mínima: PHP 7.4
- Extensões necessárias: PDO, SQLite3

### Apache
- mod_rewrite habilitado
- .htaccess permitido (AllowOverride All)

## Troubleshooting

### Erro 404 nas rotas
- Verifique se o mod_rewrite está habilitado
- Confirme que o .htaccess está na pasta correta
- Verifique o RewriteBase no .htaccess

### Erro de CORS
- Verifique os headers no config.php
- Confirme que o .htaccess da API está configurado

### Banco de dados não funciona
- Verifique as permissões da pasta api/
- Certifique-se de que o SQLite está habilitado no PHP
- Verifique se o arquivo data.db pode ser criado/modificado

## Desenvolvimento Local

Para voltar ao desenvolvimento local, altere em `client/app/lib/api.ts`:

```typescript
// Produção
// export const API_BASE = '/techfenixscoutapp/api';

// Desenvolvimento
export const API_BASE = 'http://localhost:8000';
```

## Alternativa: Variáveis de Ambiente

Para facilitar, você pode criar um arquivo `.env` no client:

```env
VITE_API_BASE=/techfenixscoutapp/api
```

E usar no código:

```typescript
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
```
