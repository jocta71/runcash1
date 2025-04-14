# Integração Hubla - RunCash

Esta pasta contém os arquivos necessários para a integração com o Hubla, permitindo a criação de checkouts e o processamento de webhooks para assinaturas.

## Endpoints Disponíveis

### Checkout

- **POST /api/hubla-create-checkout**: Cria um checkout no Hubla e retorna a URL para redirecionamento
  - **Parâmetros**: `planId`, `userId`, `name`, `email`, `cpfCnpj` (opcional), `mobilePhone` (opcional)
  - **Resposta**: `{ success: true, checkoutId: '...', url: '...', message: '...' }`

### Webhook

- **POST /api/hubla-webhook**: Processa webhooks enviados pelo Hubla
  - **Headers**: `x-hubla-signature` (assinatura do webhook)
  - **Corpo**: Evento do Hubla
  - **Resposta**: `{ received: true }`

### Teste

- **GET /api/test-hubla**: Testa a configuração da integração com o Hubla
  - **Resposta**: `{ environment: '...', hubla: { ... }, serverInfo: { ... } }`

## Configuração

Para que a integração funcione corretamente, é necessário configurar as seguintes variáveis de ambiente:

```bash
# Chave de API do Hubla (obrigatória)
HUBLA_API_KEY=seu_token_aqui

# Segredo para validação de webhooks (produção)
HUBLA_WEBHOOK_SECRET=seu_segredo_aqui

# URL do serviço de backend para atualização de assinaturas
API_SERVICE_URL=https://backendapi-production-36b5.up.railway.app

# Chave secreta para comunicação com o backend
API_SECRET_KEY=seu_segredo_aqui
```

## Uso no Frontend

Para utilizar a integração no frontend, importe o cliente e utilize as funções disponíveis:

```javascript
const { processHublaPayment } = require('./api/frontend-client');

// Função para iniciar o checkout
async function startCheckout(planId, userId, userData) {
  try {
    await processHublaPayment({
      planId, // 'MENSAL' ou 'ANUAL'
      userId,
      name: userData.name,
      email: userData.email,
      cpfCnpj: userData.cpfCnpj,
      mobilePhone: userData.mobilePhone
    });
  } catch (error) {
    console.error('Erro no checkout:', error);
    // Tratar erro
  }
}
```

## Eventos do Webhook

O webhook processa os seguintes eventos do Hubla:

- `checkout.completed`: Checkout concluído com sucesso
- `subscription.cancelled`: Assinatura cancelada
- `subscription.expired`: Assinatura expirada

## Desenvolvimento

Para testar a integração localmente, utilize o endpoint `/api/test-hubla` para verificar se as variáveis de ambiente estão configuradas corretamente. 