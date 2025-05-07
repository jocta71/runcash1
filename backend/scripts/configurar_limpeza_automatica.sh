#!/bin/bash

# Script para configurar uma tarefa cron de limpeza automática de coleções UUID
#
# Este script configura uma tarefa cron para executar automaticamente
# a limpeza de coleções UUID do banco de dados MongoDB todos os dias à 1h da manhã.

echo "====================================================="
echo "CONFIGURAÇÃO DE LIMPEZA AUTOMÁTICA DE COLEÇÕES UUID"
echo "====================================================="
echo ""

# Obter o diretório absoluto do projeto
BACKEND_DIR=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT_PATH="$BACKEND_DIR/scripts/remover_colecoes_uuid.sh"

# Verificar se o script existe
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "Erro: Script de limpeza não encontrado em $SCRIPT_PATH"
    exit 1
fi

# Tornar o script executável
chmod +x "$SCRIPT_PATH"

# Verificar variáveis de ambiente
MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017/"}
ROLETAS_MONGODB_DB_NAME=${ROLETAS_MONGODB_DB_NAME:-"roletas_db"}

echo "As seguintes variáveis de ambiente serão usadas na tarefa cron:"
echo "MONGODB_URI=$MONGODB_URI"
echo "ROLETAS_MONGODB_DB_NAME=$ROLETAS_MONGODB_DB_NAME"
echo ""

# Criar arquivo temporário para a tarefa cron
TEMP_CRON=$(mktemp)

# Escrever tarefa cron atual
crontab -l > "$TEMP_CRON" 2>/dev/null || echo "# Tarefas cron para limpeza de coleções UUID" > "$TEMP_CRON"

# Verificar se a tarefa já existe
if grep -q "remover_colecoes_uuid.sh" "$TEMP_CRON"; then
    echo "Uma tarefa cron para limpeza de coleções UUID já existe."
    echo "Deseja substituí-la? (s/n)"
    read -r resposta
    
    if [[ "$resposta" != "s" ]]; then
        echo "Operação cancelada."
        rm "$TEMP_CRON"
        exit 0
    fi
    
    # Remover tarefa existente
    grep -v "remover_colecoes_uuid.sh" "$TEMP_CRON" > "${TEMP_CRON}.new"
    mv "${TEMP_CRON}.new" "$TEMP_CRON"
    echo "Tarefa anterior removida."
fi

# Adicionar nova tarefa cron (executa todos os dias à 1h da manhã)
echo "# Limpeza automática de coleções UUID do MongoDB (adicionado em $(date))" >> "$TEMP_CRON"
echo "0 1 * * * MONGODB_URI=\"$MONGODB_URI\" ROLETAS_MONGODB_DB_NAME=\"$ROLETAS_MONGODB_DB_NAME\" $SCRIPT_PATH --auto >> $BACKEND_DIR/logs/limpeza_uuid_$(date +\%Y\%m\%d).log 2>&1" >> "$TEMP_CRON"

# Aplicar nova configuração cron
crontab "$TEMP_CRON"

# Remover arquivo temporário
rm "$TEMP_CRON"

echo "Tarefa cron configurada com sucesso!"
echo "A limpeza automática será executada todos os dias à 1h da manhã."
echo ""
echo "Para verificar a configuração, execute: crontab -l"
echo ""

# Criar diretório de logs se não existir
mkdir -p "$BACKEND_DIR/logs"

echo "Configuração concluída." 