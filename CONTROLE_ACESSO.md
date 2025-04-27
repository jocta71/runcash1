# Controle de Acesso Baseado em Assinatura

## Visão Geral

Este documento descreve a implementação do controle de acesso baseado em assinatura para o sistema RunCash. A solução permite que apenas usuários com planos ativos recebam dados completos, enquanto usuários sem plano ou não autenticados recebem dados limitados.

## Arquitetura

```
┌────────────────┐       ┌────────────────┐      ┌────────────────┐
│                │       │                │      │                │
│    Frontend    │──────►│   API REST     │◄────►│   MongoDB      │
│    (Vercel)    │       │  (Railway)     │      │                │
│                │       │                │      │                │
└────────┬───────┘       └────────┬───────┘      └────────────────┘
         │                        │
         │                        │
         │                        │
         ▼                        ▼
┌────────────────┐       ┌────────────────┐
│                │       │                │
│ WebSocket/Poll │◄──────┤  WebSocket     │
│  (Cliente)     │       │  (Server)      │
│                │       │                │
└────────────────┘       └────────────────┘
```

## Componentes Principais

1. **Middleware de Autenticação**
   - Verifica se o usuário está autenticado
   - Extrai informações do token JWT
   - Identifica o usuário no sistema

2. **Middleware de Verificação de Assinatura**
   - Verifica se o usuário tem uma assinatura ativa
   - Identifica o tipo de plano do usuário
   - Define o nível de acesso aos dados

3. **Controlador de Acesso a Dados**
   - Filtra os dados com base no nível de acesso
   - Fornece dados completos para assinantes
   - Fornece dados limitados para não assinantes

4. **WebSocket com Controle de Acesso**
   - Verifica a assinatura na conexão
   - Envia dados diferentes com base no status da assinatura
   - Limita o acesso a recursos em tempo real

5. **Frontend com Verificação de Assinatura**
   - Consulta o status da assinatura no backend
   - Adapta a interface com base no tipo de plano
   - Solicita upgrade de plano quando necessário

## Níveis de Acesso

| Nível de Acesso | Descrição | Limitações |
|-----------------|-----------|------------|
| `premium` | Usuários com assinatura ativa | Acesso completo a todos os dados e recursos |
| `authenticated` | Usuários autenticados sem assinatura ativa | Dados limitados (amostra) |
| `anonymous` | Usuários não autenticados | Dados mínimos (apenas visualização básica) |

## Fluxo de Verificação

1. O usuário faz login no sistema
2. O backend valida as credenciais e emite um token JWT
3. Nas requisições subsequentes, o token é verificado
4. O middleware de assinatura verifica se o usuário tem um plano ativo
5. O controlador de acesso a dados filtra os dados com base no nível de acesso
6. Os dados filtrados são enviados ao cliente

## Melhorias de Segurança

1. **Verificação no Servidor**
   - A decisão sobre os dados enviados é sempre feita no servidor
   - Não há como burlar o controle de acesso manipulando o frontend

2. **Camadas de Proteção**
   - Múltiplas verificações em diferentes níveis da aplicação
   - Proteção tanto na API REST quanto no WebSocket

3. **Dados Limitados**
   - Usuários sem plano recebem apenas uma amostra dos dados
   - Informações estratégicas são completamente removidas

## Escalabilidade

A solução foi projetada para escalar com milhares de usuários:

1. **Processamento Eficiente**
   - Filtragem de dados rápida e eficiente
   - Cache de status de assinatura para reduzir consultas ao banco de dados

2. **Recuperação Inteligente**
   - Sistema robusto para lidar com erros de conexão
   - Fallback para modo limitado em caso de falha na verificação

3. **Otimização de Recursos**
   - Menor consumo de banda para usuários sem plano
   - Menor carga no servidor para conexões não premium

## Implementação Técnica

### Backend

```javascript
// Middleware de controle de acesso
exports.controlDataAccess = async (req, res, next) => {
  try {
    // Verificar autenticação
    if (!req.user) {
      req.dataAccessLevel = 'anonymous';
      return next();
    }
    
    // Verificar assinatura
    const subscription = await findActiveSubscription(req.user.id);
    
    if (!subscription) {
      req.dataAccessLevel = 'authenticated';
      return next();
    }
    
    // Usuário premium
    req.dataAccessLevel = 'premium';
    req.planType = subscription.plan_id;
    return next();
  } catch (error) {
    // Fallback seguro
    req.dataAccessLevel = 'error';
    return next();
  }
};

// Filtro de dados
exports.filterDataByAccessLevel = (data, accessLevel) => {
  if (accessLevel === 'premium') {
    return data; // Dados completos
  }
  
  // Dados limitados com base no nível de acesso
  return limitData(data, accessLevel);
};
```

### WebSocket

```javascript
io.use(async (socket, next) => {
  // Verificar token e assinatura
  const token = socket.handshake.auth.token;
  const user = await verifyToken(token);
  
  if (user) {
    const subscription = await findActiveSubscription(user.id);
    socket.data.hasPlan = !!subscription;
  } else {
    socket.data.hasPlan = false;
  }
  
  next();
});

// Enviar dados conforme o plano
function broadcastData(event, data) {
  io.sockets.sockets.forEach((socket) => {
    const clientData = socket.data.hasPlan ? 
      data : limitDataForNonSubscribers(data);
    
    socket.emit(event, clientData);
  });
}
```

### Frontend

```typescript
async checkSubscriptionBeforeInit(): Promise<void> {
  // Verificar status da assinatura
  const response = await fetch('/api/subscription/status');
  const data = await response.json();
  
  if (data.hasActiveSubscription) {
    // Inicializar modo completo
    this.startFullService();
  } else {
    // Inicializar modo limitado
    this.startLimitedService();
    
    // Mostrar banner de upgrade
    this.showUpgradePrompt();
  }
}
```

## Conclusão

Esta implementação garante que apenas usuários com planos ativos tenham acesso completo aos dados do sistema, enquanto oferece uma experiência limitada para usuários sem plano, incentivando a conversão para assinantes premium.

A arquitetura é segura, escalável e robusta, capaz de lidar com alto volume de usuários e proteger os dados estratégicos do sistema. 