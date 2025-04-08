FROM python:3.11-slim

WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && \
    apt-get install -y xvfb firefox-esr wget gnupg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configurar geckodriver para Firefox
RUN wget -q https://github.com/mozilla/geckodriver/releases/download/v0.33.0/geckodriver-v0.33.0-linux64.tar.gz && \
    tar -xzf geckodriver-v0.33.0-linux64.tar.gz -C /usr/local/bin && \
    rm geckodriver-v0.33.0-linux64.tar.gz && \
    chmod +x /usr/local/bin/geckodriver

# Copiar requirements e instalar dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fonte
COPY . .

# Configurar variáveis de ambiente
ENV PYTHONUNBUFFERED=1 \
    MOZ_HEADLESS=1

# Comando para iniciar o scraper
CMD ["python", "run_real_scraper.py"] 