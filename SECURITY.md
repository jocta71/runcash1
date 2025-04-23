# Guia de Segurança RunCash

Este documento descreve as práticas de segurança implementadas e as configurações recomendadas para o sistema RunCash, especialmente relacionadas ao fluxo de pagamento e integração com o Asaas.

## Configuração de Variáveis de Ambiente

Para garantir a segurança da aplicação, configure as seguintes variáveis de ambiente:

```
# Chave da API Asaas (nunca compartilhe!)
ASAAS_API_KEY=sua_chave_api_asaas

# Ambiente do Asaas (sandbox ou production)
ASAAS_ENVIRONMENT=sandbox

# Segredo para verificação de webhooks (gere um valor aleatório forte)
ASAAS_WEBHOOK_SECRET=chave_secreta_para_validar_webhooks

# URL do frontend (para CORS e callbacks)
FRONTEND_URL=https://seu-dominio.com

# URL do admin (para CORS, se aplicável)
ADMIN_URL=https://admin.seu-dominio.com

# Segredo para tokens JWT (gere um valor aleatório forte)
JWT_SECRET=chave_secreta_para_tokens_jwt

# Configuração do MongoDB
MONGODB_ENABLED=true
MONGODB_URI=mongodb://usuario:senha@servidor:porta/database
MONGODB_DATABASE=runcash
```

### Importante: Geração de Segredos

Para gerar segredos seguros, use o seguinte comando:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Validação de Webhooks do Asaas

Para garantir que apenas o Asaas pode enviar webhooks válidos para seu sistema:

1. Configure o `ASAAS_WEBHOOK_SECRET` em seu ambiente
2. Configure o mesmo segredo no painel do Asaas
3. Verifique se a validação de assinatura está habilitada em todos os endpoints de webhook

## Boas Práticas de Segurança

1. **Controle de Acesso**:
   - Cada usuário só deve ter acesso aos próprios dados
   - Validar o ID de usuário em todas as operações de pagamento
   - Verificar se o customerId pertence ao usuário autenticado

2. **Proteção contra Ataques**:
   - Limite de requisições (rate limiting) implementado em endpoints críticos
   - Restrição de CORS para domínios confiáveis
   - Validação de dados em todas as entradas

3. **Proteção de Dados Sensíveis**:
   - Nunca registre dados completos de cartão de crédito
   - Mascare CPF/CNPJ e outras informações pessoais em logs
   - Use HTTPS para todas as comunicações

4. **Valores Oficiais de Planos**:
   - Os preços dos planos são definidos no servidor, nunca pelo cliente
   - Validação rigorosa de valores para evitar manipulação

## Monitoramento e Logs

1. Configure alertas para:
   - Tentativas de manipulação de valores de planos
   - Falhas na verificação de assinatura de webhooks
   - Tentativas de acessar dados de outros usuários

2. Revise regularmente:
   - Logs de webhooks recebidos
   - Tentativas rejeitadas por rate limiting
   - Assinaturas criadas e canceladas

## Configuração do Asaas

No painel do Asaas, configure:

1. **Webhooks**:
   - URL: `https://seu-dominio.com/backend/api/payment/asaas-webhook`
   - Eventos: payment, subscription.created, subscription.cancelled, etc.
   - Segredo compartilhado: O mesmo valor de `ASAAS_WEBHOOK_SECRET`

2. **Segurança**:
   - Restrinja o uso de sua chave de API por IP, se possível
   - Use um ambiente sandbox para testes
   - Rotacione periodicamente sua chave de API

## Recuperação de Dados

Para garantir a integridade do sistema:

1. Implemente reconciliação periódica:
   - Compare o status das assinaturas no banco de dados com o Asaas
   - Corrija discrepâncias automaticamente
   - Execute diariamente via cron job

2. Configure o webhook de "payment" para:
   - Atualizar o status da assinatura
   - Registrar o pagamento no banco de dados
   - Enviar notificação ao usuário se necessário

## Tratamento de Erros

1. Implemente tratamento adequado para:
   - Falhas na comunicação com o Asaas
   - Tentativas de fraude
   - Inconsistência de dados

2. Use timeouts adequados para todas as chamadas externas
   - Defina um timeout padrão de 10 segundos para chamadas ao Asaas
   - Implemente retry com backoff exponencial para falhas temporárias

## Verificação de Segurança

Execute periodicamente:

1. Testes de penetração nos endpoints de pagamento
2. Revisão de código focada em segurança
3. Atualizações de todas as dependências com vulnerabilidades conhecidas 