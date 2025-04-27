# Controle de Acesso Premium

Este documento explica como o sistema de controle de acesso premium foi implementado para garantir que apenas usuários com planos pagos (PRO e PREMIUM) tenham acesso a recursos exclusivos como dados em tempo real.

## Arquitetura do Sistema

O sistema utiliza os seguintes componentes para controlar o acesso:

1. **SubscriptionContext**: Gerencia informações sobre a assinatura do usuário e verifica permissões
2. **EventService**: Serviço para receber eventos em tempo real
3. **RESTSocketService**: Serviço para conectar aos dados via API REST
4. **PremiumContent**: Componente de UI para proteger conteúdo premium
5. **useFeatureAccess**: Hook personalizado para verificar acesso a recursos

## Como Funciona

### Verificação de Assinatura

O `SubscriptionContext` verifica se o usuário tem uma assinatura ativa e qual é o tipo de plano. Quando ocorre uma mudança no status da assinatura, ele atualiza os serviços que fornecem dados em tempo real:

```typescript
// Em SubscriptionContext.tsx
const updatePremiumServices = () => {
  // Verificar se o usuário tem acesso a dados em tempo real
  const hasRealtimeAccess = currentPlan?.type === PlanType.PREMIUM || currentPlan?.type === PlanType.PRO;
  
  // Atualizar os serviços EventService e RESTSocketService
  if (typeof (EventService as any).updatePremiumAccessStatus === 'function') {
    (EventService as any).updatePremiumAccessStatus(hasRealtimeAccess);
  }
  
  if (typeof (RESTSocketService as any).updatePremiumAccessStatus === 'function') {
    (RESTSocketService as any).updatePremiumAccessStatus(hasRealtimeAccess);
  }
};
```

### Bloqueio de Dados em Tempo Real

Tanto o `EventService` quanto o `RESTSocketService` implementam o método `updatePremiumAccessStatus` para atualizar seu status de acesso:

```typescript
// Em EventService.ts
public updatePremiumAccessStatus(hasPremiumAccess: boolean): void {
  this.hasPremiumAccess = hasPremiumAccess;
}

private checkRealTimeAccess(): boolean {
  return this.hasPremiumAccess;
}
```

Antes de enviar qualquer evento ou dados em tempo real para os componentes, o serviço verifica se o usuário tem permissão:

```typescript
// Em EventService.ts - Verificação antes de notificar
private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
  // Verificar acesso a recursos premium
  if (!this.checkRealTimeAccess()) {
    debugLog(`[EventService] Bloqueando notificação de evento: usuário sem acesso premium`);
    return;
  }
  
  // Continua com a notificação normal...
}
```

### Interface do Usuário

O componente `PremiumContent` exibe uma UI alternativa quando o usuário não tem acesso a um recurso:

```tsx
// Em PremiumContent.tsx
const PremiumContent: React.FC<PremiumContentProps> = ({ 
  featureId, 
  children, 
  // outras props
}) => {
  const { hasFeatureAccess } = useSubscription();
  const hasAccess = hasFeatureAccess(featureId);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Renderiza conteúdo bloqueado com opção de upgrade
}
```

### Hook de Verificação de Acesso

O hook `useFeatureAccess` facilita a verificação de acesso em componentes:

```tsx
// Uso do hook em um componente:
function RouletteData() {
  const { 
    hasAccess, 
    data, 
    isLoading, 
    redirectToPlanPage 
  } = useFeatureAccess({
    featureId: 'real_time_data',
    redirectToPlans: true
  });
  
  // Mostrar UI baseada no status de acesso
}
```

## Recursos Premium

Os seguintes recursos são considerados premium e requerem plano PRO ou PREMIUM:

1. **Dados em tempo real** (real_time_data)
2. **Atualizações de estratégia** (strategy_updates)
3. **Histórico completo de roletas** (roulette_history)
4. **Dashboard de estatísticas avançadas** (advanced_stats)

## Como Testar

Para testar o funcionamento do sistema de acesso premium:

1. Faça login com uma conta com plano FREE
2. Verifique que os dados nos painéis não atualizam em tempo real
3. Tente acessar uma área premium e observe que será redirecionado para a página de planos
4. Faça login com uma conta com plano PREMIUM
5. Verifique que os dados agora são atualizados em tempo real

## Observações de Segurança

Este sistema implementa apenas o bloqueio client-side. Para uma segurança completa, é importante que:

1. O backend também implemente verificações de acesso
2. As APIs que fornecem dados sensíveis verifiquem o status da assinatura do usuário
3. Os webhooks dos provedores de pagamento atualizem corretamente o status das assinaturas

## Fluxo de Atualização do Status

O fluxo de verificação de acesso funciona da seguinte forma:

1. Usuário faz login
2. O `AuthContext` carrega os dados do usuário
3. O `SubscriptionContext` carrega os dados da assinatura
4. Os serviços são atualizados com o status de acesso premium
5. Os componentes usam o contexto e os hooks para verificar permissões 