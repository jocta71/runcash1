# Otimização de Funções Serverless - Vercel

Este documento explica as otimizações implementadas para reduzir o número de funções serverless no projeto, de modo a cumprir o limite de 12 funções do plano Hobby da Vercel.

## Problema

O plano Hobby da Vercel permite apenas 12 funções serverless. Nosso projeto excedia esse limite, resultando no erro:

```
Error: No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.
```

## Solução

Implementamos uma consolidação de funções relacionadas em endpoints únicos com roteamento interno, mantendo todas as funcionalidades originais, mas reduzindo o número total de funções serverless.

## Funções Consolidadas

### 1. API Asaas (`api/asaas.js`)

Esta função consolida todos os endpoints relacionados à integração com o Asaas:

- **Create Customer**: `/api/asaas/create-customer`
- **Find Customer**: `/api/asaas/find-customer`
- **Create Subscription**: `/api/asaas/create-subscription`
- **Cancel Subscription**: `/api/asaas/cancel-subscription`
- **Find Subscription**: `/api/asaas/find-subscription`
- **Find Payment**: `/api/asaas/find-payment`
- **PIX QR Code**: `/api/asaas/pix-qrcode`
- **Webhook**: `/api/asaas/webhook`

### 2. Notificações (`api/notification.js`)

Esta função consolida todas as operações relacionadas a notificações:

- **Listar Notificações**: `/api/notification`
- **Marcar como Lida**: `/api/notification/read`
- **Marcar Todas como Lidas**: `/api/notification/read-all`
- **Excluir Notificação**: `/api/notification/delete/:id`
- **Excluir Todas Lidas**: `/api/notification/read` (DELETE)
- **Configurações de Notificação**: `/api/notification/settings`
- **Notificações de Assinatura**: `/api/notification/subscription`

### 3. Roletas (`pages/api/roulette.js`)

Esta função consolida os endpoints relacionados a roletas:

- **Proxy Roleta**: `/api/roulette/proxy` ou `/api/proxy-roulette`
- **Histórico de Roleta**: `/api/roulette/history` ou `/api/roulette-history`

## Outras Funções Mantidas

Mantivemos as seguintes funções como estavam, pois já eram consolidadas por funcionalidade:

- **Autenticação**: `api/auth.js`
- **Perfil**: `api/profile.js`
- **Assinaturas**: `api/subscriptions.js`
- **Transações**: `api/transactions.js`
- **Arquivos de Usuário**: `api/user-files.js`
- **Página de Teste**: `api/test-page.js`

## Atualização do `vercel.json`

Atualizamos o arquivo `vercel.json` para:

1. Configurar as funções consolidadas com suas alocações de memória e tempo de execução
2. Configurar os rewrites para direcionar os caminhos de URL para as funções apropriadas
3. Manter as variáveis de ambiente necessárias

## Como Funciona o Roteamento Interno

Cada função consolidada implementa um sistema de roteamento baseado no padrão de URL. Por exemplo:

```javascript
// Extrair o caminho da URL
const url = new URL(req.url, `https://${req.headers.host}`);
const pathSegments = url.pathname.split('/').filter(Boolean);

// Definir a operação a partir da URL
const operation = pathSegments[2] || '';

// Rotear com base na operação
switch(operation) {
  case 'create-customer':
    return await handleCreateCustomer(req, res, ...);
  case 'find-customer':
    return await handleFindCustomer(req, res, ...);
  // etc.
}
```

## Manutenção

Ao adicionar novas funcionalidades:

1. **Não crie novas funções separadas**. Em vez disso, adicione funções auxiliares dentro dos arquivos consolidados existentes.
2. Atualize os padrões de roteamento nas funções existentes.
3. Se necessário, atualize os rewrites no `vercel.json`.

Seguindo essa estratégia, mantemos o número de funções serverless dentro do limite permitido pelo plano Hobby da Vercel. 