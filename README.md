# RunCash - Sistema de Análise de Roletas com IA

Sistema completo para rastreamento, análise e previsão de resultados de roletas de cassino com inteligência artificial.

## Visão Geral do Projeto

O RunCash é uma plataforma completa que oferece:

- Rastreamento em tempo real de números de roletas de cassinos online
- Análise estatística avançada de resultados
- Assistente de IA para análise de padrões e tendências
- Dashboard intuitivo com visualizações de dados
- Sistema de contas e assinaturas integrado

## Estrutura do Projeto

O sistema RunCash é composto por 3 principais componentes:

1. **Frontend**: Interface de usuário React/TypeScript com Tailwind CSS
2. **Backend API**: Serviços de backend para autenticação, pagamentos e persistência
3. **Serverless Functions**: Funções para integração com serviços externos (Asaas, OpenAI/DeepSeek/Gemini)

## Configuração da IA

O RunCash suporta três provedores de IA para análise de padrões de roleta.

### Opção 1: OpenAI

#### Configuração Local (Desenvolvimento)

1. Crie uma conta em [OpenAI Platform](https://platform.openai.com/)
2. Gere uma chave de API em [API Keys](https://platform.openai.com/api-keys)
3. Copie o arquivo `.env.example` para `.env` e adicione sua chave:

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-sua-chave-real-aqui
```

4. Opcionalmente, configure o ID da organização caso esteja usando uma conta de equipe:

```
OPENAI_ORG_ID=org-seu-id-organizacao-aqui
```

5. O modelo padrão é `gpt-4o`, mas você pode alterá-lo:

```
OPENAI_MODEL=gpt-3.5-turbo
```

### Opção 2: DeepSeek

DeepSeek é uma alternativa de alta qualidade à OpenAI, muitas vezes com melhores limites de utilização.

#### Configuração Local (Desenvolvimento)

1. Crie uma conta em [DeepSeek Platform](https://platform.deepseek.com)
2. Gere uma chave de API
3. Copie o arquivo `.env.example` para `.env` e adicione sua chave:

```
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-sua-chave-real-aqui
```

4. O modelo padrão é `deepseek-chat`, mas você pode alterá-lo:

```
DEEPSEEK_MODEL=deepseek-chat
```

### Opção 3: Gemini AI (Recomendado - Gratuito)

Gemini AI é a solução do Google e oferece uma quota gratuita generosa (60 requisições por minuto).

#### Configuração Local (Desenvolvimento)

1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crie ou faça login com sua conta Google
3. Clique em "Get API Key" e copie sua chave
4. Configure o arquivo `.env`:

```
AI_PROVIDER=gemini
GEMINI_API_KEY=sua-chave-api-aqui
```

5. O modelo padrão é `gemini-pro`, mas você pode usar outras opções:

```
GEMINI_MODEL=gemini-pro
```

### Configuração em Produção (Vercel)

1. Adicione as variáveis de ambiente no painel da Vercel:
   - `AI_PROVIDER`: "openai", "deepseek" ou "gemini" 
   - A respectiva chave de API do provedor escolhido
   - Opcionalmente: configuração do modelo para o provedor

2. Importante: Nunca exponha suas chaves de API no código-fonte ou em arquivos públicos.

## Executando o Projeto

### Ambiente de Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor frontend
npm run dev
```

### Testes de IA

```bash
# Testar a integração com OpenAI
node test-openai.js

# Testar a integração com DeepSeek
node test-deepseek.js

# Testar a integração com Gemini AI (Google)
node test-gemini.js

# Testar o endpoint de IA (qualquer provedor configurado)
node test-ai-endpoint.js
```

### Build e Deploy

```bash
# Gerar build de produção
npm run build

# Visualizar versão de produção localmente
npm run preview
```

## Documentação Adicional

- [Frontend README](./frontend/README.md) - Detalhes da implementação do frontend
- [Documentação de Deploy](./frontend/DEPLOY.md) - Instruções detalhadas para deploy

# Servidor de Webhook para Asaas

Este projeto implementa um servidor para receber webhooks da plataforma Asaas de pagamentos. O servidor processa eventos como pagamentos confirmados, assinaturas criadas/atualizadas/canceladas, e mantém um cache em memória com os dados mais recentes.

## Características

- **Recebimento de webhooks** da plataforma Asaas
- **Persistência de dados** em disco e cache em memória
- **Validação de segurança** com token e IP (opcional)
- **Logs detalhados** usando Winston
- **Endpoints de depuração** para consulta de dados

## Eventos suportados

- `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` - Pagamento confirmado
- `PAYMENT_OVERDUE` - Pagamento em atraso
- `PAYMENT_DELETED` / `PAYMENT_REFUNDED` - Pagamento removido ou estornado
- `SUBSCRIPTION_CREATED` - Assinatura criada
- `SUBSCRIPTION_UPDATED` - Assinatura atualizada
- `SUBSCRIPTION_CANCELLED` - Assinatura cancelada
- `SUBSCRIPTION_EXPIRED` - Assinatura expirada

## Estrutura do projeto

```
├── src/
│   ├── config.js               # Configurações da aplicação
│   ├── webhook-server.js       # Servidor principal de webhook
│   ├── utils/
│   │   ├── api-client.js       # Cliente para API da Asaas
│   │   ├── logger.js           # Sistema de logs
│   │   ├── security.js         # Validação de segurança
│   │   └── storage.js          # Gerenciamento de dados
│   └── data/                   # Diretório para persistência de dados
├── logs/                       # Logs da aplicação
├── package.json
└── README.md
```

## Pré-requisitos

- Node.js 14+
- Conta na plataforma Asaas (produção ou sandbox)

## Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/asaas-webhook-server.git
   cd asaas-webhook-server
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente criando um arquivo `.env`:
   ```
   PORT=3030
   ASAAS_API_KEY=sua_chave_api_asaas
   ASAAS_WEBHOOK_TOKEN=token_seguro_para_validacao
   ASAAS_SANDBOX=true
   LOG_LEVEL=info
   FILE_LOGGING=true
   ```

4. Inicie o servidor:
   ```bash
   npm start
   ```

## Configuração na Asaas

1. Acesse o painel da Asaas (produção ou sandbox)
2. Vá em Configurações > Integrações > Notificações Webhook
3. Adicione um novo webhook com:
   - URL: `http://seu-servidor:3030/api/asaas-webhook`
   - Token: O mesmo configurado em `ASAAS_WEBHOOK_TOKEN`
   - Selecione os eventos que deseja receber

Para mais detalhes, consulte a [documentação oficial da Asaas sobre webhooks](https://asaasdev.atlassian.net/wiki/spaces/API/pages/245465418/Webhooks).

## Endpoints de API

### Webhooks

- **POST** `/api/asaas-webhook` - Endpoint para receber webhooks da Asaas

### Depuração

- **GET** `/debug/events` - Lista os últimos eventos recebidos
- **GET** `/debug/subscription/:id` - Informações de uma assinatura específica
- **GET** `/debug/payment/:id` - Informações de um pagamento específico
- **GET** `/debug/customer/:id/subscriptions` - Lista assinaturas de um cliente
- **GET** `/debug/customer/:id/status` - Verifica status de assinatura de um cliente
- **GET** `/debug/customers/active` - Lista clientes com assinaturas ativas
- **GET** `/debug/stats` - Estatísticas gerais da aplicação

### Health Check

- **GET** `/health` - Verificação de saúde do servidor

## Considerações de segurança

- Utilize HTTPS em produção
- Configure o token de validação para verificar os webhooks
- Considere utilizar validação de IP se a Asaas fornecer uma lista fixa
- Mantenha sua `ASAAS_API_KEY` segura e nunca cometa no repositório

## Testes em ambiente local

Para testar o servidor em ambiente local, você pode usar uma ferramenta como Ngrok para expor sua porta local à internet:

```bash
ngrok http 3030
```

Depois, use a URL fornecida pelo Ngrok para configurar seu webhook na Asaas.

## Desenvolvimento

Para rodar em modo desenvolvimento com reinício automático:

```bash
npm run dev
```

## Suporte e contribuições

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório do projeto. 