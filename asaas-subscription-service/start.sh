#!/bin/bash
set -e

echo "===== Iniciando Serviço de Assinaturas Asaas ====="

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "Erro: Node.js não está instalado. Tentando instalar..."
    # Tentar instalar Node.js se não estiver presente
    apt-get update && apt-get install -y curl
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    # Verificar novamente
    if ! command -v node &> /dev/null; then
        echo "Erro crítico: Falha ao instalar Node.js. Não é possível continuar."
        exit 1
    else
        echo "Node.js instalado com sucesso. Versão: $(node -v)"
    fi
fi

echo "Node.js detectado. Versão: $(node -v)"
echo "NPM detectado. Versão: $(npm -v)"

# Verificar se as variáveis de ambiente necessárias estão definidas
if [ -z "$MONGODB_URI" ]; then
    echo "Aviso: MONGODB_URI não está definido"
fi

if [ -z "$JWT_SECRET" ]; then
    echo "Aviso: JWT_SECRET não está definido"
fi

if [ -z "$ASAAS_API_KEY" ]; then
    echo "Aviso: ASAAS_API_KEY não está definido"
fi

# Inicializar o banco de dados se necessário
echo "Verificando conexão com o MongoDB..."
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Conectado ao MongoDB com sucesso'))
  .catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1);
  });
"

# Iniciar o serviço principal
echo "Iniciando serviço de assinaturas..."
exec node src/app.js 