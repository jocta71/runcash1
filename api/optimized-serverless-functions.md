# Otimização das Funções Serverless do RunCash

## Funções Serverless Essenciais a Serem Mantidas

Após análise da estrutura atual, recomendamos manter apenas as 12 funções serverless essenciais:

1. **asaas-create-customer.js**
   - Função para criar um novo cliente no Asaas
   - Essencial para o fluxo de pagamento

2. **asaas-find-customer.js**
   - Função para buscar informações de um cliente no Asaas
   - Necessária para validação e exibição de dados do cliente

3. **asaas-create-subscription.js**
   - Função para criar assinaturas recorrentes
   - Central para o modelo de negócio

4. **asaas-find-subscription.js**
   - Função para buscar informações de assinaturas
   - Necessária para verificação de status e renovação

5. **asaas-cancel-subscription.js**
   - Função para cancelamento de assinaturas
   - Importante para gerenciamento do ciclo de vida do cliente

6. **asaas-find-payment.js**
   - Função para verificar status de pagamentos
   - Essencial para confirmar transações e liberar acesso

7. **asaas-pix-qrcode.js**
   - Função para gerar QR code de pagamento PIX
   - Método de pagamento importante para o mercado brasileiro

8. **update-user.js**
   - Função para atualizar informações do usuário
   - Necessária para manter dados atualizados

9. **webhook-manager.js**
   - Função para processar webhooks do Asaas
   - Essencial para automação de fluxos após eventos de pagamento

10. **health.js**
    - Função para verificação de status da API
    - Importante para monitoramento

11. **auth.js** (a ser implementada)
    - Função unificada para autenticação
    - Consolidará lógica de autenticação das outras funções

12. **redirect.js** (a ser implementada)
    - Função para gerenciar redirecionamentos após pagamentos
    - Consolidará lógica de redirecionamento das funções existentes

## Implementação Sugerida

Para otimizar ainda mais, recomendamos:

1. **Refatorar funções existentes** para compartilhar código comum:
   - Criar um módulo utilitário compartilhado para validação, conexão com MongoDB e Asaas
   - Implementar um padrão consistente de resposta de erro e sucesso

2. **Implementar funções auth.js e redirect.js** para centralizar lógica comum

3. **Atualizar o vercel.json** para refletir apenas as funções mantidas

4. **Criar documentação** descrevendo cada função e seus parâmetros de entrada/saída

Este plano reduzirá a complexidade, melhorará a manutenibilidade e garantirá que todas as funcionalidades essenciais sejam preservadas com menos código redundante. 