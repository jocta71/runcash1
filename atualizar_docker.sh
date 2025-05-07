#!/bin/bash

# Script para atualizar o contêiner Docker com as novas modificações

# Cores para o terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "\n${GREEN}=== Script de Atualização do Scraper para Banco Roletas_DB ===${NC}\n"

# Verificar se o ID do contêiner foi fornecido
if [ -z "$1" ]; then
    echo -e "${YELLOW}Uso: $0 <CONTAINER_ID>${NC}"
    echo -e "Você pode obter o ID do contêiner com o comando: ${GREEN}docker ps${NC}"
    
    # Tentar listar contêineres em execução
    echo -e "\n${YELLOW}Contêineres em execução:${NC}"
    docker ps || { echo -e "${RED}Erro ao listar contêineres. Verifique se o Docker está em execução.${NC}"; exit 1; }
    exit 1
fi

CONTAINER_ID=$1
echo -e "${GREEN}Atualizando contêiner: ${YELLOW}$CONTAINER_ID${NC}\n"

# Verificar se o contêiner existe
echo -e "${GREEN}Verificando se o contêiner existe...${NC}"
docker inspect $CONTAINER_ID > /dev/null 2>&1 || { echo -e "${RED}Contêiner não encontrado. Verifique o ID e tente novamente.${NC}"; exit 1; }
echo -e "${GREEN}✓ Contêiner encontrado!${NC}\n"

# Criar backup dos arquivos originais
echo -e "${GREEN}Criando backup dos arquivos originais...${NC}"
mkdir -p backup
docker cp $CONTAINER_ID:/app/backend/scraper/data_source_mongo.py backup/ || echo -e "${YELLOW}⚠️ Não foi possível criar backup de data_source_mongo.py${NC}"
docker cp $CONTAINER_ID:/app/backend/scraper/mongo_config.py backup/ || echo -e "${YELLOW}⚠️ Não foi possível criar backup de mongo_config.py${NC}"
docker cp $CONTAINER_ID:/app/backend/scraper/run_real_scraper.py backup/ || echo -e "${YELLOW}⚠️ Não foi possível criar backup de run_real_scraper.py${NC}"
echo -e "${GREEN}✓ Backup criado em ./backup${NC}\n"

# Copiar os arquivos modificados para o contêiner
echo -e "${GREEN}Copiando arquivos modificados para o contêiner...${NC}"
docker cp backend/scraper/data_source_mongo.py $CONTAINER_ID:/app/backend/scraper/ || { echo -e "${RED}Erro ao copiar data_source_mongo.py${NC}"; exit 1; }
docker cp backend/scraper/mongo_config.py $CONTAINER_ID:/app/backend/scraper/ || { echo -e "${RED}Erro ao copiar mongo_config.py${NC}"; exit 1; }
docker cp backend/scraper/run_real_scraper.py $CONTAINER_ID:/app/backend/scraper/ || { echo -e "${RED}Erro ao copiar run_real_scraper.py${NC}"; exit 1; }
echo -e "${GREEN}✓ Arquivos modificados copiados com sucesso!${NC}\n"

# Configurar variável de ambiente
echo -e "${GREEN}Configurando variável de ambiente...${NC}"
docker exec $CONTAINER_ID bash -c 'echo "export ROLETAS_MONGODB_DB_NAME=roletas_db" >> /etc/environment' || echo -e "${YELLOW}⚠️ Não foi possível definir variável de ambiente permanente${NC}"
docker exec $CONTAINER_ID bash -c 'export ROLETAS_MONGODB_DB_NAME=roletas_db' || echo -e "${YELLOW}⚠️ Não foi possível definir variável de ambiente temporária${NC}"
echo -e "${GREEN}✓ Variável de ambiente configurada!${NC}\n"

# Verificar permissões dos arquivos
echo -e "${GREEN}Verificando permissões dos arquivos...${NC}"
docker exec $CONTAINER_ID chmod +x /app/backend/scraper/run_real_scraper.py || echo -e "${YELLOW}⚠️ Não foi possível alterar permissões de run_real_scraper.py${NC}"
echo -e "${GREEN}✓ Permissões verificadas!${NC}\n"

# Reiniciar o contêiner
echo -e "${GREEN}Reiniciando o contêiner...${NC}"
docker restart $CONTAINER_ID || { echo -e "${RED}Erro ao reiniciar o contêiner${NC}"; exit 1; }
echo -e "${GREEN}✓ Contêiner reiniciado com sucesso!${NC}\n"

# Aguardar alguns segundos para o contêiner inicializar
echo -e "${GREEN}Aguardando inicialização do contêiner...${NC}"
sleep 10

# Verificar logs
echo -e "${GREEN}Verificando logs do contêiner...${NC}"
docker logs --tail 20 $CONTAINER_ID || { echo -e "${RED}Erro ao obter logs do contêiner${NC}"; exit 1; }

echo -e "\n${GREEN}=== Atualização concluída! ===${NC}"
echo -e "Verifique os logs acima para confirmar que o scraper está usando o banco de dados ${YELLOW}roletas_db${NC}"
echo -e "Procure por mensagens como: ${YELLOW}\"Usando banco de dados: roletas_db\"${NC} ou ${YELLOW}\"Usando modelo otimizado com coleções específicas por roleta\"${NC}\n"
echo -e "${GREEN}Se algo der errado, você pode restaurar os arquivos originais com os comandos:${NC}"
echo -e "docker cp backup/data_source_mongo.py $CONTAINER_ID:/app/backend/scraper/"
echo -e "docker cp backup/mongo_config.py $CONTAINER_ID:/app/backend/scraper/"
echo -e "docker cp backup/run_real_scraper.py $CONTAINER_ID:/app/backend/scraper/"
echo -e "docker restart $CONTAINER_ID\n" 