FROM node:18-slim

WORKDIR /app

# Copiar arquivos de dependência primeiro (melhora o caching)
COPY backend/api/package*.json ./
COPY backend/api/package-lock.json* ./

# Instalar dependências
RUN npm install

# Garantir que o mongoose seja instalado
RUN npm install mongoose@8.1.1

# Copiar o resto do código
COPY backend/api/ ./

# Porta que o serviço usará
EXPOSE 3002

# Iniciar serviço
CMD ["node", "index.js"] 