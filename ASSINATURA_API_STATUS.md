# Acesso à API de Roletas com Status RECEIVED e CONFIRMED

Esta documentação descreve a implementação do acesso à API de roletas quando um usuário tem uma assinatura com status RECEIVED ou CONFIRMED.

## Visão Geral

Para melhorar a experiência do usuário e permitir acesso mais rápido aos recursos premium, a API de roletas (`/api/roulettes`) agora aceita não apenas assinaturas com status ACTIVE, mas também assinaturas com status RECEIVED ou CONFIRMED.

## Status de Assinatura Válidos

Os seguintes status de assinatura são considerados válidos para acesso à API de roletas:

1. **ACTIVE**: Assinatura ativa e com pagamentos em dia (comportamento padrão anterior)
2. **RECEIVED**: Pagamento recebido mas ainda em processamento (nova permissão)
3. **CONFIRMED**: Pagamento confirmado (nova permissão)

## Alterações Implementadas

### 1. Middleware de Autenticação

No arquivo `backend/middlewares/asaasAuthMiddleware.js`, o middleware `verifyTokenAndSubscription` foi modificado para aceitar assinaturas com status RECEIVED ou CONFIRMED:

```javascript
// Verificar se há alguma assinatura válida (ACTIVE, RECEIVED ou CONFIRMED)
const activeSubscription = asaasResponse.data.data.find(sub => 
  sub.status === 'ACTIVE' || 
  sub.status === 'active' || 
  sub.status === 'RECEIVED' || 
  sub.status === 'CONFIRMED'
);
```

### 2. Webhook Manager

No arquivo `api/webhook-manager.js`, o gerenciador de webhooks foi atualizado para tratar pagamentos com status RECEIVED da mesma forma que CONFIRMED:

```javascript
$set: { 
  status: webhookData.payment.status === 'CONFIRMED' || webhookData.payment.status === 'RECEIVED' ? 'ACTIVE' : webhookData.payment.status,
  updated_at: new Date()
}
```

## Fluxo de Funcionamento

1. Usuário realiza um pagamento via Asaas
2. O Asaas envia um webhook com status RECEIVED ou CONFIRMED
3. O webhook-manager processa o evento e atualiza o status da assinatura
4. O usuário tenta acessar a API de roletas
5. O middleware verifica se a assinatura tem status ACTIVE, RECEIVED ou CONFIRMED
6. Se positivo, o acesso é concedido

## Benefícios

Esta implementação oferece os seguintes benefícios:

1. **Acesso mais rápido aos recursos**: Usuários não precisam esperar a confirmação completa do pagamento
2. **Melhor experiência do usuário**: Redução do tempo entre o pagamento e o acesso ao serviço
3. **Redução de suporte**: Menos tickets de usuários questionando por que não podem acessar após o pagamento

## Considerações Futuras

1. Monitorar o comportamento dos usuários com assinaturas em status RECEIVED
2. Considerar implementar um período de carência para assinaturas que transitam de RECEIVED para OVERDUE
3. Adicionar notificações para usuários sobre o status da assinatura 