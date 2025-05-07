#!/bin/bash

# Script para executar o utilitário de remoção de coleções UUID
# 
# Uso:
#   ./remover_colecoes_uuid.sh        # Modo interativo
#   ./remover_colecoes_uuid.sh --auto # Modo automático (sem confirmação)

# Capturar argumentos
AUTO_MODE=""
if [ "$1" = "--auto" ]; then
    AUTO_MODE="--auto"
    echo "Executando em modo automático"
fi

echo "====================================================="
echo "UTILITÁRIO DE REMOÇÃO DE COLEÇÕES UUID DO MONGODB"
echo "====================================================="
echo ""

# Ir para o diretório backend
cd "$(dirname "$0")/.." || exit 1

# Verificar se o ambiente virtual existe
if [ -d "../venv" ]; then
    echo "Ativando ambiente virtual..."
    source ../venv/bin/activate
elif [ -d "../.venv" ]; then
    echo "Ativando ambiente virtual..."
    source ../.venv/bin/activate
else
    echo "Ambiente virtual não encontrado. Usando Python do sistema."
fi

# Exportar as variáveis de ambiente necessárias
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Verificar se MONGODB_URI está definido
if [ -z "$MONGODB_URI" ]; then
    echo "Variável MONGODB_URI não definida. Usando valor padrão localhost."
    export MONGODB_URI="mongodb://localhost:27017/"
fi

# Verificar se ROLETAS_MONGODB_DB_NAME está definido
if [ -z "$ROLETAS_MONGODB_DB_NAME" ]; then
    echo "Variável ROLETAS_MONGODB_DB_NAME não definida. Usando valor padrão 'roletas_db'."
    export ROLETAS_MONGODB_DB_NAME="roletas_db"
fi

echo "Banco de dados alvo: $ROLETAS_MONGODB_DB_NAME"
echo ""
echo "Iniciando remoção de coleções UUID..."
echo ""

# Executar o script Python com ou sem o modo automático
python scripts/remover_colecoes_uuid.py $AUTO_MODE

echo ""
echo "Script concluído." 