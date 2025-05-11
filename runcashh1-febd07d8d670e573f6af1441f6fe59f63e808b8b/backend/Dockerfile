FROM node:18-alpine

WORKDIR /app

# Copiar os arquivos de configuração necessários 
COPY package*.json ./
COPY api/package*.json ./api/
COPY install_dependencies.js ./

# Instalar todas as dependências usando o script
RUN node install_dependencies.js

# Copiar todo o código-fonte
COPY . .

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["/bin/sh", "-c", "node start_index.js"] 