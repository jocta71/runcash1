FROM node:18-slim

# Criar usuário não-root para segurança
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --omit=dev

# Copiar código-fonte
COPY api_server.js healthcheck.js ./
COPY api/ ./api/

# Definir variáveis de ambiente
ENV PORT=3000
ENV NODE_ENV=production

# Definir usuário não-root
USER appuser

# Expor porta
EXPOSE 3000

# Configurar healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["node", "healthcheck.js"]

# Comando para iniciar a aplicação
CMD ["node", "api_server.js"] 