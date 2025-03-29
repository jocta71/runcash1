#!/bin/bash

# Script para iniciar os serviços no Railway
echo "===== RunCash - Iniciando Serviços no Railway ====="

# Configurar variáveis de ambiente
export PORT=${PORT:-5000}
export RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL:-"https://runcash-production.up.railway.app"}
export MONGODB_URI=${MONGODB_URI:-"mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash"}
export MONGODB_DB_NAME=${MONGODB_DB_NAME:-"runcash"}
export MONGODB_ENABLED=${MONGODB_ENABLED:-"true"}
export POLL_INTERVAL=${POLL_INTERVAL:-2000}
export ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-"https://runcash-production.up.railway.app,http://localhost:5173,http://localhost:3000"}

# Criar arquivo .env para o backend
echo "Configurando variáveis de ambiente para o backend..."
cat > backend/.env << EOL
# Configuração do servidor WebSocket
PORT=$PORT

# Configuração do MongoDB
MONGODB_URI=$MONGODB_URI
MONGODB_DB_NAME=$MONGODB_DB_NAME
MONGODB_ENABLED=$MONGODB_ENABLED

# Intervalo de polling (em milissegundos)
POLL_INTERVAL=$POLL_INTERVAL

# Configuração de CORS (separado por vírgulas)
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
EOL

# Configurar .env para o scraper
echo "Configurando variáveis de ambiente para o scraper..."
mkdir -p backend/scraper
cat > backend/scraper/.env << EOL
# Configurações do MongoDB
MONGODB_URI=$MONGODB_URI
MONGODB_DB_NAME=$MONGODB_DB_NAME
MONGODB_ENABLED=$MONGODB_ENABLED

# Configurações do scraper
AMBIENTE_PROD=true

# Configuração do WebSocket
WEBSOCKET_SERVER_URL=$RAILWAY_STATIC_URL/emit-event

# Intervalo de verificação (em segundos)
SCRAPER_INTERVAL=2

# Roletas permitidas (separado por vírgulas)
# Deixar vazio para permitir todas
ALLOWED_ROULETTES=

# Configurações de debug
DEBUG_ROLETAS=false
DEBUG_EXTRACTION=false
DEBUG_LOGS=false
EOL

# Configurar .env para o frontend
echo "Configurando variáveis de ambiente para o frontend..."
cat > .env << EOL
# Configuração do servidor WebSocket
VITE_WS_URL=$RAILWAY_STATIC_URL

# Configuração do servidor SSE (Server-Sent Events)
VITE_SSE_SERVER_URL=$RAILWAY_STATIC_URL/api/events

# URL base da API REST
VITE_API_BASE_URL=$RAILWAY_STATIC_URL/api
EOL

# Iniciar o backend (WebSocket Server)
echo "Iniciando WebSocket Server..."
cd backend
node websocket_server.js 