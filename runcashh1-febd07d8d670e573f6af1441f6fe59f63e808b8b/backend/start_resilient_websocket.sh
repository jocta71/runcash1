#!/bin/bash

# Script para iniciar o serviço de websocket com resiliência
# Compatível com Railway

echo "=== RunCash Websocket Server ==="
echo "Iniciando o serviço de websocket..."

# Verificar a estrutura de diretórios
pwd
ls -la

# Detectar localização do arquivo websocket_server.js
if [ -f "websocket_server.js" ]; then
  WEBSOCKET_FILE="websocket_server.js"
  echo "Arquivo de websocket encontrado no diretório atual"
elif [ -f "../websocket_server.js" ]; then
  WEBSOCKET_FILE="../websocket_server.js"
  echo "Arquivo de websocket encontrado no diretório pai"
elif [ -f "/app/websocket_server.js" ]; then
  WEBSOCKET_FILE="/app/websocket_server.js"
  echo "Arquivo de websocket encontrado no diretório /app"
elif [ -f "/app/backend/websocket_server.js" ]; then
  WEBSOCKET_FILE="/app/backend/websocket_server.js"
  echo "Arquivo de websocket encontrado em /app/backend"
else
  echo "ERRO: Não foi possível encontrar o arquivo websocket_server.js"
  echo "Buscando em todos os diretórios:"
  find / -name "websocket_server.js" -type f 2>/dev/null
  exit 1
fi

echo "Usando arquivo: $WEBSOCKET_FILE"

# Configurar variáveis de ambiente se necessário
if [ -z "$PORT" ]; then
  export PORT=8080
  echo "Porta não definida, usando padrão: $PORT"
fi

# Iniciar o servidor com resiliência
echo "Iniciando o servidor de websocket..."
node "$WEBSOCKET_FILE" 