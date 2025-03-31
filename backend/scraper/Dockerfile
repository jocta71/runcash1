FROM python:3.11 as builder

# Configurar variáveis de ambiente para evitar interações durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instalar git para clonar o repositório
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Clonar o repositório em um diretório temporário
WORKDIR /tmp
RUN git clone https://github.com/jocta71/runcash1.git

# Segunda fase - construir a imagem final
FROM python:3.11

WORKDIR /app

# Configurar variáveis de ambiente para evitar interações
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependências do sistema
RUN apt-get update && \
    apt-get install -y --no-install-recommends xvfb && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar apenas o necessário primeiro para aproveitar o cache de camadas
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo o código
COPY . .

# Configurar variáveis de ambiente
ENV PYTHONUNBUFFERED=1

# Comando para iniciar o scraper
CMD ["python", "run_real_scraper.py"] 