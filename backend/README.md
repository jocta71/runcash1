# API REST RunCashH1

Substituto para o servidor WebSocket, utilizando REST API para servir os dados de roletas.

## Requisitos

- Node.js 18+
- Docker
- MongoDB

## Configuração

1. Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```
PORT=3000
NODE_ENV=production
MONGODB_URI=sua_string_de_conexao_mongodb
ALLOWED_ORIGINS=https://seusite.com
```

## Executando localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Iniciar em modo desenvolvimento
npm run dev
```

## Executando com Docker

```bash
# Executar o script de build e execução
chmod +x run_container.sh
./run_container.sh

# OU manualmente
docker build -t runcashh1-api:prod .
docker run -d --name runcashh1-api \
  -p 3000:3000 \
  -e MONGODB_URI="sua_string_de_conexao_mongodb" \
  -e ALLOWED_ORIGINS="https://seusite.com" \
  runcashh1-api:prod
```

## API Endpoints

- `GET /`: Health check
- `GET /status`: Status do servidor e conexão MongoDB
- `GET /numbers`: Obter últimos números da roleta
  - Query params: `limit` (máx 100), `roleta` (filtro por roleta)
- `GET /strategies`: Obter estratégias mais recentes
  - Query params: `roleta` (filtro por roleta)

## Verificação do Container

Se o container estiver com problemas:

```bash
# Verificar logs
docker logs runcashh1-api

# Entrar no container
docker exec -it runcashh1-api /bin/sh

# Listar arquivos no container
docker exec runcashh1-api ls -la /app
```

## Problemas Comuns

1. **Erro "Cannot find module"**: Verifique se o arquivo api_server.js foi copiado corretamente para o container.
2. **Erro de conexão MongoDB**: Verifique a string de conexão e se o MongoDB está acessível.
3. **CORS**: Configure a variável ALLOWED_ORIGINS corretamente. 