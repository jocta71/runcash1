# Resumo da Página de Teste do Asaas

## Visão Geral

A aplicação possui uma página de teste dedicada à integração com a plataforma Asaas, acessível pela URL `/asaas-test`. Esta página permite testar todas as funcionalidades da integração de pagamentos em um ambiente controlado.

## Estrutura e Localização dos Arquivos

- **Frontend**:
  - **Página principal**: `frontend/src/pages/AsaasTestPage.tsx`
  - **Integração com Asaas**: `frontend/src/integrations/asaas/client.ts`
  - **Página de pagamento**: `frontend/src/pages/AsaasPaymentPage.tsx`

- **Backend (API)**:
  - Endpoints de API: `/api/{endpoint}.js`
  - Principais endpoints:
    - `asaas-create-customer.js`
    - `asaas-create-subscription.js`
    - `asaas-find-payment.js`
    - `asaas-pix-qrcode.js`
    - `asaas-cancel-subscription.js`
    - `asaas-webhook.js`

## Funcionalidades Disponíveis na Página de Teste

A página de teste oferece as seguintes funcionalidades:

1. **Criação de Clientes**:
   - Formulário para inserção de nome, email, CPF e telefone
   - Verificação se o cliente já existe por CPF
   - Exibição do ID de cliente gerado pelo Asaas

2. **Criação de Assinaturas**:
   - Vinculação de um cliente a um plano
   - Escolha do método de pagamento (PIX ou Cartão de Crédito)
   - Obtenção do ID da assinatura e do pagamento

3. **Verificação de Pagamentos**:
   - Consulta do status atual de um pagamento
   - Exibição detalhada da resposta da API do Asaas

4. **Cancelamento de Assinaturas**:
   - Cancelamento de uma assinatura ativa pelo ID
   - Exibição da confirmação de cancelamento

## Como Utilizar

1. Acesse a página de teste pelo link `/asaas-test` ou pelo botão na página inicial
2. Siga o fluxo recomendado na parte inferior da página:
   - Crie um cliente e copie o ID
   - Use o ID para criar uma assinatura com um plano (ex: basic, pro, premium)
   - Copie o ID do pagamento para verificar seu status
   - Opcionalmente, cancele a assinatura

## Configuração do Ambiente

- A integração usa o ambiente sandbox do Asaas para testes
- Todas as chamadas de API são feitas através do backend para proteger a chave de API
- As credenciais são configuradas através de variáveis de ambiente

## Fluxo de Dados

1. O frontend faz chamadas para o client.ts que centraliza a comunicação com a API
2. O client.ts envia requisições para endpoints da API no backend
3. Os endpoints de API no backend se comunicam com a API do Asaas
4. Os dados são salvos no MongoDB para referência futura

Este ambiente de teste é essencial para desenvolvedores e administradores testarem o processo de pagamento sem afetar dados de produção ou realizar transações reais. 