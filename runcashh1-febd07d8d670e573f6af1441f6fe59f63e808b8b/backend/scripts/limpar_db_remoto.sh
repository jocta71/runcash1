#!/bin/bash

# Script para remover coleções UUID do banco de dados MongoDB remoto
# usando a string de conexão fornecida

# String de conexão segura
MONGODB_URI="mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=roletas_db"
DB_NAME="roletas_db"

echo "====================================================="
echo "UTILITÁRIO DE REMOÇÃO DE COLEÇÕES UUID DO MONGODB REMOTO"
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
export MONGODB_URI="$MONGODB_URI"
export ROLETAS_MONGODB_DB_NAME="$DB_NAME"

echo "Usando conexão remota com o MongoDB"
echo "Banco de dados alvo: $DB_NAME"
echo ""

# Primeiro, listar todas as coleções para verificação
echo "Listando todas as coleções antes da remoção..."
python scripts/listar_colecoes.py

echo ""
echo "Deseja prosseguir com a remoção das coleções UUID? (s/n)"
read -r resposta

if [[ "$resposta" != "s" ]]; then
    echo "Operação cancelada pelo usuário."
    exit 0
fi

echo ""
echo "Iniciando remoção de coleções UUID..."
echo ""

# Executar o script Python no modo automático
python scripts/remover_colecoes_uuid.py --auto

echo ""
echo "Listando coleções restantes após a remoção..."
python scripts/listar_colecoes.py

echo ""
echo "Script concluído." 