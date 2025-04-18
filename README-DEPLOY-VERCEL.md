# Guia de Deploy da API no Vercel com Webhook do ASAAS

Este documento explica como implantar corretamente a API no Vercel e configurar o webhook do ASAAS.

## Estrutura de Arquivos para o Vercel

O Vercel utiliza a pasta `/api` na raiz do projeto para funções serverless. A estrutura implementada é:

```
/api
  ├── asaas-webhook.js             # Processa eventos do ASAAS
  ├── asaas-create-customer.js     # Cria clientes no ASAAS
  ├── asaas-create-subscription.js # Cria assinaturas
  ├── asaas-find-payment.js        # Busca informações de pagamentos
  ├── asaas-pix-qrcode.js          # Obtém QR code PIX
  ├── asaas-find-subscription.js   # Busca informações de assinaturas
  ├── asaas-cancel-subscription.js # Cancela assinaturas
  ├── asaas-find-customer.js       # Busca informações de clientes
  └── package.json                 # Dependências específicas da API
```

Os arquivos `.js` na pasta `/api` são redirecionadores (proxies) para a implementação real, que está em `/backend/api/payment/`.

## Configuração do Vercel

O arquivo `vercel.json` na raiz do projeto configura as funções e rotas:

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "functions": {
    "api/asaas-create-customer.js": {
      "memory": 1024,
      "maxDuration": 10
    },
    "api/asaas-create-subscription.js": {
      "memory": 1024,
      "maxDuration": 10
    },
    // ... outras funções
  },
  "rewrites": [
    // ... configurações de rotas
  ],
  "env": {
    // Variáveis de ambiente
  }
}
```

## Variáveis de Ambiente

Configure as seguintes variáveis de ambiente no dashboard do Vercel:

- `ASAAS_API_KEY`: Sua chave de API do ASAAS
- `ASAAS_ENVIRONMENT`: `sandbox` (testes) ou `production` (produção)
- `MONGODB_URI`: URL de conexão do MongoDB
- `MONGODB_DB_NAME`: Nome do banco de dados
- `FRONTEND_URL`: URL do frontend
- `PUBLIC_WEBHOOK_URL`: URL completa do webhook (ex: `https://seudominio.com/api/asaas-webhook`)

## Configuração do Webhook no ASAAS

Após o deploy no Vercel, configure o webhook no ASAAS:

1. Acesse o painel do ASAAS
2. Vá para Configurações > Integrações > Notificações Webhook
3. Adicione um webhook com:
   - **URL**: `https://seudominio.vercel.app/api/asaas-webhook`
   - **E-mail**: Seu e-mail para notificações
   - **Versão da API**: v3
   - **Webhook ativo**: Sim
   - **Fila de sincronização**: Sim

## Testando o Webhook

Após a configuração:

1. Acesse o endpoint do webhook diretamente no navegador:
   ```
   https://seudominio.vercel.app/api/asaas-webhook
   ```
   Deve retornar uma mensagem indicando que o endpoint está ativo.

2. No painel do ASAAS, tente reenviar um evento de webhook para testar.

3. Verifique os logs de execução no painel do Vercel para confirmar que os eventos estão sendo recebidos.

## Solução de Problemas

### Erro "Pattern doesn't match any Serverless Functions"

Este erro ocorre quando o Vercel não encontra os arquivos de funções especificados no `vercel.json`.

**Solução**: Verifique se todos os arquivos referenciados em `functions` existem na pasta `/api` com o nome exato.

### Webhook não recebe eventos

**Verificações**:
1. A URL do webhook está acessível publicamente?
2. O webhook está ativo no painel do ASAAS?
3. Os logs do Vercel mostram requisições chegando ao endpoint?
4. O código está processando corretamente os eventos recebidos?

## Manutenção

Para atualizar as funções:

1. Modifique os arquivos originais em `/backend/api/payment/`
2. Se necessário, atualize os redirecionadores em `/api/`
3. Faça deploy novamente no Vercel

A estrutura de proxy implementada permite manter o código principal organizado enquanto atende aos requisitos do Vercel. 