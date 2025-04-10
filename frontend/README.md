# RunCash Frontend

Este é o frontend da aplicação RunCash que mostra informações em tempo real sobre roletas.

## Sistema atualizado para REST API

O sistema foi recentemente atualizado para funcionar exclusivamente com REST API, removendo a dependência de WebSockets para atualizações em tempo real.

### Principais alterações:

- **Polling em vez de WebSockets**: O sistema agora usa polling para buscar dados atualizados da API a cada intervalo definido (padrão: 5 segundos).

- **Endpoints REST**: 
  - `/api/ROULETTES` - Busca todas as roletas disponíveis
  - `/api/ROULETTES?limit=100` - Busca até 100 roletas por vez
  - `/api/ROULETTES/{id}` - Busca uma roleta específica
  - `/api/HISTORY/{id}` - Busca o histórico de números de uma roleta

- **Cache local**: Para minimizar requisições desnecessárias, o sistema utiliza um cache local com tempo de vida de 30 segundos.

### Componente RouletteCard

O componente `RouletteCard` implementa o mecanismo de polling e exibe os dados mais recentes da roleta:

```tsx
<RouletteCard 
  data={roletaInicial} 
  refreshInterval={5000} 
  onUpdate={(dados) => console.log('Roleta atualizada:', dados)} 
/>
```

### Repositório de Roletas

O `rouletteRepository` é responsável por gerenciar os dados das roletas, realizando chamadas à API e mantendo um cache local para melhorar a performance.

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