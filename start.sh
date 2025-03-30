#!/bin/bash

# Script para iniciar os serviços no Railway
echo "===== RunCash - Iniciando Serviços no Railway ====="

# Instalar pacotes críticos diretamente antes de iniciar
pip3 install --no-cache-dir requests selenium webdriver-manager pymongo python-dotenv

# Imprimir informações do ambiente Python para diagnóstico
echo "PATH: $PATH"
echo "PYTHONPATH: $PYTHONPATH"
which python3
python3 -c "import sys; print('Python sys.path:'); print('\n'.join(sys.path))"
python3 -c "import site; print('Python site-packages:'); print(site.getsitepackages())"

# Configurar variáveis de ambiente
export PORT=${PORT:-5000}
export RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL}
export MONGODB_URI=${MONGODB_URI:-""}
export MONGODB_DB_NAME=${MONGODB_DB_NAME}
export MONGODB_ENABLED=${MONGODB_ENABLED}
export POLL_INTERVAL=${POLL_INTERVAL}
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

# Função para encerrar processos ao finalizar o script
cleanup() {
    echo "Encerrando serviços..."
    kill $WEBSOCKET_PID 2>/dev/null
    kill $SCRAPER_PID 2>/dev/null
    exit
}

# Configurar trap para limpeza ao sair
# Usando formato mais compatível para evitar 'bad trap' em diferentes shells
trap 'cleanup' INT TERM

# Iniciar o backend (WebSocket Server) em segundo plano
echo "Iniciando WebSocket Server..."
cd backend
node websocket_server.js > websocket.log 2>&1 &
WEBSOCKET_PID=$!
cd ..

# Verificar se o WebSocket Server está rodando
sleep 5
if ! ps -p $WEBSOCKET_PID > /dev/null; then
    echo "ERRO: WebSocket Server falhou ao iniciar. Verificando logs:"
    cat backend/websocket.log
    exit 1
fi

echo "WebSocket Server iniciado com PID: $WEBSOCKET_PID"

# Aguardar o WebSocket Server inicializar completamente
sleep 5

# Iniciar o scraper resiliente em segundo plano
echo "Iniciando Scraper Direto (run_real_scraper.py)..."
cd backend
echo "Mudando para diretório de scraper..."
cd scraper
PYTHONPATH=/usr/local/lib/python3.10/dist-packages:/app/backend/scraper python3 run_real_scraper.py &
SCRAPER_PID=$!
cd ../..

# Verificar se o Scraper está rodando
sleep 5
if ! ps -p $SCRAPER_PID > /dev/null; then
    echo "ERRO: Scraper falhou ao iniciar."
    exit 1
fi

echo "Scraper iniciado com PID: $SCRAPER_PID"

echo "===== Todos os serviços iniciados com sucesso! ====="
echo "WebSocket Server rodando em: $RAILWAY_STATIC_URL"
echo "WebSocket PID: $WEBSOCKET_PID"
echo "Scraper PID: $SCRAPER_PID"

# Manter o script em execução para permitir que os processos em segundo plano continuem rodando
# Railway precisa que o processo principal continue em execução
while true; do
    sleep 60
    
    # Verificar se os processos continuam rodando
    if ! ps -p $WEBSOCKET_PID > /dev/null; then
        echo "AVISO: WebSocket Server parou. Tentando reiniciar..."
        cd backend
        node websocket_server.js > websocket.log 2>&1 &
        WEBSOCKET_PID=$!
        cd ..
    fi
    
    if ! ps -p $SCRAPER_PID > /dev/null; then
        echo "AVISO: Scraper parou. Tentando reiniciar..."
        cd backend/scraper
        PYTHONPATH=/usr/local/lib/python3.10/dist-packages:/app/backend/scraper python3 run_real_scraper.py &
        SCRAPER_PID=$!
        cd ../..
    fi
done