#!/bin/bash

echo "=========================================="
echo "RunCash Startup Script - Version 1.2"
echo "=========================================="
date

# Modo de diagnóstico do WebSocket
export WEBSOCKET_DEBUG=true
export WEBSOCKET_HEARTBEAT=15000
export WEBSOCKET_RECONNECTION_DELAY=5000

# Verificar serviços
echo "Verificando configuração do MongoDB..."
node backend/check_mongodb_connection.js

# Verificar a conexão com o MongoDB Python
echo "Verificando MongoDB do Python..."
cd backend/scraper
python check_mongo_config.py
cd ../..

# Iniciar o servidor WebSocket em background
echo "Iniciando servidor WebSocket..."
node backend/websocket_server.js &
WEBSOCKET_PID=$!
echo "Servidor WebSocket iniciado com PID: $WEBSOCKET_PID"

# Esperar um pouco para garantir que o WebSocket esteja funcionando
sleep 5

# Verificar se o processo do WebSocket ainda está rodando
if ps -p $WEBSOCKET_PID > /dev/null; then
    echo "Servidor WebSocket está rodando corretamente."
else
    echo "ERRO: Servidor WebSocket falhou ao iniciar!"
    # Tentar iniciar novamente com mais diagnósticos
    echo "Tentando iniciar novamente com diagnósticos..."
    DEBUG=* DEBUG_COLORS=true node backend/websocket_server.js &
    WEBSOCKET_PID=$!
fi

# Iniciar o servidor API
echo "Iniciando servidor API..."
node backend/api/index.js

# Essa parte só será executada se o servidor API parar
echo "Servidor API encerrado, terminando processo WebSocket se ainda estiver rodando..."
kill -9 $WEBSOCKET_PID 2>/dev/null || true