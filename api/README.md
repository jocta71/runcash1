# API RunCash - Funções Serverless Consolidadas

Este diretório contém as funções serverless usadas pela aplicação RunCash. Para atender às limitações do plano Hobby da Vercel (máximo de 12 funções serverless), as APIs foram consolidadas em endpoints principais.

## Estrutura

- **asaas.js**: Endpoint consolidado para todas as operações relacionadas ao Asaas
- **user-api.js**: Endpoint consolidado para todas as operações relacionadas a usuários

## Como usar os novos endpoints

### Funções do Asaas

Todas as chamadas de API para funções do Asaas agora devem ser feitas para `/api/asaas` com o parâmetro `action` especificando qual função você deseja usar.

Exemplos:

| Função Original | Nova Chamada |
|-----------------|--------------|
| `/api/asaas-create-subscription` | `/api/asaas?action=create-subscription` |
| `/api/asaas-find-customer` | `/api/asaas?action=find-customer` |
| `/api/regenerate-pix-code` | `/api/asaas?action=regenerate-pix-code` |
| `/api/check-payment-status` | `/api/asaas?action=check-payment-status` |
| `/api/asaas-webhook` | `/api/asaas?action=webhook` |

### Funções de Usuário

Todas as chamadas de API para funções de usuário agora devem ser feitas para `/api/user-api` com o parâmetro `action` especificando qual função você deseja usar.

Exemplos:

| Função Original | Nova Chamada |
|-----------------|--------------|
| `/api/user` | `/api/user-api?action=user-data` |
| `/api/user-subscriptions` | `/api/user-api?action=user-subscriptions` |

## Atualizações no frontend

É necessário atualizar todas as chamadas de API no frontend para usar os novos endpoints. Exemplos:

```javascript
// Código antigo
axios.post('/api/asaas-create-subscription', payload);

// Novo código
axios.post('/api/asaas?action=create-subscription', payload);
```

```javascript
// Código antigo
axios.get(`/api/user-subscriptions?userId=${userId}`);

// Novo código
axios.get(`/api/user-api?action=user-subscriptions&userId=${userId}`);
```

## Próximos Passos

1. Preencha o código de cada função nos arquivos consolidados, copiando-o dos arquivos originais
2. Atualize todas as chamadas de API no frontend para usar os novos endpoints
3. Teste todas as funcionalidades
4. Após a migração completa e testes bem-sucedidos, remova os arquivos individuais originais 