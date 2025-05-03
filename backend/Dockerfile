FROM node:18-alpine

# Instalar dependências necessárias para compilação de módulos nativos (como bcrypt)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copiar apenas os arquivos de dependências primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instalar dependências com --force para garantir instalação de todas as dependências
RUN npm install --force 

# Instalar bcrypt explicitamente
RUN npm install bcrypt@5.1.1 --save

# Depois copiar o restante dos arquivos
COPY . .

# Executar script de pós-instalação
RUN npm run postinstall || echo "Postinstall concluído com aviso"

# Variáveis de ambiente
ENV PORT=5000
ENV NODE_ENV=production

# Expor a porta configurada
EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["node", "railway-start.js"] 