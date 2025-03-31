FROM python:3.11

WORKDIR /app

# Configurar variáveis de ambiente para evitar interações durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependências do sistema com configurações adicionais
RUN apt-get update && \
    apt-get install -y --no-install-recommends xvfb && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fonte
COPY . .

# Configurar variáveis de ambiente
ENV PYTHONUNBUFFERED=1

# Comando para iniciar o scraper
CMD ["python", "run_real_scraper.py"] 