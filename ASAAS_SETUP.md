# Configuração do Sistema de Planos Asaas

Este documento explica como configurar o sistema de pagamentos Asaas para funcionar com os planos da plataforma.

## Pré-requisitos

1. Conta no Asaas (https://www.asaas.com/)
2. Acesso ao painel administrativo do Asaas
3. Variáveis de ambiente configuradas no servidor

## Criação da Conta e Obtenção da Chave de API

1. Crie uma conta no Asaas ou faça login na sua conta existente
2. No painel administrativo, vá para "Configurações" > "Integrações" > "API Asaas"
3. Copie a chave de API fornecida
4. Configure a chave no arquivo `.env` do projeto:
   ```
   ASAAS_API_KEY=sua_chave_api_asaas
   ASAAS_ENVIRONMENT=production  # Use 'sandbox' para ambiente de teste
   ```

## Configuração do Webhook

Para receber notificações de eventos relacionados a pagamentos (como confirmações, cancelamentos, etc.), siga os passos:

1. No painel do Asaas, vá para "Configurações" > "Integrações" > "Notificações via Webhook"
2. Clique em "Adicionar webhook"
3. Insira a URL do seu webhook: `https://runcashh11.vercel.app/api/asaas-webhook`
   - Certifique-se de substituir "runcashh11.vercel.app" pelo seu domínio real
4. Selecione os eventos que deseja receber:
   - Pagamento recebido (PAYMENT_RECEIVED)
   - Pagamento confirmado (PAYMENT_CONFIRMED)
   - Pagamento atrasado (PAYMENT_OVERDUE)
   - Pagamento cancelado/estornado (PAYMENT_REFUNDED)
   - Pagamento removido (PAYMENT_DELETED)
   - Assinatura cancelada (SUBSCRIPTION_CANCELLED)
5. Salve as configurações

## Verificação do Webhook

Para verificar se o webhook está funcionando corretamente:

1. No painel do Asaas, vá para "Configurações" > "Integrações" > "Notificações via Webhook"
2. Localize o webhook configurado e clique em "Testar"
3. Selecione um tipo de evento para enviar um teste (ex: PAYMENT_RECEIVED)
4. Verifique nos logs do seu servidor se o evento foi recebido e processado corretamente

## Testes no Ambiente de Produção

Antes de considerar a implementação concluída:

1. Certifique-se de que `ASAAS_ENVIRONMENT=production` está configurado no arquivo `.env`
2. Crie uma assinatura real (pode ser com um valor mínimo)
3. Faça um pagamento para testar o ciclo completo
4. Verifique se o status da assinatura é atualizado corretamente no seu banco de dados
5. Cancele a assinatura de teste para não deixar cobranças pendentes

## Fluxo de Assinatura

1. Usuário seleciona um plano na página de planos
2. Sistema coleta informações de pagamento (nome, email, CPF)
3. Sistema cria um cliente no Asaas (ou recupera um cliente existente)
4. Sistema cria uma assinatura vinculada ao cliente e plano selecionado
5. Usuário é redirecionado para a página de pagamento do Asaas
6. Após pagamento, o Asaas notifica o sistema via webhook
7. Sistema atualiza o status da assinatura com base no evento recebido

## Solução de Problemas

### Pagamentos não estão sendo processados
- Verifique se a chave de API está correta
- Confirme que o ambiente (sandbox/production) está configurado corretamente
- Verifique se o webhook está configurado e acessível publicamente

### Eventos não estão sendo recebidos
- Verifique se a URL do webhook está correta e acessível
- Confirme que os eventos necessários estão selecionados no painel do Asaas
- Verifique os logs do servidor para identificar possíveis erros
- Teste a URL do webhook diretamente no navegador para verificar se está acessível

### Assinaturas não estão sendo atualizadas
- Verifique a conexão com o banco de dados
- Confirme que o webhook está recebendo os eventos corretamente
- Verifique os logs do servidor para identificar erros no processamento dos eventos 