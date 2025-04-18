# Configuração do Webhook do ASAAS

Este documento descreve como configurar corretamente o webhook do ASAAS para receber notificações de eventos relacionados a pagamentos e assinaturas.

## Pré-requisitos

- Conta ativa no ASAAS (Sandbox ou Produção)
- Chave de API do ASAAS configurada no arquivo `.env`
- URL pública acessível pela internet para receber os webhooks

## Configuração do Ambiente

1. Certifique-se de que seu backend esteja acessível publicamente pela internet.
   - Você pode usar serviços como Vercel, Netlify, Railway, ou qualquer outro provedor de hospedagem.
   - Para testes locais, é possível utilizar ferramentas como ngrok ou cloudflared para expor seu servidor local à internet.

2. Configure as variáveis de ambiente no arquivo `.env` na pasta `backend/api/`:

```
ASAAS_API_KEY=sua_chave_api_aqui
ASAAS_ENVIRONMENT=sandbox  # ou 'production' para ambiente de produção
PUBLIC_WEBHOOK_URL=https://seu-dominio.com/api/payment/asaas-webhook
ADMIN_EMAIL=seu-email@exemplo.com
```

## Registrando o Webhook no ASAAS

### Método Automático (Recomendado)

Criamos um script para facilitar o registro do webhook no ASAAS. Para utilizá-lo:

1. Certifique-se de que as variáveis de ambiente estejam configuradas corretamente.
2. Execute o seguinte comando na raiz do projeto:

```bash
npm run register-webhook
```

O script irá:
- Verificar se já existe um webhook configurado com a URL especificada
- Criar um novo webhook se necessário
- Ativar o webhook se estiver desativado

### Método Manual

Se preferir configurar manualmente:

1. Acesse o painel do ASAAS (sandbox.asaas.com ou www.asaas.com)
2. Vá para Configurações > Integrações > Notificações Webhook
3. Adicione um novo webhook com a URL do seu endpoint:
   - URL: `https://seu-dominio.com/api/payment/asaas-webhook`
   - Email para Notificação: seu email para receber alertas
   - Versão da API: v3

## Eventos Processados

O sistema processa os seguintes eventos do ASAAS:

- `PAYMENT_RECEIVED` - Pagamento recebido
- `PAYMENT_CONFIRMED` - Pagamento confirmado
- `PAYMENT_OVERDUE` - Pagamento atrasado
- `PAYMENT_DELETED` - Pagamento excluído
- `PAYMENT_REFUNDED` - Pagamento reembolsado
- `PAYMENT_REFUND_REQUESTED` - Solicitação de reembolso
- `SUBSCRIPTION_CANCELLED` - Assinatura cancelada

## Verificando o Funcionamento

Para verificar se o webhook está funcionando corretamente:

1. Acesse a URL do webhook no navegador (ex: `https://seu-dominio.com/api/payment/asaas-webhook`)
   - Você deve receber uma resposta com status 200 e uma mensagem indicando que o endpoint está ativo.

2. Monitore os logs do servidor após realizar um teste de pagamento/assinatura.
   
3. Verifique no MongoDB a coleção `webhook_logs` para confirmar se os eventos estão sendo registrados:

```javascript
// Exemplo de consulta
db.webhook_logs.find().sort({created_at: -1}).limit(10)
```

## Solução de Problemas

### Webhook não está recebendo eventos

1. Verifique se a URL do webhook está acessível pela internet.
2. Confirme se o webhook está corretamente registrado e habilitado no painel do ASAAS.
3. Verifique os logs do servidor para identificar possíveis erros.
4. Teste a rota do webhook manualmente com uma ferramenta como Postman.

### Erros nos Logs

- **Erro "Assinatura não encontrada"**: Certifique-se de que a assinatura existe no MongoDB com o ID correto.
- **Erro de conexão com MongoDB**: Verifique as credenciais e conexão com o banco de dados.

## Testando o Webhook (Ambiente Sandbox)

Criamos um script para testar o webhook no ambiente sandbox:

```bash
node test-asaas-events.mjs
```

Este script:
- Cria um cliente de teste
- Cria uma assinatura
- Simula eventos como confirmação e atraso de pagamento

Nota: Este script funciona apenas no ambiente sandbox e não afeta dados reais no ambiente de produção. 