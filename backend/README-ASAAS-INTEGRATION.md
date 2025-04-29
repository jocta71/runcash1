# Integração com Asaas - Sistema de Proteção da API

Este documento descreve como o sistema de assinaturas Asaas foi integrado com a API `/api/roulettes` para controlar o acesso apenas a usuários com assinaturas ativas.

## Visão Geral da Arquitetura

O sistema implementa um fluxo completo para gerenciar assinaturas:

1. **Webhook do Asaas**: Recebe eventos do Asaas (pagamentos confirmados, cancelamentos, etc.)
2. **Middleware de Verificação**: Protege rotas `/api/roulettes` verificando o status da assinatura
3. **Banco de Dados**: Armazena estado das assinaturas e logs de eventos

## Webhook do Asaas (`/api/asaas-webhook`)

O webhook processa eventos do Asaas e atualiza o banco de dados MongoDB:

- Recebe notificações de pagamentos confirmados, cancelados, atrasados, etc.
- Atualiza o status da assinatura do usuário no banco de dados
- Registra logs detalhados de todas as ações
- Adiciona notificações para o usuário no sistema

### Eventos Principais Tratados:

- `PAYMENT_CONFIRMED`: Ativa a assinatura e define data de expiração
- `PAYMENT_OVERDUE`: Marca assinatura como atrasada
- `SUBSCRIPTION_CANCELLED`: Cancela a assinatura
- `PAYMENT_REFUNDED`: Cancela a assinatura

## Middleware de Verificação de Assinatura

O middleware `verificarAssinaturaRoletas` protege as rotas:

- Extrai o token JWT do cabeçalho de autorização
- Decodifica o token para obter o ID do usuário
- Consulta o banco de dados para verificar se o usuário tem assinatura ativa
- Verifica se a assinatura não está expirada
- Registra o acesso à API em logs para análise e auditoria

### Rotas Protegidas:

- `/api/roulettes`: Lista todas as roletas disponíveis
- `/api/ROULETTES`: Versão em maiúsculas para compatibilidade com frontend

## Estrutura do Banco de Dados

### Coleções Principais:

- `subscriptions`: Armazena detalhes das assinaturas
- `webhook_logs`: Registra todos os eventos do webhook
- `subscription_logs`: Registra alterações de estado das assinaturas
- `api_access_logs`: Registra acessos à API protegida
- `notifications`: Mensagens para o usuário sobre status da assinatura

### Estrutura da Assinatura:

```json
{
  "_id": "ObjectId",
  "user_id": "string",
  "payment_id": "string",
  "plan_id": "string",
  "status": "string",
  "expirationDate": "Date",
  "nextDueDate": "Date",
  "value": "number",
  "cycle": "string",
  "asaas_customer_id": "string",
  "activationDate": "Date",
  "created_at": "Date",
  "updated_at": "Date"
}
```

## Fluxo de Funcionamento

1. Usuário faz assinatura através do frontend (usando `/api/asaas-create-subscription`)
2. Asaas envia webhook quando status do pagamento é alterado
3. Sistema atualiza o status da assinatura no banco
4. Quando usuário tenta acessar `/api/roulettes`, middleware verifica se há assinatura ativa
5. Se assinatura estiver ativa, permite acesso; caso contrário, rejeita com código 403

## Considerações Adicionais

- **Ambiente de desenvolvimento**: Use `SKIP_SUBSCRIPTION_CHECK=true` para desativar verificação
- **Monitoramento**: Logs detalhados são criados em todas as etapas para facilitar depuração
- **Tolerância**: Períodos extras de tolerância foram adicionados às assinaturas (3-7 dias dependendo do plano)
- **Tempo de vida**: Assinaturas têm data de expiração baseada no ciclo (mensal, trimestral, anual)

## Testes e Depuração

Para testar o sistema:

1. Use o endpoint `/api/asaas-webhook` com método GET para verificar se está ativo
2. Verifique logs na coleção `webhook_logs` para monitorar eventos
3. Teste acesso à API com diferentes status de assinatura

## Melhores Práticas

1. Sempre verifique os logs em caso de problemas com assinaturas
2. Mantenha o webhook seguro e acessível para o Asaas
3. Monitore a coleção `api_access_logs` para detectar tentativas de acesso não autorizadas 