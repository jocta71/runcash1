#!/bin/bash

# Script de build para o Vercel garantir a instalação correta das dependências
echo "Iniciando instalação das dependências da API..."

# Instalar dependências com clean install 
npm ci || npm install

# Em caso de erro, tentar uma instalação direta do axios
if [ $? -ne 0 ]; then
  echo "Falha na instalação padrão, tentando instalar axios diretamente..."
  npm install axios@1.6.0
fi

echo "Instalação das dependências da API concluída!" 