# Deploy no Railway

Este guia contém instruções para realizar o deploy da aplicação RunCash no Railway.

## Pré-requisitos

1. Conta no [Railway](https://railway.app/)
2. Repositório Git com o código da aplicação

## Passos para o Deployment

### 1. Configuração inicial no Railway

1. Faça login no Railway usando sua conta
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Conecte sua conta GitHub e selecione o repositório do RunCash
5. Clique em "Deploy Now"

### 2. Variáveis de Ambiente

Configure as seguintes variáveis de ambiente no Railway:

- `PORT`: porta na qual o servidor irá rodar (padrão: 5000)
- `RAILWAY_STATIC_URL`: URL pública da sua aplicação no Railway (ex: https://runcash-production.up.railway.app)
- `MONGODB_URI`: String de conexão com o MongoDB
- `MONGODB_DB_NAME`: Nome do banco de dados MongoDB (padrão: runcash)
- `MONGODB_ENABLED`: Habilita o uso do MongoDB (padrão: true)
- `POLL_INTERVAL`: Intervalo de polling em milissegundos (padrão: 2000)
- `ALLOWED_ORIGINS`: Lista de origens permitidas para CORS, separadas por vírgula

### 3. Monitoramento e Logs

Após o deploy, você pode monitorar os logs da aplicação diretamente no painel do Railway para verificar o status e solucionar problemas.

### 4. Atualização da Aplicação

Para atualizar a aplicação, basta fazer push de novas alterações para o repositório Git. O Railway detectará automaticamente as mudanças e iniciará um novo deploy.

## Estrutura de Arquivos para o Railway

Os seguintes arquivos foram configurados para o deploy no Railway:

- `railway.toml`: Configuração principal do Railway
- `nixpacks.toml`: Configuração do ambiente de build e runtime
- `Procfile`: Define o comando de inicialização
- `start.sh`: Script que inicializa e configura os serviços

## Solução de Problemas

Se encontrar problemas durante o deploy:

1. Verifique os logs no painel do Railway
2. Confirme se todas as variáveis de ambiente foram configuradas corretamente
3. Verifique se o MongoDB está acessível e configurado corretamente 