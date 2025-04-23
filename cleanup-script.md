# Script de Limpeza de Endpoints Antigos

Após implementar os novos endpoints consolidados e atualizar as chamadas no frontend, execute os comandos abaixo para remover os arquivos antigos:

```bash
# Remover endpoints de pagamentos (agora consolidados em asaas-payments.js)
rm api/asaas-create-payment.js
rm api/asaas-list-payments.js
rm api/asaas-get-payment.js
rm api/asaas-find-payment.js
rm api/asaas-pix-qrcode.js

# Remover endpoints de assinaturas (agora consolidados em asaas-subscriptions.js)
rm api/asaas-create-subscription.js
rm api/asaas-find-subscription.js
rm api/asaas-cancel-subscription.js
```

**Observação:** Mantenha o arquivo `api/asaas-webhook.js`, pois este continua sendo um endpoint independente. 