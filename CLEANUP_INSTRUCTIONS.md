# Instruções de Limpeza Após Consolidação

Após a consolidação das funções serverless, os seguintes arquivos podem ser excluídos pois suas funcionalidades foram incorporadas nos novos arquivos consolidados:

## Arquivos de Integração Asaas (consolidados em `api/asaas.js`)

- `api/asaas-webhook.js`
- `api/asaas-create-subscription.js`
- `api/asaas-create-customer.js`
- `api/asaas-find-customer.js`
- `api/asaas-cancel-subscription.js`
- `api/asaas-find-subscription.js`
- `api/asaas-find-payment.js`
- `api/asaas-pix-qrcode.js`

## Arquivos de Notificações (consolidados em `api/notification.js`)

- `api/notifications.js`
- `api/subscription-notifications.js`
- `api/mark-all-notifications-read.js`
- `api/mark-notification-read.js`
- `api/user-notifications.js`
- `api/delete-notification/[notificationId].js`

## Arquivos de Roleta (consolidados em `pages/api/roulette.js`)

- `pages/api/roulette-history.js`
- `pages/api/proxy-roulette.js`

## Comandos para Exclusão

Se quiser remover estes arquivos, você pode executar os seguintes comandos:

```bash
# Excluir arquivos Asaas
rm api/asaas-webhook.js
rm api/asaas-create-subscription.js
rm api/asaas-create-customer.js
rm api/asaas-find-customer.js
rm api/asaas-cancel-subscription.js
rm api/asaas-find-subscription.js
rm api/asaas-find-payment.js
rm api/asaas-pix-qrcode.js

# Excluir arquivos de notificações
rm api/notifications.js
rm api/subscription-notifications.js
rm api/mark-all-notifications-read.js
rm api/mark-notification-read.js
rm api/user-notifications.js
rm -r api/delete-notification

# Excluir arquivos de roleta
rm pages/api/roulette-history.js
rm pages/api/proxy-roulette.js
```

**Importante**: Antes de excluir estes arquivos, certifique-se de que o deploy das novas funções consolidadas tenha sido realizado com sucesso e que todas as funcionalidades estejam operando conforme esperado. 