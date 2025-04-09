#!/bin/bash

# Parar e remover contêiner anterior se existir
echo "Parando e removendo containers anteriores..."
docker stop runcashh1-api 2>/dev/null || true
docker rm runcashh1-api 2>/dev/null || true

# Construir a nova imagem
echo "Construindo imagem Docker..."
docker build -t runcashh1-api:prod .

# Executar o contêiner
echo "Iniciando container runcashh1-api..."
docker run -d --name runcashh1-api \
  -p 3000:3000 \
  -e MONGODB_URI="$MONGODB_URI" \
  -e ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
  runcashh1-api:prod

# Mostrar logs
echo "Logs do container:"
docker logs -f runcashh1-api 