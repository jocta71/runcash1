# Integração com Asaas e Controle de Acesso à API

Este documento descreve a arquitetura e o fluxo de integração do sistema de assinaturas Asaas com o controle de acesso à API de roletas.

## Arquitetura

O sistema é composto por três partes principais:

1. **Frontend**: Interface do usuário onde ele pode se cadastrar, fazer login e assinar o serviço.
2. **Backend Principal**: API que fornece dados de roletas e outros recursos do sistema.
3. **Serviço de Assinaturas**: Microserviço dedicado a gerenciar assinaturas e controlar acesso à API principal.

```
┌────────────┐      ┌─────────────────┐      ┌─────────────┐
│  Frontend  │◄────►│ Backend/API     │◄────►│   Asaas     │
└────────────┘      │ Principal       │      │  Payment    │
       ▲            └─────────────────┘      │  Gateway    │
       │                     ▲               └─────────────┘
       │                     │                     ▲
       │                     │                     │
       │                     ▼                     │
       │            ┌─────────────────┐            │
       └───────────┤  Serviço de     ├────────────┘
                   │  Assinaturas    │
                   └─────────────────┘
```

## Fluxo de Assinatura

1. **Cadastro de Usuário**:
   - Usuário se cadastra no frontend
   - Dados básicos são salvos no serviço de assinaturas

2. **Criação da Assinatura**:
   - Usuário escolhe um plano no frontend
   - Frontend solicita criação de cliente e assinatura no serviço de assinaturas
   - Serviço de assinaturas cria cliente e assinatura na Asaas
   - Asaas retorna URL de pagamento
   - Usuário é redirecionado para pagamento

3. **Processamento de Webhook**:
   - Asaas envia webhook quando há atualização no status do pagamento
   - Serviço de assinaturas processa o webhook
   - Status da assinatura é atualizado no banco de dados
   - Acesso à API é atualizado conforme status da assinatura

4. **Acesso à API**:
   - Usuário solicita dados da API principal
   - Backend verifica com o serviço de assinaturas se o usuário tem acesso
   - Serviço de assinaturas retorna status de acesso
   - Backend permite ou nega acesso com base na resposta

## Configuração do Webhook

1. Configure o webhook na plataforma Asaas apontando para:
   ```
   https://seu-servico-assinaturas.com/api/asaas/webhook
   ```

2. Configure os eventos a serem recebidos:
   - `PAYMENT_RECEIVED`
   - `PAYMENT_CONFIRMED`
   - `PAYMENT_OVERDUE`
   - `PAYMENT_FAILED`
   - `SUBSCRIPTION_CANCELED`

## Implementação do Middleware de Verificação

No backend principal, foi implementado um middleware que verifica se o usuário tem uma assinatura ativa antes de permitir acesso às rotas de roletas:

```javascript
// backend/middleware/subscription.middleware.js
module.exports = async (req, res, next) => {
  // Extrair usuário da requisição
  const userId = req.user?.id;
  
  // Verificar com o serviço de assinaturas
  const response = await axios.get(`${subscriptionServiceUrl}/api/subscription/verify/${userId}`);
  
  // Permitir ou negar acesso com base na resposta
  if (response.data.canAccess) {
    return next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Assinatura ativa necessária'
    });
  }
};
```

## Próximos Passos

1. **Implementar Páginas de Assinatura no Frontend**:
   - Página de seleção de planos
   - Página de checkout
   - Página de status da assinatura

2. **Completar Endpoints no Serviço de Assinaturas**:
   - Implementar criação de cliente na Asaas
   - Implementar criação de assinatura na Asaas
   - Adicionar mais opções de planos

3. **Melhorias de Segurança**:
   - Implementar validação de IP nos webhooks
   - Adicionar logs detalhados de todas as operações
   - Implementar sistema de notificação para falhas

## Tecnologias Utilizadas

- **Backend**: Node.js, Express, MongoDB
- **Serviço de Assinaturas**: Node.js, Express, MongoDB
- **Frontend**: React, Vite
- **Gateway de Pagamento**: Asaas 