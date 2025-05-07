#!/bin/bash

# Script para atualizar nomes das roletas no banco de dados

echo "Iniciando atualização de nomes de roletas..."

# Verificar se o Python está instalado
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ ERRO: Python não encontrado. Por favor, instale o Python 3."
    exit 1
fi

# Verificar se o script Python existe
if [ ! -f "atualizar_nomes_roletas.py" ]; then
    echo "❌ ERRO: Script 'atualizar_nomes_roletas.py' não encontrado."
    exit 1
fi

# Verificar se as dependências estão instaladas
echo "Verificando dependências..."
$PYTHON_CMD -c "import pymongo" 2>/dev/null || { 
    echo "Instalando pymongo..."
    pip install pymongo; 
}

$PYTHON_CMD -c "import dotenv" 2>/dev/null || { 
    echo "Instalando python-dotenv..."
    pip install python-dotenv; 
}

# Executar o script Python
echo "Executando script de atualização..."
$PYTHON_CMD atualizar_nomes_roletas.py

# Verificar resultado
if [ $? -eq 0 ]; then
    echo "✅ Atualização concluída com sucesso!"
else
    echo "❌ Ocorreu um erro durante a atualização."
fi

# Finalizar
echo ""
echo "Para ver as mudanças, reinicie o servidor ou aguarde o próximo ciclo de atualização."
echo "" 