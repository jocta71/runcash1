# Barra de IA RunCash

## Sobre o recurso

A barra de IA RunCash é uma interface flutuante que permite aos usuários fazer perguntas e receber análises inteligentes sobre dados de roletas diretamente na interface do RunCash. Este componente utiliza a API Gemini da Google para processamento de linguagem natural e análise de dados.

## Configuração

### 1. Obtenha uma chave de API do Gemini

1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crie uma conta ou faça login com sua conta Google
3. Clique em "Get API Key" para criar uma nova chave
4. Copie a chave gerada

### 2. Configure seu ambiente

1. No diretório `frontend`, crie um arquivo `.env` baseado no `.env.example`
2. Adicione sua chave API Gemini:
   ```
   REACT_APP_GEMINI_API_KEY=sua-chave-api-aqui
   ```

Alternativamente, você pode adicionar sua chave API através da interface de administração do RunCash, em Config > API Keys.

## Funcionalidades

- Barra flutuante minimizável na parte inferior da tela
- Histórico de conversas durante a sessão
- Processamento de perguntas em linguagem natural
- Análise inteligente dos dados de roletas em tempo real
- Formatação visual das respostas para melhor legibilidade

## Exemplos de perguntas

A IA RunCash pode responder perguntas como:

- Quais são os números quentes nas últimas 50 rodadas?
- Qual roleta tem mais números vermelhos hoje?
- Qual é a tendência atual da Lightning Roulette?
- Qual roleta teve mais zeros nas últimas 100 rodadas?
- Qual é o padrão atual de cores na Speed Auto Roulette?

## Solução de problemas

Se você estiver enfrentando problemas com a barra de IA:

1. Verifique se sua chave API é válida e está ativa
2. Confirme que a variável de ambiente está configurada corretamente
3. Verifique a conexão com a internet
4. Limpe o cache do navegador e recarregue a página

Para problemas persistentes, entre em contato com o suporte. 