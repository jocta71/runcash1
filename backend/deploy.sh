#!/bin/bash

# Script de deploy para o backend do RunCash

echo "🚀 Iniciando deploy do backend..."

# Verificar se o Git está instalado
if ! command -v git &> /dev/null; then
    echo "❌ Git não encontrado. Por favor, instale o Git e tente novamente."
    exit 1
fi

# Verificar se o Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI não encontrado. Instalando..."
    npm install -g @railway/cli
fi

# Verificar se estamos autenticados no Railway
echo "🔑 Verificando autenticação no Railway..."
if ! railway whoami &> /dev/null; then
    echo "Por favor, faça login no Railway:"
    railway login
fi

# Preparar os arquivos para deploy
echo "📦 Preparando arquivos para deploy..."

# Fazer commit das alterações locais
echo "💾 Fazendo commit das alterações..."
git add .
git commit -m "feat: Incluir números das roletas na API de ROULETTES"

# Fazer push para o repositório remoto
echo "📤 Enviando alterações para o repositório remoto..."
git push origin main

# Deploy no Railway
echo "🚂 Iniciando deploy no Railway..."
cd api
railway up
cd ..

echo "✅ Deploy concluído com sucesso!"
echo "🌐 A API estará disponível em: https://backendapi-production-36b5.up.railway.app"
echo "🔄 Aguarde alguns minutos para que as alterações sejam aplicadas." 