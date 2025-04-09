#!/bin/sh
set -e

echo "Iniciando aplicação REST API na porta $PORT"
echo "Ambiente: $NODE_ENV"
echo "Diretório atual: $(pwd)"
echo "Arquivos disponíveis: $(ls -la)"

# Verificar se o arquivo api_server.js existe
if [ -f "./api_server.js" ]; then
  echo "Encontrado api_server.js, iniciando servidor..."
  node api_server.js
else
  echo "ERRO: Arquivo api_server.js não encontrado!"
  echo "Conteúdo do diretório:"
  ls -la
  exit 1
fi 