# Integração entre Webhooks Asaas e Acesso às Roletas

Este documento descreve como o sistema de webhooks do Asaas está integrado com o serviço de roletas, permitindo a liberação automática de acesso quando um pagamento é recebido.

## Visão Geral

Quando o Asaas envia um webhook de pagamento recebido (`PAYMENT_RECEIVED`) ou confirmado (`PAYMENT_CONFIRMED`), o sistema automaticamente:

1. Atualiza o status do plano do usuário para `ACTIVE`
2. Cria ou atualiza um registro na coleção `subscriptions` para permitir o acesso aos recursos protegidos
3. Libera o acesso ao serviço de roletas

## Eventos que Afetam o Acesso às Roletas

| Evento | Status do Webhook | Efeito no Acesso às Roletas |
|--------|------------------|---------------------------|
| `PAYMENT_RECEIVED` | Pagamento recebido | Libera acesso |
| `PAYMENT_CONFIRMED` | Pagamento confirmado | Libera acesso |
| `SUBSCRIPTION_CREATED` | Nova assinatura criada | Libera acesso se status for `ACTIVE` |
| `SUBSCRIPTION_RENEWED` | Assinatura renovada | Libera acesso |
| `SUBSCRIPTION_UPDATED` | Assinatura atualizada | Libera acesso se status for `ACTIVE`, revoga se `INACTIVE` |
| `SUBSCRIPTION_DELETED` | Assinatura cancelada | Revoga acesso |

## Como Funciona

### 1. Recebimento do Webhook

Quando um webhook é recebido na rota `/api/webhooks/asaas`, o sistema:

- Responde imediatamente com status 200 para evitar timeouts
- Adiciona o webhook a um buffer para processamento assíncrono
- Processa o webhook em segundo plano se o MongoDB estiver disponível

### 2. Processamento do Webhook

Durante o processamento:

- O sistema identifica o usuário através do `customerId` do Asaas
- Processa o evento conforme sua natureza (pagamento ou assinatura)
- Atualiza o status do plano do usuário para `ACTIVE` no modelo `User`
- Cria ou atualiza um registro na coleção `subscriptions` para facilitar a verificação de acesso

### 3. Verificação de Acesso

Quando o usuário tenta acessar o serviço de roletas:

- O middleware `requireSubscription` verifica se o usuário tem assinatura ativa
- O middleware `requireResourceAccess` verifica se o plano do usuário permite acesso ao recurso
- A rota `/api/roulettes/history/check-access` pode ser usada para verificar explicitamente o acesso

## Scripts de Utilidade

### Processamento Manual de Webhooks Pendentes

Se houver problemas de conexão com o MongoDB, os webhooks são armazenados em buffer. Para processá-los manualmente:

```bash
node scripts/process-pending-webhooks.js
```

### Verificação de Acesso de um Usuário

Para verificar se um usuário específico tem acesso às roletas:

```bash
# Verificar por email
node scripts/verify-roulette-access.js --email=usuario@exemplo.com

# Verificar por ID
node scripts/verify-roulette-access.js --id=623f7a2b91a3f254e1d7b3c4
```

## Troubleshooting

### Usuário com Pagamento Confirmado, mas Sem Acesso

Possíveis causas:

1. **Problema no webhook**: Verifique se o webhook foi recebido na rota `/api/webhooks/asaas/status`
2. **MongoDB indisponível**: Execute o script `process-pending-webhooks.js` quando o MongoDB estiver disponível
3. **customerId incorreto**: Confirme se o `billingInfo.asaasId` do usuário corresponde ao `customer` no webhook
4. **Problema no modelo**: Verifique se o modelo `User` está disponível usando a rota `/api/webhooks/asaas/status`

### Testando a Liberação de Acesso

Para simular o recebimento de um webhook de pagamento para um usuário específico:

```bash
curl -X POST "https://yourdomain.com/api/webhooks/asaas/test-payment-received" \
  -H "Content-Type: application/json" \
  -H "x-test-token: dev-test-token" \
  -d '{"email":"usuario@exemplo.com"}'
```

## Fluxo de Dados

```
Asaas Webhook -> /api/webhooks/asaas -> Webhook Buffer -> Processamento do Webhook
    -> Atualização User.planStatus -> Atualização subscriptions -> Liberação de Acesso às Roletas
```

## Dicas e Boas Práticas

1. Sempre verifique os logs para confirmar que os webhooks estão sendo recebidos e processados
2. Use a rota `/api/webhooks/asaas/status` para verificar a saúde do sistema
3. Em caso de problemas, verifique se todos os modelos estão disponíveis
4. Periodicamente execute o script `process-pending-webhooks.js` para garantir que webhooks não processados sejam tratados 