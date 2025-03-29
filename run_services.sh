#!/bin/bash

# Script para executar serviços do RunCash com localtunnel
# Autor: RunCash Team

echo "===== RunCash - Iniciando Serviços ====="
echo "Configurando ambiente e iniciando serviços..."

# Diretório principal
RUNCASH_DIR=/root/runcash1

# Configurar variáveis de ambiente MongoDB
export MONGODB_URI="mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash"
export MONGODB_DB_NAME="runcash"
export MONGODB_ENABLED=true

# Criar diretórios se necessário
mkdir -p $RUNCASH_DIR/backend
mkdir -p $RUNCASH_DIR/backend/scraper

# Configurar URL do websocket no .env
echo "Configurando variáveis de ambiente..."
cat > $RUNCASH_DIR/backend/.env << EOL
# Configuração do servidor WebSocket
PORT=5000

# Configuração do MongoDB
MONGODB_URI=mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash
MONGODB_DB_NAME=runcash
MONGODB_ENABLED=true

# Intervalo de polling (em milissegundos)
POLL_INTERVAL=2000

# Configuração de CORS (separado por vírgulas)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://runcash-vercel.vercel.app,https://black-starfish-12.loca.lt
EOL

# Configurar .env para o scraper
cat > $RUNCASH_DIR/backend/scraper/.env << EOL
# Configurações do MongoDB
MONGODB_URI=mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash
MONGODB_DB_NAME=runcash
MONGODB_ENABLED=true

# Configurações do scraper
AMBIENTE_PROD=true

# Configuração do WebSocket
WEBSOCKET_SERVER_URL=http://localhost:5000/emit-event

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

# Função para encerrar todos os processos ao finalizar o script
cleanup() {
    echo "Encerrando serviços..."
    kill $WEBSOCKET_PID 2>/dev/null
    kill $LOCALTUNNEL_PID 2>/dev/null
    kill $SCRAPER_PID 2>/dev/null
    exit
}

# Configurar trap para limpeza ao sair
trap cleanup SIGINT SIGTERM

# Iniciar o WebSocket Server
echo "Iniciando WebSocket Server na porta 5000..."
cd $RUNCASH_DIR/backend
node websocket_server.js > websocket.log 2>&1 &
WEBSOCKET_PID=$!
echo "WebSocket Server iniciado com PID: $WEBSOCKET_PID"

# Aguardar o WebSocket Server iniciar
sleep 5

# Verificar se o WebSocket Server está rodando
if ! ps -p $WEBSOCKET_PID > /dev/null; then
    echo "ERRO: WebSocket Server falhou ao iniciar. Verifique o arquivo websocket.log"
    cat websocket.log
    exit 1
fi

# Iniciar o localtunnel para o WebSocket Server
echo "Iniciando localtunnel para WebSocket Server..."
lt --port 5000 --subdomain black-starfish-12 > localtunnel.log 2>&1 &
LOCALTUNNEL_PID=$!
echo "LocalTunnel iniciado com PID: $LOCALTUNNEL_PID"

# Aguardar o localtunnel iniciar
sleep 5

# Verificar se o localtunnel está rodando
if ! ps -p $LOCALTUNNEL_PID > /dev/null; then
    echo "ERRO: LocalTunnel falhou ao iniciar. Verifique o arquivo localtunnel.log"
    cat localtunnel.log
    exit 1
fi

# Atualizar a URL do WebSocket para o scraper usar o localtunnel
sed -i "s|WEBSOCKET_SERVER_URL=http://localhost:5000/emit-event|WEBSOCKET_SERVER_URL=https://black-starfish-12.loca.lt/emit-event|g" $RUNCASH_DIR/backend/scraper/.env

# Iniciar o ambiente virtual Python
echo "Ativando ambiente virtual Python..."
source $RUNCASH_DIR/venv/bin/activate

# Iniciar o scraper
echo "Iniciando scraper..."
cd $RUNCASH_DIR/backend/scraper
python3 run_real_scraper.py > scraper.log 2>&1 &
SCRAPER_PID=$!
echo "Scraper iniciado com PID: $SCRAPER_PID"

# Aguardar o scraper iniciar
sleep 5

# Verificar se o scraper está rodando
if ! ps -p $SCRAPER_PID > /dev/null; then
    echo "ERRO: Scraper falhou ao iniciar. Verifique o arquivo scraper.log"
    cat scraper.log
    exit 1
fi

echo ""
echo "===== SERVIÇOS INICIADOS COM SUCESSO ====="
echo "WebSocket Server: https://black-starfish-12.loca.lt"
echo "WebSocket PID: $WEBSOCKET_PID"
echo "LocalTunnel PID: $LOCALTUNNEL_PID"
echo "Scraper PID: $SCRAPER_PID"
echo ""
echo "Logs:"
echo "- WebSocket: $RUNCASH_DIR/backend/websocket.log"
echo "- LocalTunnel: $RUNCASH_DIR/backend/localtunnel.log"
echo "- Scraper: $RUNCASH_DIR/backend/scraper/scraper.log"
echo ""
echo "Pressione Ctrl+C para encerrar todos os serviços"

# Manter o script rodando
while true; do
    sleep 60
    
    # Verificar se os processos continuam rodando
    if ! ps -p $WEBSOCKET_PID > /dev/null; then
        echo "AVISO: WebSocket Server parou. Verificando logs..."
        tail -n 20 $RUNCASH_DIR/backend/websocket.log
    fi
    
    if ! ps -p $LOCALTUNNEL_PID > /dev/null; then
        echo "AVISO: LocalTunnel parou. Verificando logs..."
        tail -n 20 $RUNCASH_DIR/backend/localtunnel.log
    fi
    
    if ! ps -p $SCRAPER_PID > /dev/null; then
        echo "AVISO: Scraper parou. Verificando logs..."
        tail -n 20 $RUNCASH_DIR/backend/scraper/scraper.log
    fi
done 