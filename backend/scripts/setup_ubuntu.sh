#!/bin/bash

# Script de instalação para RunCash no Ubuntu
# Autor: RunCash Team

echo "===== RunCash - Instalação em Ubuntu ====="
echo "Iniciando instalação de todas as dependências..."

# Atualizar repositórios
echo "Atualizando repositórios..."
sudo apt-get update

# Instalar dependências básicas
echo "Instalando dependências básicas..."
sudo apt-get install -y curl wget git unzip build-essential

# Instalar Node.js
echo "Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação do Node.js
echo "Versão do Node.js instalada:"
node --version
npm --version

# Instalar Python 3 e pip
echo "Instalando Python 3 e pip..."
sudo apt-get install -y python3 python3-pip python3-venv

# Verificar instalação do Python
echo "Versão do Python instalada:"
python3 --version
pip3 --version

# Instalar Chrome/Chromium e ChromeDriver (necessário para o scraper)
echo "Instalando Chrome e ChromeDriver..."
sudo apt-get install -y chromium-browser

# Instalar localtunnel globalmente
echo "Instalando localtunnel globalmente..."
sudo npm install -g localtunnel

# Trabalhar com o diretório do projeto
echo "Configurando diretório do projeto..."
RUNCASH_DIR=/root/runcash1

# Instalar dependências do projeto Node.js para o backend
echo "Instalando dependências Node.js para o backend..."
cd $RUNCASH_DIR/backend
npm install express socket.io cors mongodb dotenv axios

# Criar ambiente virtual Python e instalar dependências
echo "Configurando ambiente Python..."
cd $RUNCASH_DIR
python3 -m venv venv
source venv/bin/activate

# Instalar dependências Python
echo "Instalando dependências Python..."
cd $RUNCASH_DIR/backend/scraper
pip install -r requirements.txt
pip install pymongo selenium webdriver-manager python-dotenv flask flask-cors requests

# Instalar Chrome WebDriver via pip
pip install chromedriver-autoinstaller

echo "===== Instalação concluída! ====="
echo "O sistema RunCash está pronto para ser executado."
echo "Use o script run_services.sh para iniciar os serviços." 