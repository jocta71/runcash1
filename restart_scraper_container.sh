#!/bin/bash

# Script para reiniciar o contêiner do scraper
# Este script interrompe o contêiner atual, puxa as últimas alterações e reinicia com as novas configurações

# Configuração de cores para saídas
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  Reiniciando Contêiner do Scraper            ${NC}"
echo -e "${BLUE}===============================================${NC}"

# Verificar se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker não encontrado. Por favor, instale o Docker.${NC}"
    exit 1
fi

# Nome do contêiner
CONTAINER_NAME="runcash_scraper"

# Parar o contêiner se estiver em execução
echo -e "${YELLOW}Verificando status do contêiner...${NC}"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}Parando contêiner existente...${NC}"
    docker stop ${CONTAINER_NAME}
    docker rm ${CONTAINER_NAME}
else
    echo -e "${YELLOW}Nenhum contêiner anterior encontrado.${NC}"
fi

# Criar o contêiner com as novas configurações
echo -e "${GREEN}Criando novo contêiner com banco de dados roletas_db...${NC}"
docker run -d --name ${CONTAINER_NAME} \
    -e MONGODB_URI="mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash" \
    -e MONGODB_DB_NAME="roletas_db" \
    -e MIN_CYCLE_TIME=10 \
    -e MAX_ERRORS=5 \
    -v "$(pwd)/backend/scraper:/app" \
    -v "$(pwd):/workspace" \
    --workdir /workspace \
    python:3.11 bash -c "cd /workspace && pip install -r backend/scraper/requirements.txt && python -m backend.scraper.run_real_scraper"

# Verificar se o contêiner foi iniciado com sucesso
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Contêiner iniciado com sucesso!${NC}"
    echo -e "${YELLOW}Exibindo logs (pressione Ctrl+C para sair):${NC}"
    docker logs -f ${CONTAINER_NAME}
else
    echo -e "${RED}Falha ao iniciar contêiner!${NC}"
    exit 1
fi 