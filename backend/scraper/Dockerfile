# Use a slim Python image for a smaller footprint
FROM python:3.11-slim

# Configurar variáveis de ambiente
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    MOZ_HEADLESS=1

WORKDIR /app

# Instalar dependências do sistema com otimização de camadas
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    xvfb \
    firefox-esr \
    wget \
    gnupg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/*

# Configurar geckodriver para Firefox
RUN wget -q https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz && \
    tar -xzf geckodriver-v0.33.0-linux64.tar.gz -C /usr/local/bin && \
    rm geckodriver-v0.33.0-linux64.tar.gz && \
    chmod +x /usr/local/bin/geckodriver

# Copiar e instalar dependências Python primeiro para melhor cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache/pip/*

# Copiar o código da aplicação
COPY . .

# Comando para iniciar o scraper
CMD ["python", "run_real_scraper.py"] 