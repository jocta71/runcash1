# Consolidação de Endpoints da API

## Visão Geral

Para atender ao limite de 12 funções serverless do plano Hobby da Vercel, consolidamos vários endpoints relacionados ao Asaas em um único endpoint `asaas-api.js` com roteamento interno.

## Mudanças Realizadas

### 1. Criação de um Endpoint Unificado

Foi criado o arquivo `api/asaas-api.js` que consolida as seguintes funcionalidades:

- `create-customer`: Criação/atualização de clientes no Asaas
- `find-customer`: Busca de clientes no Asaas
- `create-subscription`: Criação de assinaturas
- `find-subscription`: Busca de assinaturas e pagamentos
- `cancel-subscription`: Cancelamento de assinaturas
- `sync-user-customer`: Sincronização de usuários com clientes no Asaas

### 2. Ajustes no Frontend

As chamadas aos endpoints foram atualizadas nos seguintes arquivos:

- `frontend/src/integrations/asaas/client.ts`: Funções de integração com o Asaas
- `frontend/src/context/AuthContext.tsx`: Função `syncUserWithAsaas`
- `frontend/src/context/SubscriptionContext.tsx`: Funções de gerenciamento de assinaturas
- `frontend/src/pages/ProfileSubscription.tsx`: Função `fetchPaymentHistory`

### 3. Padrão de Chamada

#### Antes:
```javascript
// Exemplo de POST
axios.post('api/asaas-create-customer', { ... })

// Exemplo de GET
axios.get(`api/asaas-find-subscription?subscriptionId=${id}`)
```

#### Depois:
```javascript
// Exemplo de POST
axios.post('api/asaas-api?path=create-customer', { ... })

// Exemplo de GET
axios.get(`api/asaas-api?path=find-subscription&subscriptionId=${id}`)
```

## Como Funciona

1. Todas as chamadas agora são direcionadas para `api/asaas-api.js`
2. O parâmetro `path` identifica qual funcionalidade deve ser executada
3. Os demais parâmetros são processados normalmente pela função correspondente
4. As funções internas manipulam a lógica específica de cada operação

## Benefícios

- Redução no número de funções serverless (de 6+ para 1)
- Manutenção do código facilitada com lógica centralizada
- Reutilização de código comum entre as funções
- Tratamento de erros unificado

## Verificação de Referências

Foi criado um script `update-api-references.js` que ajuda a identificar outras referências aos endpoints antigos que possam precisar de atualização.

Para executar:
```
node update-api-references.js
```

## Próximos Passos

Considere consolidar outros endpoints relacionados em arquivos temáticos semelhantes, como:
- Endpoints de autenticação
- Endpoints de gerenciamento de usuários
- Endpoints de configuração do sistema 