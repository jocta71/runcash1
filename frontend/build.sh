#!/bin/bash
echo "Iniciando processo de build"
echo "Limpando node_modules"
rm -rf node_modules
echo "Instalando dependências"
npm install --force
echo "Configurando ambiente"
export VITE_CJS_IGNORE_WARNING=true
export NODE_OPTIONS="--max-old-space-size=3072 --no-node-snapshot"
echo "Iniciando build"
npm run build
echo "Build concluído" 