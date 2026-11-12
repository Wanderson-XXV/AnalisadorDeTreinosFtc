# Analisador de Treinos FTC

Este repositório contém três componentes principais relacionados ao sistema de análise de treinos da FTC:

1. **API Backend PHP** - Sistema online de gerenciamento de scouts
2. **Cliente Web React** - Interface de visualização dos dados de scout
3. **Projeto Heatmap Python** - Ferramenta local para análise visual de arenas e trajetórias

## Estrutura do Projeto

- `api/` - Backend em PHP com SQLite
- `client/` - Frontend em React com TypeScript
- `heatmap_project/` - Projeto Python para análise visual e tracking

## Requisitos

### Para API Backend (PHP)
- PHP 7.4 ou superior
- Extensões PHP necessárias: PDO, SQLite3

### Para Cliente Web (React)
- Node.js 16 ou superior
- npm ou yarn

### Para Projeto Heatmap (Python)
- Python 3.8 ou superior
- Bibliotecas especificadas no `requirements.txt` do projeto

## Como Rodar

### API Backend PHP

```bash
cd api
php -S localhost:8000
```

A API estará disponível em http://localhost:8000

### Cliente Web React

Instale as dependências (primeira execução):

```bash
cd client
npm install
```

Execute o ambiente de desenvolvimento:

```bash
cd client
npm run dev
```

O cliente estará disponível em http://localhost:5173

Para produção:

```bash
cd client
npm run build
npm run start
```

### Projeto Heatmap Python

Consulte o README.md dentro da pasta `heatmap_project/` para instruções específicas de configuração e execução.

## Componentes Separados

Conforme especificado no AGENTS.md, este repositório contém dois produtos relacionados mas independentes:

1. **Sistema de Scout Online** (`api/` + `client/`) - Backend PHP e frontend web hospedado
2. **Robot Heatmap Scout** (`heatmap_project/`) - Ferramenta local Python para análise visual

Os componentes não devem ser misturados sem solicitação explícita.

## Scripts Disponíveis

### Cliente Web (React)

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Compila o projeto para produção
- `npm run start` - Inicia o servidor de produção
- `npm run typecheck` - Verifica tipos TypeScript
- `npm run test:timing` - Executa testes de timing

## Banco de Dados

O sistema utiliza SQLite como banco de dados, com o arquivo `data.db` localizado na pasta `api/`.

## Contribuição

Antes de editar qualquer arquivo, identifique qual componente a tarefa pediu conforme as regras no AGENTS.md.