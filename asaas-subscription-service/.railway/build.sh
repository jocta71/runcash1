#!/bin/bash
set -e

echo "Executando o script de build..."

# Verificar instalações
echo "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "Node.js não encontrado. Tentando instalar..."
    apt-get update && apt-get install -y curl gnupg
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    node --version
else
    node --version
fi

echo "Verificando NPM..."
npm --version || echo "AVISO: NPM não está disponível"

echo "Verificando Python..."
python3 --version || echo "AVISO: Python3 não está disponível"

# Verificar se as dependências do Node.js estão instaladas
if [ -f "/app/package.json" ]; then
    echo "Instalando dependências do Node.js..."
    npm ci || npm install
fi

# Tornar os scripts executáveis
chmod +x /app/start.sh || echo "AVISO: Não foi possível tornar start.sh executável"
chmod +x /app/start-combined.sh || echo "AVISO: Não foi possível tornar start-combined.sh executável"

echo "Script de build concluído!" 