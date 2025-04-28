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

# Restrição de Acesso a Dados de Roletas para Assinantes PRO e Premium

Este documento descreve as modificações feitas para restringir o acesso aos dados da API de roletas apenas para usuários com assinaturas pagas PRO ou Premium.

## Alterações Realizadas

### Backend (Railway)

1. **Modificado middleware de autenticação**:
   - Atualizamos a rota `/api/roulettes` em `backend/routes/rouletteRoutes.js` para exigir assinatura PRO ou PREMIUM
   - Adicionamos o middleware `requireResourceAccess('unlimited_roulettes')` para verificar o acesso específico a esse recurso
   - Alteramos a documentação da rota para indicar que é uma rota privada com acesso restrito

### Frontend (Vercel)

1. **Tratamento de Erros de Assinatura**:
   - Implementado no `rouletteApi.ts` para detectar erros 403 relacionados a restrições de assinatura
   - Criada uma classe personalizada `SubscriptionRequiredError` no repositório de roletas para melhor tratamento de erro
   - Propagação do erro de assinatura através da cadeia de chamadas API → Repository → Component

2. **Interface de Usuário**:
   - Adicionado estado `subscriptionError` para controlar a exibição da mensagem de erro de assinatura
   - Criado um componente para mostrar mensagem informativa quando o usuário não possui assinatura adequada
   - Adicionado botão para upgrade de plano quando o acesso é negado

## Como Funciona

1. Quando um usuário sem assinatura PRO ou PREMIUM tenta acessar a lista de roletas:
   - O backend retorna um erro 403 com código `PLAN_UPGRADE_REQUIRED`
   - O frontend captura esse erro e exibe uma mensagem amigável explicando a necessidade de upgrade
   - É apresentado um botão para o usuário fazer upgrade da assinatura

2. Usuários com assinatura PRO ou PREMIUM:
   - Têm acesso completo a todas as roletas em tempo real
   - Podem visualizar todas as estatísticas disponíveis

## Planos Disponíveis

- **FREE**: Acesso apenas a funcionalidades básicas e preview de roletas
- **BASIC**: Acesso limitado a estatísticas padrão e visualização de até 15 roletas
- **PRO**: Acesso a todas as roletas com atualização em tempo real
- **PREMIUM**: Acesso completo a todas as funcionalidades, incluindo dados históricos e predições de IA

## Manutenção e Suporte

Para dúvidas ou problemas relacionados à implementação da restrição de acesso:

1. Verifique os logs do servidor no Railway para erros de autenticação
2. Verifique os logs do cliente no console do navegador para erros de API
3. Teste o fluxo de upgrade de assinatura para garantir que funciona corretamente

## Testes 

É recomendado testar os seguintes cenários:

1. Acesso sem login - deve mostrar mensagem para fazer login
2. Acesso com assinatura FREE - deve mostrar mensagem para fazer upgrade
3. Acesso com assinatura BASIC - deve mostrar mensagem para fazer upgrade
4. Acesso com assinatura PRO - deve mostrar todas as roletas normalmente
5. Acesso com assinatura PREMIUM - deve mostrar todas as roletas normalmente 