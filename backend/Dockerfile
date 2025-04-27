FROM node:18-alpine

WORKDIR /app

# Copiar os arquivos de configuração do diretório principal
COPY package*.json ./

# Instalar dependências do diretório principal
RUN npm install

# Copiar arquivo package.json do diretório api
COPY api/package*.json ./api/

# Instalar dependências do diretório api
RUN cd api && npm install

# Copiar todo o código-fonte
COPY . .

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "start_index.js"] 