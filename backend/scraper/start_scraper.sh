#!/bin/bash

# Script para iniciar o scraper
# Este script lida com requisitos, ambiente virtual e inicia o scraper com configuração adequada

# Configuração de cores para saídas
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  Iniciando Scraper de Roletas - RunCash      ${NC}"
echo -e "${BLUE}===============================================${NC}"

# Verificar requisitos
echo -e "${YELLOW}Verificando requisitos...${NC}"

# Verificar se python3 está instalado
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 não encontrado. Por favor, instale o Python 3.${NC}"
    exit 1
fi

# Definir variáveis de ambiente
export MONGODB_URI="mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash"
export MONGODB_DB_NAME="roletas_db"  # Modificado para o novo banco de dados
export MIN_CYCLE_TIME=10
export MAX_ERRORS=5
export PYTHONPATH="$(pwd)/..:$(pwd)/../..:$PYTHONPATH"

echo -e "${GREEN}Configurações carregadas:${NC}"
echo -e "  - Banco de dados: ${YELLOW}$MONGODB_DB_NAME${NC}"
echo -e "  - Tempo mínimo entre ciclos: ${YELLOW}$MIN_CYCLE_TIME segundos${NC}"

# Iniciar o scraper
echo -e "${GREEN}Iniciando o scraper...${NC}"
python3 run_real_scraper.py

# Código de saída
exit_code=$?
if [ $exit_code -ne 0 ]; then
    echo -e "${RED}Scraper encerrado com erro (código $exit_code)${NC}"
else
    echo -e "${GREEN}Scraper encerrado normalmente${NC}"
fi

exit $exit_code 