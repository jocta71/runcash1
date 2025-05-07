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

# Estratégia de Terminais para Roleta

Este projeto implementa a estratégia de terminais para roletas, baseada nas regras oficiais do RunCash. O sistema utiliza uma máquina de estados para acompanhar os resultados da roleta e fazer sugestões de apostas baseadas nos padrões de terminais.

## Funcionamento

A estratégia de terminais é baseada na tabela oficial de terminais do RunCash, onde cada número da roleta (0-36) possui um conjunto de números "terminais" associados. Quando um número aparece, ele se torna um "gatilho" e sugere-se apostar nos seus números terminais.

### Estados da Estratégia

A estratégia utiliza quatro estados principais:

1. **NEUTRAL**: Estado inicial. Ao receber um número, ele se torna o gatilho.
2. **TRIGGER**: Um gatilho foi estabelecido. Espera-se que o próximo número esteja entre os terminais do gatilho.
3. **POST_GALE_NEUTRAL**: O número não estava nos terminais do gatilho. Dá uma segunda chance apostando nos terminais do mesmo gatilho.
4. **MORTO**: Ciclo completo, reinicia para NEUTRAL no próximo número.

## Instalação

### Windows (PowerShell)

1. Execute o script de instalação:
   ```
   .\instalar_estrategia_terminal.ps1
   ```

2. O script irá:
   - Verificar se o Python está instalado
   - Criar um ambiente virtual
   - Instalar as dependências necessárias
   - Criar um arquivo batch para facilitar a execução

## Uso

### Executar a Estratégia

Use um dos seguintes métodos:

1. **Usando o arquivo batch**:
   ```
   .\executar_estrategia_terminal.bat
   ```

2. **Usando PowerShell**:
   ```
   .\terminal_env\Scripts\Activate.ps1
   python roulette_terminal_strategy.py
   ```

### Funcionalidades

Ao iniciar, você pode:

1. **Carregar dados do MongoDB**: Conecta-se ao MongoDB e importa dados de resultados da roleta.
2. **Inserir dados manualmente**: Digite os números manualmente para análise.

### Menu Interativo

O sistema oferece um menu com as seguintes opções:

1. **Ver análise e sugestões**: Mostra a análise completa da estratégia, incluindo o estado atual, números de gatilho e sugestões de apostas.
2. **Adicionar novo número**: Adiciona um novo resultado da roleta e atualiza o estado.
3. **Simulação com novos números**: Permite simular a estratégia com uma sequência de números.
4. **Resetar estratégia**: Reinicia a estratégia para o estado inicial.
5. **Sair**: Encerra o programa.

## Tabela de Terminais

A tabela de terminais oficial do RunCash está implementada no sistema e define as relações entre cada número e seus terminais correspondentes.

## Análise de Resultados

O sistema mantém um histórico de resultados, mostrando:
- Taxa de acerto da estratégia
- Vitórias e derrotas
- Estado atual da estratégia
- Números sugeridos para apostas

## Simulações

A funcionalidade de simulação permite testar a estratégia com uma sequência de números, mostrando passo a passo como o estado evolui e o resultado de cada etapa da estratégia.

## Requisitos

- Python 3.6 ou superior
- pymongo
- art (para exibição visual) 