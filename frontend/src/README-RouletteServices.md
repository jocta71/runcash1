# Arquitetura de Serviços da Roleta

Este documento explica a arquitetura e organização dos serviços relacionados às roletas na aplicação.

## Visão Geral

A aplicação utiliza uma arquitetura baseada em serviços singleton para garantir que apenas uma instância de cada serviço seja criada, evitando múltiplas requisições à API e otimizando o desempenho.

## Principais Serviços

### 1. RouletteFeedService

Serviço principal para obter atualizações das roletas usando polling único.

**Características:**
- Intervalo ajustado para 8 segundos
- Controle para evitar requisições concorrentes
- Cache de dados para reduzir o número de chamadas à API
- Backoff exponencial em caso de falhas
- Sensível à visibilidade da página

### 2. GlobalRouletteDataService

Serviço centralizado para todos os componentes que precisam de dados gerais das roletas.

**Características:**
- Padrão Singleton
- Polling centralizado (8 segundos)
- Sistema de assinatura para notificar componentes sobre atualizações
- Cache com TTL de 15 segundos
- Pausado automaticamente quando a página não está visível

### 3. RouletteHistoryService

Serviço específico para histórico de números das roletas.

**Características:**
- Cache dedicado (TTL de 60 segundos)
- Controle de requisições duplicadas 
- Evita solicitações simultâneas para a mesma roleta
- Fallback para serviço global em caso de falha

### 4. RouletteStatisticsService

Serviço para centralizar cálculos estatísticos relacionados às roletas.

**Características:**
- Cache dedicado para cada tipo de estatística (TTL de 30 segundos)
- Otimização de performance para cálculos frequentes
- Padronização de dados estatísticos em toda a aplicação
- Evita recálculos desnecessários

## Utilitários

### api-helpers.ts

Utilitários para requisições HTTP com suporte a CORS.

- `fetchWithCorsSupport`: Tenta diferentes métodos de requisição, baseado na disponibilidade:
  1. API Proxy Local
  2. Next.js API Route
  3. CORS Proxy externo

## Fluxo de Dados

1. A inicialização ocorre em `useRouletteData.ts` que configura os hooks e inicia o RouletteFeedService
2. O RouletteFeedService e GlobalRouletteDataService fazem polling ao backend
3. Os componentes se inscrevem nos serviços para receber atualizações
4. O RouletteHistoryService centraliza requisições de histórico específicas
5. O RouletteStatisticsService processa os dados brutos em estatísticas úteis

## Arquitetura de Centralização de Requisições

```
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│   Componentes UI    │     │  Componentes Stats  │
│                     │     │                     │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          ▼                            ▼
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│ RouletteFeedService │     │RouletteStatsService │
│                     │     │                     │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          ▼                            ▼
┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │
│GlobalRouletteService│◄────┤RouletteHistoryServ. │
│                     │     │                     │
└─────────┬───────────┘     └──────────┬──────────┘
          │                            │
          │                            │
          ▼                            ▼
    ┌─────────────────────────────────────┐
    │                                     │
    │          API (Backend)              │
    │                                     │
    └─────────────────────────────────────┘
```

## Benefícios

- Redução de chamadas à API
- Evita requisições duplicadas
- Resiliência em caso de falhas
- Performance otimizada para o usuário
- Experiência consistente entre componentes
- Cálculos estatísticos consistentes em toda a aplicação

## Recomendações para Expansão

1. Manter o padrão Singleton nos novos serviços
2. Implementar cache para dados frequentemente acessados
3. Centralizar requisições semelhantes
4. Utilizar o sistema de assinatura para propagar atualizações
5. Centralizar a lógica de negócios em serviços dedicados 