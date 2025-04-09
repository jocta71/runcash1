### STAGE 1: Build ###
FROM node:18-slim AS builder

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar todas as dependências (incluindo dev)
RUN npm install

# Copiar código-fonte
COPY api_server.js healthcheck.js entrypoint.sh ./
COPY api/ ./api/

# Tornar o script de entrada executável
RUN chmod +x /app/entrypoint.sh

### STAGE 2: Production ###
FROM node:18-slim

# Criar usuário não-root para segurança
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Definir diretório de trabalho
WORKDIR /app

# Copiar apenas as dependências de produção
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/api_server.js /app/api_server.js
COPY --from=builder /app/healthcheck.js /app/healthcheck.js
COPY --from=builder /app/entrypoint.sh /app/entrypoint.sh
COPY --from=builder /app/api /app/api

# Definir variáveis de ambiente
ENV PORT=3000
ENV NODE_ENV=production

# Verificar conteúdo do diretório
RUN ls -la /app

# Definir usuário não-root
USER appuser

# Expor porta
EXPOSE 3000

# Configurar healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["node", "healthcheck.js"]

# Comando para iniciar a aplicação
CMD ["/app/entrypoint.sh"] 