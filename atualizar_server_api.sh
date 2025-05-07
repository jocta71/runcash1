#!/bin/bash

# Script para atualizar o servidor de API para usar o banco de dados roletas_db

# Cores para o terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "\n${GREEN}=== Script de Atualização do Servidor API para Banco Roletas_DB ===${NC}\n"

# Verificar se o servidor está hospedado no Railway
echo -e "${GREEN}Este script irá atualizar o serviço de API para usar o banco roletas_db${NC}"
echo -e "${YELLOW}IMPORTANTE: Este script deve ser executado na máquina onde está o código-fonte que será enviado ao Railway${NC}"
echo -e "Por favor, confirme que você está no diretório correto com o código da API."

read -p "Continuar com a atualização? (s/n): " continuar
if [[ "$continuar" != "s" && "$continuar" != "S" ]]; then
    echo -e "${RED}Operação cancelada pelo usuário.${NC}"
    exit 1
fi

# Verificar se o railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}A CLI do Railway não está instalada. Tentando instalar...${NC}"
    npm install -g @railway/cli
    
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}Erro ao instalar Railway CLI. Por favor, instale manualmente:${NC}"
        echo -e "npm install -g @railway/cli"
        exit 1
    fi
    
    echo -e "${GREEN}Railway CLI instalado com sucesso!${NC}"
fi

# Verificar se o usuário está autenticado no Railway
echo -e "${GREEN}Verificando autenticação no Railway...${NC}"
railway whoami || {
    echo -e "${YELLOW}Você precisa fazer login no Railway para continuar.${NC}"
    railway login
}

# Backup dos arquivos que serão modificados
echo -e "${GREEN}Criando backup dos arquivos...${NC}"
mkdir -p backup/backend/services
cp backend/services/rouletteDataService.js backup/backend/services/ || {
    echo -e "${RED}Erro ao fazer backup dos arquivos. Verifique o caminho.${NC}"
    exit 1
}

echo -e "${GREEN}Backup criado em ./backup${NC}"

# Verificar se o serviço Railway já tem a variável de ambiente
echo -e "${GREEN}Verificando se o projeto Railway já tem a variável ROLETAS_MONGODB_DB_NAME...${NC}"

# Perguntar qual é o projeto Railway
echo -e "${YELLOW}Digite o nome do seu projeto no Railway (deixe em branco para selecionar interativamente):${NC}"
read projeto_railway

if [ -z "$projeto_railway" ]; then
    echo -e "${GREEN}Listando projetos disponíveis...${NC}"
    railway projects
    
    echo -e "${YELLOW}Selecione o projeto Railway onde a API está hospedada:${NC}"
    railway link
else
    railway link --project "$projeto_railway"
fi

# Configurar a variável de ambiente no Railway
echo -e "${GREEN}Configurando a variável de ambiente ROLETAS_MONGODB_DB_NAME=roletas_db no Railway...${NC}"
railway variables set ROLETAS_MONGODB_DB_NAME=roletas_db || {
    echo -e "${RED}Erro ao configurar variável de ambiente. Verifique suas permissões.${NC}"
    exit 1
}

echo -e "${GREEN}Variável de ambiente configurada com sucesso!${NC}"

# Fazer deploy para o Railway
echo -e "${GREEN}Realizando deploy para o Railway...${NC}"
echo -e "${YELLOW}Isto pode levar alguns minutos...${NC}"

railway up || {
    echo -e "${RED}Erro ao fazer deploy para o Railway.${NC}"
    exit 1
}

echo -e "\n${GREEN}=== Atualização concluída! ===${NC}"
echo -e "${GREEN}O servidor de API agora está configurado para usar o banco de dados ${YELLOW}roletas_db${NC}"
echo -e "${YELLOW}Verificações a fazer:${NC}"
echo -e "1. Verifique os logs do serviço no Railway para confirmar que está conectando ao banco correto"
echo -e "2. Teste a API para verificar se os dados das roletas estão sendo retornados corretamente"
echo -e "3. Caso ocorra algum problema, você pode restaurar o backup com: ${GREEN}cp backup/backend/services/rouletteDataService.js backend/services/${NC}\n"

# Verificar se o usuário quer ver os logs
read -p "Deseja monitorar os logs do serviço no Railway? (s/n): " ver_logs
if [[ "$ver_logs" == "s" || "$ver_logs" == "S" ]]; then
    echo -e "${GREEN}Mostrando logs do serviço...${NC}"
    railway logs
else
    echo -e "${GREEN}Para ver os logs posteriormente, execute: ${YELLOW}railway logs${NC}"
fi 