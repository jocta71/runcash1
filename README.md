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

# API de Roletas

API para acesso a dados de roletas, com sistema de autenticação JWT e verificação de assinatura no Asaas.

## Estrutura da API

A API implementa dois níveis de acesso:

1. **Dados Simulados**: Acessíveis a todos os usuários, sem necessidade de autenticação.
2. **Dados Reais**: Requerem autenticação JWT e assinatura premium ativa no Asaas.

## Endpoints Disponíveis

### Públicos (Dados Simulados)

- `GET /api/roletas` - Lista todas as roletas com dados simulados
- `GET /api/roletas/:id` - Obtém dados simulados de uma roleta específica

### Protegidos (Dados Reais - Requer Assinatura Premium)

- `GET /api/roletas/premium/todas` - Lista todas as roletas com dados reais
- `GET /api/roletas/premium/:id/historico` - Obtém histórico completo de uma roleta

## Autenticação

A API utiliza autenticação via token JWT:

```
Authorization: Bearer <seu_token_jwt>
```

O token JWT deve conter:
- `id`: ID do usuário
- `email`: Email do usuário
- `asaasCustomerId`: ID do cliente no Asaas

## Verificação de Assinatura

Para acessar endpoints protegidos, além do token JWT válido, o usuário deve possuir assinatura premium ativa no Asaas.

O sistema consulta a API do Asaas para verificar:
1. Se o cliente existe no Asaas
2. Se possui alguma assinatura com status "ACTIVE"
3. Se a assinatura é do tipo premium/PRO

## Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
PORT=3000
NODE_ENV=development
JWT_SECRET=seu_segredo_super_secreto
ASAAS_API_KEY=sua_chave_api_asaas
ASAAS_API_URL=https://api.asaas.com/v3
```

## Instalação e Execução

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Iniciar servidor de produção
npm start
```

## Respostas da API

### Sucesso

```json
{
  "success": true,
  "message": "Descrição do sucesso",
  "data": { ... }
}
```

### Erro

```json
{
  "success": false,
  "message": "Descrição do erro",
  "error": "CODIGO_ERRO"
}
```

## Erros de Autenticação e Assinatura

- `401` - Token ausente, inválido ou expirado
- `403` - Usuário sem assinatura cadastrada ou assinatura inativa

## Solução de Problemas

### Erro "Não foi possível verificar seu status de assinatura"

Se você estiver vendo a mensagem "Não foi possível verificar seu status de assinatura" no banner de assinatura, siga estas etapas:

1. **Verifique a configuração do Asaas**:
   - Certifique-se de que sua chave API do Asaas está configurada no arquivo `.env`
   - Use o script `node verificar-asaas.js` para diagnosticar problemas com a configuração

2. **Verifique a conexão com a internet**:
   - O sistema precisa se comunicar com a API do Asaas para verificar assinaturas

3. **Verifique os logs do servidor**:
   - Procure erros relacionados à verificação de assinaturas nos logs do servidor

4. **Configuração do arquivo .env**:
   - Certifique-se de que as seguintes variáveis estão configuradas:
     ```
     ASAAS_API_KEY=sua-chave-api-asaas-aqui
     ASAAS_API_URL=https://www.asaas.com/api/v3
     JWT_SECRET=sua-chave-jwt-secreta-aqui
     ```

O sistema continuará funcionando mesmo sem verificar sua assinatura, mas mostrará apenas dados simulados. 