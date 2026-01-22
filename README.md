# FTC Cycle Timer 🤖⏱️

Ferramenta para cronometrar e analisar ciclos de pontuação do robô FTC durante teleop.

## Funcionalidades

- ⏱️ **Cronômetro de Round** - Timer de 2 minutos com indicadores visuais por intervalo
- 🎯 **Marcação de Ciclos** - Aperte ESPAÇO para marcar fim de cada ciclo
- ✅ **Registro de Acertos/Erros** - Digite os valores e Tab para navegar
- 📊 **Dashboard** - Estatísticas, gráficos e evolução
- 📜 **Histórico** - Visualize todos os rounds anteriores
- 📥 **Exportação CSV** - Exporte dados para planilha

## Instalação Local

### Pré-requisitos
- Node.js 18+ (https://nodejs.org)

### Passos

1. **Instalar dependências:**
```bash
npm install
```

2. **Inicializar o banco de dados:**
```bash
npm run db:init
```

3. **Rodar em desenvolvimento:**
```bash
npm run dev
```

4. Acesse: http://localhost:3000

## Hospedagem na Hostinger

### Opção 1: Node.js Hosting (recomendado)

Se você tem hospedagem Node.js na Hostinger:

1. Faça upload de todos os arquivos
2. No terminal SSH:
```bash
npm install
npm run db:init
npm run build
npm start
```

### Opção 2: Hospedagem Compartilhada (sem Node.js)

Hostinger compartilhada não suporta Node.js nativamente. Alternativas:

1. **Vercel (grátis)** - https://vercel.com
   - Conecte seu GitHub e deploy automático
   - Funciona perfeitamente com Next.js + SQLite

2. **Railway (grátis com limites)** - https://railway.app

3. **Render (grátis com limites)** - https://render.com

## Estrutura do Banco

O SQLite cria um arquivo `prisma/data.db` que contém todos os seus dados.
**Faça backup deste arquivo para não perder seus registros!**

## Atalhos de Teclado

- **ESPAÇO** - Marcar fim do ciclo (durante round ativo)
- **TAB** - Navegar entre campos de acertos/erros
- **ENTER** - Confirmar ciclo
- **ESC** - Cancelar/fechar modal

## Dicas de Uso

1. Inicie o round quando o teleop começar
2. Aperte ESPAÇO cada vez que completar um ciclo de pontuação
3. Digite rapidamente acertos → TAB → erros → ENTER
4. Ao final, clique em "Finalizar" para salvar
5. Analise no Dashboard e exporte para planilha

---
Feito com ❤️ para a comunidade FTC
