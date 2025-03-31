FROM python:3.11

WORKDIR /app

# Configurar variáveis de ambiente para evitar interações durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependências do sistema com configurações adicionais
RUN apt-get update && \
    apt-get install -y --no-install-recommends xvfb git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Clonar o repositório
RUN git clone https://github.com/jocta71/runcash1.git /tmp/repo && \
    cp -r /tmp/repo/backend/scraper/* /app/ && \
    rm -rf /tmp/repo

# Instalar dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Configurar variáveis de ambiente
ENV PYTHONUNBUFFERED=1

# Comando para iniciar o scraper
CMD ["python", "run_real_scraper.py"] 