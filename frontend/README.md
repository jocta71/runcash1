# RunCash - Frontend

## Estrutura do Projeto

O frontend do RunCash é construído com React, TypeScript e Tailwind CSS. A estrutura do diretório está organizada da seguinte forma:

```
src/
├── components/       # Componentes React
│   ├── auth/         # Componentes relacionados à autenticação
│   ├── chat/         # Componentes de chat
│   ├── common/       # Componentes utilitários comuns
│   ├── layout/       # Componentes de layout (Layout, Sidebar, Navbar)
│   ├── roulette/     # Componentes específicos de roleta
│   ├── roulette-cards/# Cards e grid de roletas
│   ├── stats/        # Componentes de estatísticas
│   └── ui/           # Componentes de UI básicos
├── config/          # Configurações
├── context/         # Contextos React
├── hooks/           # Custom hooks
├── integrations/    # Integrações com APIs
├── lib/             # Bibliotecas e utilitários
├── pages/           # Páginas da aplicação
├── services/        # Serviços (API, WebSocket, etc.)
├── stores/          # Stores (Zustand, etc.)
├── styles/          # Estilos globais
└── types/           # Tipos TypeScript
```

## Componentes Principais

### Layout

O layout principal do aplicativo é dividido em:
- **Sidebar**: Menu lateral com navegação principal
- **Navbar**: Barra superior com pesquisa e perfil
- **ChatUI**: Painel de chat ao vivo posicionado na parte inferior direita

### Cards de Roletas

Os cards de roletas exibem:
- Nome da roleta
- Últimos números sorteados
- Estatísticas básicas
- Grid responsivo que exibe 4 cards por linha em telas grandes

### Chat

O chat ao vivo permite:
- Visualização de mensagens de outros usuários
- Envio de mensagens
- Badges para moderadores e administradores
- Contagem de usuários online

## Configuração e Execução

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Dependências Principais

- React
- TypeScript
- Tailwind CSS
- Vite
- React Router
- Lucide React (ícones)
- Tanstack Query (gerenciamento de estado)

## Recursos

- Visualização em tempo real dos números da roleta
- Autenticação com email/senha e provedores sociais
- Sugestões de estratégia
- Design responsivo para todos os dispositivos
- Dashboard de estatísticas

## Stack Tecnológico

- React com TypeScript
- Vite para ferramentas de build
- Tailwind CSS para estilização
- Supabase para autenticação
- React Router para navegação
- Componentes UI Shadcn

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

## Configuração

Crie um arquivo `.env` no diretório frontend com as seguintes variáveis:

```
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_KEY=sua_chave_anon_supabase
VITE_API_URL=sua_url_api
```

Para produção, certifique-se de definir essas variáveis de ambiente na sua plataforma de hospedagem.

## Estrutura de Diretórios

```
frontend/
├── api/                # Funções serverless (Vercel/Netlify)
├── public/             # Arquivos estáticos
├── src/
│   ├── components/     # Componentes React reutilizáveis
│   ├── context/        # Contextos React (auth, subscription)
│   ├── hooks/          # Hooks personalizados
│   ├── integrations/   # Integrações com serviços (Supabase, Stripe)
│   ├── lib/            # Bibliotecas utilitárias
│   ├── pages/          # Páginas/componentes de rota
│   ├── services/       # Serviços (EventService para SSE)
│   ├── types/          # Definições de tipos TypeScript
│   └── utils/          # Funções utilitárias
└── ...
```

## Leia Também

Para mais informações sobre backend e scraper, consulte os respectivos README em seus diretórios. 