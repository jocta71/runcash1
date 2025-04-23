# Guia de Migração de API - RunCash

Devido ao limite de funções serverless do plano Hobby da Vercel (máximo de 12 funções), consolidamos vários endpoints em arquivos unificados. Este guia apresenta as mudanças necessárias para adaptar o frontend.

## Endpoints Antigos vs. Novos

### Pagamentos (Consolidados em `/api/asaas-payments`)

| Operação Antiga | Nova Chamada de API |
|-----------------|---------------------|
| `/api/asaas-create-payment` (POST) | `/api/asaas-payments?op=create` (POST) |
| `/api/asaas-list-payments` (GET) | `/api/asaas-payments?op=list` (GET) |
| `/api/asaas-get-payment` (GET) | `/api/asaas-payments?op=get` (GET) |
| `/api/asaas-find-payment` (GET) | `/api/asaas-payments?op=find` (GET) |
| `/api/asaas-pix-qrcode` (GET) | `/api/asaas-payments?op=qrcode` (GET) |

### Assinaturas (Consolidadas em `/api/asaas-subscriptions`)

| Operação Antiga | Nova Chamada de API |
|-----------------|---------------------|
| `/api/asaas-create-subscription` (POST) | `/api/asaas-subscriptions?op=create` (POST) |
| `/api/asaas-find-subscription` (GET) | `/api/asaas-subscriptions?op=find` (GET) |
| `/api/asaas-cancel-subscription` (POST) | `/api/asaas-subscriptions?op=cancel` (POST) |

### Endpoint Inalterado

- `/api/asaas-webhook` (mantido separado por ser um caso especial)

## Exemplos de Como Atualizar o Código

### Exemplo para Pagamentos:

```javascript
// ANTES:
axios.post('/api/asaas-create-payment', paymentData);

// DEPOIS:
axios.post('/api/asaas-payments?op=create', paymentData);
```

```javascript
// ANTES:
axios.get(`/api/asaas-get-payment?id=${paymentId}`);

// DEPOIS:
axios.get(`/api/asaas-payments?op=get&id=${paymentId}`);
```

### Exemplo para Assinaturas:

```javascript
// ANTES:
axios.post('/api/asaas-cancel-subscription', { id: subscriptionId });

// DEPOIS:
axios.post('/api/asaas-subscriptions?op=cancel', { id: subscriptionId });
```

## Regras Gerais:

1. **Parâmetro `op`**: Sempre adicione `?op=operação` na URL para indicar qual operação deseja realizar
2. **Parâmetros de consulta**: Os demais parâmetros continuam sendo passados da mesma forma
3. **Método HTTP**: Os métodos (GET, POST) permanecem os mesmos de antes

## Para Testar:

Antes de implantar em produção, teste todas as operações relacionadas a pagamentos e assinaturas para garantir que a migração foi bem-sucedida. 