# Atualização da API de Roletas - Status de Assinatura

## Resumo da Atualização

Implementamos uma melhoria para permitir o acesso à API de roletas (`/api/roulettes`) quando o usuário tem uma assinatura com status `RECEIVED` ou `CONFIRMED`, além do status `ACTIVE` que já era aceito anteriormente.

## Arquivos Modificados

1. `backend/middlewares/asaasAuthMiddleware.js`
   - Atualizado para aceitar assinaturas com status `RECEIVED` ou `CONFIRMED`
   - Mensagem de erro alterada de "Nenhuma assinatura ativa encontrada" para "Nenhuma assinatura válida encontrada"

2. `api/webhook-manager.js`
   - Atualizado para tratar pagamentos com status `RECEIVED` da mesma forma que `CONFIRMED`
   - Ao receber um webhook com status `RECEIVED`, a assinatura é marcada como `ACTIVE`

## Documentação Criada

1. `ASSINATURA_API_STATUS.md`
   - Documentação detalhada da implementação
   - Explicação do fluxo de funcionamento
   - Benefícios da mudança

2. `PAYMENT_FLOW.md`
   - Atualizado para incluir informações sobre os status válidos
   - Adicionada seção sobre webhook e atualização de status

## Scripts de Teste

1. `test-subscription-status.js`
   - Script para testar o acesso à API de roletas com diferentes tokens
   - Verifica se o middleware está funcionando corretamente

2. `test-webhook-received.js`
   - Script para simular o envio de webhooks do Asaas
   - Testa o processamento de webhooks com status `RECEIVED`

## Como Testar

### Pré-requisitos
- Node.js instalado
- Arquivo `.env` configurado com as variáveis necessárias

### Teste de Webhook
```bash
# Simular webhook com status RECEIVED
node test-webhook-received.js RECEIVED

# Simular webhook com status CONFIRMED
node test-webhook-received.js CONFIRMED
```

### Teste de Acesso à API
```bash
# Testar acesso à API de roletas
# Edite o arquivo primeiro para incluir um token JWT válido
node test-subscription-status.js
```

## Comportamento Esperado

1. Um usuário com assinatura em status `RECEIVED` deve conseguir acessar a API de roletas
2. Um usuário com assinatura em status `CONFIRMED` deve conseguir acessar a API de roletas
3. Um usuário com assinatura em status `ACTIVE` deve conseguir acessar a API de roletas (comportamento anterior)
4. Um usuário sem assinatura ou com assinatura em outros status não deve conseguir acessar a API

## Próximos Passos

1. Monitorar o comportamento dos usuários com assinaturas em status `RECEIVED`
2. Considerar implementar um período de carência para assinaturas que transitam de `RECEIVED` para `OVERDUE`
3. Adicionar notificações para usuários sobre mudanças no status da assinatura 