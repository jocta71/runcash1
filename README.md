# Roulette Real-time Tracker

## Overview

This project is a real-time tracker for roulette games, displaying live data about roulette numbers and victory statistics. It includes a robust real-time updating system with fallback mechanisms when real-time connections are not available.

## Features

- Real-time tracking of roulette numbers with WebSocket integration
- Strategy tracking with win/loss statistics
- Responsive UI with animated number displays
- Offline mode with fallback data
- Search functionality for filtering roulettes

## Core Components

### useRouletteData Hook

The `useRouletteData` hook is the heart of the application's real-time functionality:

- Connects to WebSocket for real-time updates
- Handles data fetching with fallback mechanisms
- Manages victory tracking and strategy states
- Provides a simple interface for components to consume

### RouletteCardRealtime Component

The `RouletteCardRealtime` component provides a visual representation of roulette data:

- Displays the current number with color-coding
- Shows history of recent numbers
- Visualizes win/loss statistics
- Provides refresh functionality
- Indicates connection status

## Implementation Notes

The implementation focuses on robustness and fallback mechanisms:

1. The system first attempts to connect via WebSocket
2. If real-time connections fail, it falls back to API requests
3. If API requests fail, it uses mock data generation
4. All state transitions are handled smoothly with loading indicators

## Technical Stack

- React with TypeScript
- Custom WebSocket integration
- Tailwind CSS for styling
- Event-driven architecture for real-time updates

## Usage

Example usage of the RouletteCardRealtime component:

```tsx
<RouletteCardRealtime
  roletaId="roleta1"
  roletaNome="Roleta Brasileira"
  onNumberChange={(newNumber) => console.log(`New number: ${newNumber}`)}
/>
```

## Future Improvements

- Add more advanced statistical analysis
- Implement pattern recognition for strategy suggestions
- Enhance offline mode with local storage caching
- Add user authentication and personalized tracking

# RunCash Frontend

Interface de usuário para o sistema RunCash de rastreamento de roletas.

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

# RunCash Vercel

Aplicação para análise de roletas em tempo real.

## Recursos

- Análise de roletas em tempo real
- Estratégias de apostas
- Integração com WebSocket para atualizações em tempo real
- Interface moderna e responsiva

## Configuração

Consulte o arquivo `GUIA_IMPLANTACAO.md` para instruções detalhadas sobre como configurar o ambiente. 