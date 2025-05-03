# Configuração de Webhook do Asaas no RunCash

## Introdução

Este documento contém instruções sobre como configurar corretamente o webhook do Asaas para enviar notificações de eventos de assinatura (criação, pagamento, cancelamento, etc.) para o backend do RunCash.

## Problema Identificado

Atualmente, o webhook do Asaas está configurado para enviar notificações para a URL do frontend (`https://runcashh11.vercel.app/api/asaas-webhook`), mas esta URL não possui uma rota implementada para processar esses eventos. Como resultado, as atualizações de status de assinatura não estão sendo registradas automaticamente no banco de dados.

## Solução Implementada

Implementamos uma nova rota `/api/asaas-webhook` no backend para processar os eventos do webhook do Asaas. Esta rota atualiza automaticamente as coleções `subscriptions` e `userSubscriptions` no banco de dados quando recebe notificações de eventos de assinatura.

## Instruções para Configuração

### Passo 1: Acessar o Painel do Asaas

1. Faça login na sua conta do Asaas (https://www.asaas.com/)
2. Acesse o menu "Configurações" ou "Integrações"
3. Encontre a seção "Webhooks" ou "Notificações"

### Passo 2: Configurar ou Editar o Webhook

1. Clique em "Adicionar Webhook" ou edite o webhook existente
2. Configure os seguintes campos:

   - **URL**: `https://backendapi-production-36b5.up.railway.app/api/asaas-webhook`
   - **Eventos para notificar**: Selecione todos os eventos relacionados a assinaturas:
     - SUBSCRIPTION_CREATED
     - SUBSCRIPTION_RENEWED
     - SUBSCRIPTION_UPDATED
     - SUBSCRIPTION_PAID
     - SUBSCRIPTION_CANCELED
     - SUBSCRIPTION_OVERDUE
     - SUBSCRIPTION_DELETED

3. Salve as configurações

### Passo 3: Testar o Webhook

1. No painel do Asaas, procure pela opção "Testar Webhook"
2. Envie um evento de teste (por exemplo, SUBSCRIPTION_CREATED) para verificar se o backend está recebendo e processando corretamente as notificações
3. Você deve receber uma resposta com status 200 e uma mensagem de sucesso

> **Nota:** O deploy da nova configuração pode levar alguns minutos para ser concluído no servidor Railway. Se você receber um erro 404, aguarde alguns minutos e tente novamente.

## Comportamento Esperado

Após a configuração correta do webhook:

1. Quando um cliente assina um plano no Asaas, o webhook envia uma notificação para o backend
2. O backend processa a notificação e atualiza as coleções `subscriptions` e `userSubscriptions` com o status atual da assinatura
3. O sistema usa os dados do banco de dados local para verificar o status da assinatura, sem precisar fazer chamadas adicionais à API do Asaas

## Resolução de Problemas

Se o webhook não estiver funcionando corretamente, verifique:

1. Se a URL está configurada corretamente no painel do Asaas
2. Se o backend está online e acessível (pode testar acessando `https://backendapi-production-36b5.up.railway.app/`)
3. Se há algum firewall ou configuração de rede bloqueando as requisições do Asaas para o backend
4. Se o servidor Railway está funcionando normalmente

### Logs de Diagnóstico

Quando ocorrer um evento de webhook, o servidor deve registrar logs com as seguintes informações:
- "Webhook recebido do Asaas: [dados do payload]"
- "Processando evento [tipo do evento] para assinatura [ID] (cliente [ID])"
- "Conectado ao MongoDB"
- "Atualização nas coleções subscriptions e userSubscriptions"

Se esses logs não estiverem aparecendo, há um problema na recepção do webhook.

## Monitoramento

Após a configuração, monitore o funcionamento do webhook verificando:

1. Os logs do backend no Railway para confirmar o recebimento e processamento das notificações
2. O banco de dados MongoDB para confirmar que os status das assinaturas estão sendo atualizados corretamente
3. O comportamento do aplicativo para garantir que está verificando corretamente o status das assinaturas

---

*Documento criado em: 03/05/2025*
*Atualizado em: 03/05/2025* 