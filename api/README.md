# Plano de Consolidação de Funções Serverless

## Problema

O plano Hobby da Vercel permite no máximo 12 funções serverless. Atualmente, estamos excedendo esse limite, causando falha no deploy.

## Solução

Consolidar funções relacionadas em endpoints unificados que utilizam um parâmetro `operation` para determinar a ação a ser executada.

## Funções já consolidadas

1. **auth-operations.js**
   - login
   - register
   - verify-token
   - update-user
   - reset-password
   - change-password

2. **products-operations.js**
   - list
   - create
   - get
   - update
   - delete
   - search

3. **subscription-operations.js**
   - create (antigo asaas-create-subscription)
   - find (antigo asaas-find-subscription)
   - cancel (antigo asaas-cancel-subscription)
   - update
   - change-payment
   - list

4. **asaas-operations.js**
   - find-customer
   - create-customer
   - find-subscription
   - create-subscription
   - cancel-subscription
   - find-payment
   - pix-qrcode

## Plano de ação

### 1. Remover arquivos duplicados

Os seguintes arquivos já foram consolidados e podem ser removidos:

- asaas-cancel-subscription.js -> subscription-operations.js
- asaas-find-subscription.js -> subscription-operations.js
- asaas-create-subscription.js -> subscription-operations.js

### 2. Consolidar API adicional

- regenerate-pix-code.js -> asaas-operations.js (adicionar operação 'regenerate-pix')
- auth-update-user.js -> auth-operations.js (já deve estar incluído)

### 3. Verificar referências no frontend

Após consolidar as APIs, é necessário atualizar todas as referências no frontend para apontar para os novos endpoints unificados com a operação correta.

Por exemplo, substituir:
```javascript
fetch('/api/asaas-create-subscription', { method: 'POST', body: ... })
```

Por:
```javascript
fetch('/api/subscription-operations?operation=create', { method: 'POST', body: ... })
```

### 4. Lista final de APIs serverless (objetivo: máx. 12)

1. api/auth-operations.js
2. api/products-operations.js
3. api/subscription-operations.js
4. api/asaas-operations.js
5. api/webhook-manager.js
6. api/health.js
7. api/test-page.js
8. api/ai/* (verificar quantas funções existem aqui)
9. api/delete-notification/* (verificar quantas funções existem aqui)

## Próximos passos

1. Verifique o frontend para todas as chamadas à API antigas e atualize para os novos endpoints
2. Remova os arquivos duplicados após confirmar que não estão sendo usados
3. Monitore o número total de funções no próximo deploy 