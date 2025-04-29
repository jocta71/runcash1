FROM python:3.11-slim

# Instalar dependências necessárias
RUN apt-get update && \
    apt-get install -y curl wget gnupg bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Instalar Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verificar instalações
RUN node --version && npm --version && python3 --version

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências Node.js
RUN npm install

# Copiar todo o código fonte
COPY . .

# Instalar dependências Python se houver requirements.txt
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Tornar os scripts executáveis
RUN chmod +x .railway/build.sh || echo ".railway/build.sh não encontrado"
RUN chmod +x start.sh || echo "start.sh não encontrado, será criado posteriormente"
RUN chmod +x start-combined.sh || echo "start-combined.sh não encontrado, será criado posteriormente"

# Expor a porta do serviço
EXPOSE 3000

# Definir o script de inicialização
CMD ["./start-combined.sh"] 