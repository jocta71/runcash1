# Configuração dos Webhooks da Asaas

Este guia explica como configurar os webhooks da Asaas para notificar automaticamente seu aplicativo quando ocorrem eventos relacionados a pagamentos e assinaturas.

## 1. Implementação do Servidor

### Opção 1: Usando o servidor Express dedicado
O arquivo `backend/src/webhook-server.js` contém um servidor Express dedicado para receber webhooks. Para usá-lo:

1. Navegue até a pasta do backend
```bash
cd backend
```

2. Instale as dependências (se ainda não o fez)
```bash
npm install express body-parser cors
```

3. Inicie o servidor de webhook
```bash
node src/webhook-server.js
```

O servidor será iniciado na porta 3030 por padrão. Você pode mudar isso definindo a variável de ambiente `WEBHOOK_PORT`.

### Opção 2: Integrando em seu aplicativo Next.js
Alternativamente, você pode usar o arquivo `frontend/src/pages/api/asaas-webhook.ts` para receber webhooks diretamente em seu aplicativo Next.js.

## 2. Configuração no Painel da Asaas

1. Faça login no painel da Asaas (https://www.asaas.com/login)

2. Navegue até **Configurações → Integrações → Webhooks**

3. Clique em **Adicionar Webhook**

4. Preencha as informações:
   - **URL**: URL pública do seu endpoint (ex: `https://seu-dominio.com/api/asaas-webhook`)
   - **Descrição**: Um nome descritivo (ex: "Notificações de pagamento")
   - **Token**: Crie uma chave de segurança única

5. Selecione os eventos que deseja receber:
   - `PAYMENT_CREATED` - Quando um novo pagamento é criado
   - `PAYMENT_UPDATED` - Quando um pagamento é atualizado
   - `PAYMENT_CONFIRMED` - Quando um pagamento é confirmado
   - `PAYMENT_RECEIVED` - Quando um pagamento é recebido
   - `PAYMENT_OVERDUE` - Quando um pagamento fica atrasado
   - `SUBSCRIPTION_CREATED` - Quando uma assinatura é criada
   - `SUBSCRIPTION_UPDATED` - Quando uma assinatura é atualizada
   - `SUBSCRIPTION_CANCELLED` - Quando uma assinatura é cancelada

6. Clique em **Salvar**

## 3. Configuração de Segurança (Importante!)

Para implementar segurança adicional, você deve:

1. Adicionar validação do token recebido no cabeçalho `asaas-access-token`
2. Configurar HTTPS para seu endpoint
3. Proteger seu endpoint contra ataques DoS

## 4. Expor o Webhook Localmente com Ngrok (Para Desenvolvimento)

Para testar localmente, você pode usar o Ngrok para expor seu servidor local à internet:

1. Baixe e instale o Ngrok: https://ngrok.com/download

2. Execute o seguinte comando:
```bash
ngrok http 3030
```

3. Use a URL HTTPS gerada pelo Ngrok (ex: `https://a1b2c3d4.ngrok.io/api/asaas-webhook`) na configuração do webhook da Asaas.

## 5. Validação dos Webhooks

A Asaas enviará o token que você configurou no cabeçalho HTTP `asaas-access-token`. Você deve validar este token antes de processar o webhook:

```javascript
// Exemplo de validação
const WEBHOOK_TOKEN = 'seu-token-secreto';

app.use('/api/asaas-webhook', (req, res, next) => {
  const token = req.headers['asaas-access-token'];
  
  if (token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  next();
});
```

## 6. Outros Detalhes Importantes

- **Idempotência**: Um mesmo evento pode ser enviado várias vezes. Use o ID do evento para garantir que cada evento seja processado apenas uma vez.

- **Responsa Rápida**: A Asaas espera uma resposta rápida (dentro de 10 segundos). Se seu processamento for demorado, responda imediatamente e continue o processamento em segundo plano.

- **Código de Resposta**: Sempre retorne código 200 quando receber o webhook, mesmo se ocorrer um erro no processamento. Caso contrário, a Asaas continuará reenviando o evento.

- **IPs da Asaas**: Considere permitir apenas os IPs oficiais da Asaas se estiver usando firewall.

## 7. Debugging

Use as seguintes rotas para debugging:

- `GET /api/webhook-events` - Lista todos os eventos recebidos
- `GET /api/subscription-status/:subscriptionId` - Verifica o status de uma assinatura
- `GET /api/payment-status/:paymentId` - Verifica o status de um pagamento
- `GET /api/user-subscriptions/:customerId` - Lista todas as assinaturas de um cliente
- `GET /api/webhook-status` - Verifica o status do servidor de webhook

## 8. Testes

Após configurar seu webhook, você pode simular eventos na sandbox da Asaas para testar a integração:

1. Faça login na Sandbox da Asaas: https://sandbox.asaas.com/login
2. Crie um cliente, uma assinatura e um pagamento
3. Verifique se seu endpoint está recebendo os eventos corretamente 