# Configuração de Webhooks no Asaas

Este guia explica como configurar webhooks no Asaas para receber notificações em tempo real de pagamentos, checkouts e outros eventos importantes.

## Pré-requisitos

- Uma conta no Asaas (sandbox ou produção)
- Acesso ao painel administrativo do Asaas
- Seu servidor deve estar acessível pela internet (pode usar ngrok para testes)

## 1. Preparando seu endpoint

O sistema já possui um endpoint configurado para receber webhooks do Asaas:

```
https://seudominio.com/api/webhooks/asaas
```

Este endpoint processa eventos como `CHECKOUT_PAID`, `PAYMENT_CREATED`, `PAYMENT_RECEIVED`, `SUBSCRIPTION_CREATED` e mais.

## 2. Configurando o webhook no Asaas

1. Faça login no painel do Asaas
2. Navegue até **Integrações > Webhooks**
3. Clique em **Novo Webhook**
4. Preencha as informações:
   - **URL**: https://seudominio.com/api/webhooks/asaas
   - **Descrição**: Webhooks de Checkout e Pagamentos
   - **Eventos**: Selecione os eventos desejados (é importante marcar todos estes):
     - CHECKOUT_PAID (Checkout pago)
     - PAYMENT_CREATED (Pagamento criado) **[IMPORTANTE]**
     - PAYMENT_RECEIVED (Pagamento recebido)
     - PAYMENT_CONFIRMED (Pagamento confirmado)
     - SUBSCRIPTION_CREATED (Assinatura criada)
     - SUBSCRIPTION_RENEWED (Assinatura renovada)
     - SUBSCRIPTION_UPDATED (Assinatura atualizada)
     - SUBSCRIPTION_PAYMENT_CONFIRMED (Pagamento de assinatura confirmado)
5. Clique em **Salvar**

> **ATENÇÃO**: É fundamental incluir o evento `PAYMENT_CREATED` para que o sistema possa correlacionar corretamente os pagamentos com os checkouts. Atualmente, o Asaas não envia o ID do checkout no evento `PAYMENT_CREATED`, então nosso sistema precisa fazer essa correlação com base no cliente, valor e timestamp.

## 3. Testando o webhook

Você pode testar o webhook de duas maneiras:

### 3.1 Teste pelo Painel do Asaas

1. No painel do Asaas, vá para **Integrações > Webhooks**
2. Encontre o webhook configurado e clique no botão de ações
3. Selecione **Testar Webhook**
4. Escolha um evento para testar (ex: PAYMENT_RECEIVED)
5. Verifique os logs do seu servidor para confirmar que o webhook foi recebido

### 3.2 Teste através de uma transação real

1. Crie um checkout ou pagamento no sistema
2. Complete o pagamento
3. Verifique os logs do seu servidor para confirmar que o webhook foi recebido

## 4. Verificando logs de webhooks

Para verificar os logs de webhooks no Asaas:

1. No painel do Asaas, vá para **Integrações > Log de Webhooks**
2. Você verá todos os webhooks enviados, seu status e detalhes

Adicionalmente, nosso sistema agora mantém um registro detalhado de cada evento de webhook recebido. Esses registros podem ser consultados no banco de dados na coleção `webhookevents`.

## 5. Como o sistema correlaciona Checkouts, Pagamentos e Assinaturas

Nosso sistema implementa uma lógica de correlação entre checkouts, pagamentos e assinaturas:

1. **Quando um checkout é pago (CHECKOUT_PAID):**
   - Registramos o checkout como pago
   - Se houver ID de assinatura, atualizamos ou criamos a assinatura
   - Se houver ID de pagamento, associamos ao checkout

2. **Quando um pagamento é criado (PAYMENT_CREATED):**
   - Tentamos localizar um checkout recente do mesmo usuário, com o mesmo valor
   - Associamos o pagamento a este checkout
   - Se o checkout tiver uma assinatura, atualizamos a assinatura

3. **Quando um pagamento é confirmado/recebido (PAYMENT_CONFIRMED/PAYMENT_RECEIVED):**
   - Atualizamos o status do pagamento
   - Se o pagamento estiver associado a uma assinatura, atualizamos a assinatura para ativa
   - Se o pagamento estiver associado a um checkout, marcamos o checkout como pago

Esta lógica resolve o problema do Asaas não enviar o ID do checkout no evento PAYMENT_CREATED, permitindo uma correlação confiável mesmo quando múltiplos checkouts são criados.

## 6. Resolução de Problemas

### Fila de Webhooks Pausada

Se a fila de webhooks estiver pausada no Asaas, pode ser devido a um dos seguintes erros:

#### Erro 403 (Forbidden)
- Seu firewall pode estar bloqueando as requisições do Asaas
- Libere os IPs oficiais do Asaas no seu firewall
- Se estiver usando Cloudflare, configure regras específicas para permitir o tráfego do Asaas

#### Erro 404 (Not Found)
- A URL do webhook não existe ou está incorreta
- Verifique se o endpoint está corretamente implementado e acessível

#### Erro 500 (Internal Server Error)
- Seu servidor está retornando um erro interno
- Verifique os logs do servidor para identificar e corrigir o problema

#### Erro Read Timed Out
- Seu servidor está demorando mais de 10 segundos para responder
- Otimize o processamento dos webhooks para responder rapidamente

### Melhores Práticas

1. **Sempre responda rapidamente**: Processe o webhook de forma assíncrona e responda imediatamente com status 200
2. **Implemente idempotência**: Um mesmo webhook pode ser enviado mais de uma vez em caso de falhas
3. **Mantenha logs adequados**: Registre todos os webhooks recebidos para facilitar o diagnóstico de problemas

## 7. Eventos Disponíveis

O Asaas oferece diversos eventos para configuração de webhooks:

### Eventos de Pagamento
- `PAYMENT_CREATED`: Pagamento criado
- `PAYMENT_UPDATED`: Pagamento atualizado
- `PAYMENT_CONFIRMED`: Pagamento confirmado
- `PAYMENT_RECEIVED`: Pagamento recebido
- `PAYMENT_OVERDUE`: Pagamento vencido
- `PAYMENT_DELETED`: Pagamento removido
- `PAYMENT_RESTORED`: Pagamento restaurado
- `PAYMENT_REFUNDED`: Pagamento estornado
- `PAYMENT_RECEIVED_IN_CASH`: Pagamento recebido em dinheiro
- `PAYMENT_CHARGEBACK_REQUESTED`: Chargeback solicitado
- `PAYMENT_CHARGEBACK_DISPUTE`: Disputa de chargeback
- `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`: Aguardando reversão de chargeback

### Eventos de Checkout
- `CHECKOUT_PAID`: Checkout pago

### Eventos de Assinatura
- `SUBSCRIPTION_CREATED`: Assinatura criada
- `SUBSCRIPTION_UPDATED`: Assinatura atualizada
- `SUBSCRIPTION_PAYMENT_CREATED`: Pagamento de assinatura criado
- `SUBSCRIPTION_PAYMENT_UPDATED`: Pagamento de assinatura atualizado
- `SUBSCRIPTION_DELETED`: Assinatura removida
- `SUBSCRIPTION_RENEWED`: Assinatura renovada
- `SUBSCRIPTION_OVERDUE`: Assinatura vencida
- `SUBSCRIPTION_PAYMENT_CONFIRMED`: Pagamento de assinatura confirmado
- `SUBSCRIPTION_PAYMENT_RECEIVED`: Pagamento de assinatura recebido
- `SUBSCRIPTION_PAYMENT_OVERDUE`: Pagamento de assinatura vencido
- `SUBSCRIPTION_PAYMENT_DELETED`: Pagamento de assinatura removido
- `SUBSCRIPTION_PAYMENT_REFUNDED`: Pagamento de assinatura estornado

Para mais detalhes sobre a estrutura dos eventos, consulte a [documentação oficial do Asaas](https://docs.asaas.com/docs/eventos-para-checkout). 