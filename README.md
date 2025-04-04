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

# RunCash - Nova Arquitetura de Roletas

Este projeto introduz uma nova arquitetura para o sistema de roletas da aplicação RunCash, com foco em separação de responsabilidades, facilidade de manutenção e escalabilidade.

## Estrutura de Diretórios

A nova arquitetura segue uma estrutura organizada por responsabilidades:

```
frontend/src/
├── services/
│   ├── api/               # Clientes de API REST
│   ├── socket/            # Cliente de WebSocket
│   ├── data/              # Repositório de dados e transformadores
│   └── ui/components/     # Componentes de UI reutilizáveis
├── hooks/                 # Hooks personalizados do React
└── pages/                 # Páginas da aplicação
```

## Principais Componentes

### API Client
- `RouletteApi`: Cliente para comunicação com a API REST de roletas

### Socket Client
- `SocketClient`: Cliente WebSocket para atualizações em tempo real

### Data Layer
- `RouletteRepository`: Gerencia os dados das roletas, incluindo cache e transformações
- `RouletteTransformer`: Padroniza e transforma os dados brutos das roletas

### Hooks
- `useRoulette`: Hook para acessar e observar os dados de uma roleta específica
- `useMultipleRoulettes`: Hook para acessar e observar os dados de múltiplas roletas

### Componentes UI
- `RouletteCard`: Exibe os dados de uma roleta em formato de cartão
- `NumberHistory`: Exibe o histórico de números de uma roleta com estatísticas

## Instalação

Antes de executar a aplicação, instale as dependências necessárias:

```bash
cd frontend
npm install axios socket.io-client
npm install --save-dev @types/node @types/react @types/react-dom
```

## Como Usar os Novos Componentes

### Exemplo com o Hook useRoulette

```tsx
import { useRoulette } from '../hooks/useRoulette';

function MyComponent() {
  const { roulette, loading, error } = useRoulette('evolution-lightning-roulette');
  
  if (loading) return <p>Carregando...</p>;
  if (error) return <p>Erro: {error}</p>;
  
  return (
    <div>
      <h2>{roulette.name}</h2>
      <p>Último número: {roulette.numbers[0]?.value}</p>
    </div>
  );
}
```

### Exemplo com o Componente RouletteCard

```tsx
import { RouletteCard } from '../services/ui/components/RouletteCard';

function MyComponent() {
  return (
    <div>
      <h1>Minhas Roletas</h1>
      <RouletteCard rouletteId="evolution-lightning-roulette" />
    </div>
  );
}
```

## Benefícios da Nova Arquitetura

1. **Separação de Responsabilidades**: Cada componente tem uma função específica e bem definida
2. **Reutilização de Código**: Componentes e hooks podem ser reutilizados em toda a aplicação
3. **Facilidade de Manutenção**: Estrutura organizada facilita a localização e manutenção do código
4. **Escalabilidade**: Novos componentes podem ser adicionados seguindo o mesmo padrão
5. **Performance**: Implementação de cache e otimização de requisições 