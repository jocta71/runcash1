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