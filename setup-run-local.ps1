# Script para configurar e executar o projeto RunCash localmente
Write-Host "Iniciando configuração do ambiente de desenvolvimento local..." -ForegroundColor Green

# Verificar se o Node.js está instalado
$nodeInstalled = $null -ne (Get-Command node -ErrorAction SilentlyContinue)

if (-not $nodeInstalled) {
    Write-Host "Node.js não encontrado. Para executar este projeto, você precisa instalar o Node.js." -ForegroundColor Yellow
    Write-Host "Instruções para instalar o Node.js:" -ForegroundColor Yellow
    Write-Host "1. Baixe o instalador em https://nodejs.org/en/download/" -ForegroundColor Yellow
    Write-Host "2. Execute o instalador e siga as instruções" -ForegroundColor Yellow
    Write-Host "3. Após a instalação, feche e reabra o terminal" -ForegroundColor Yellow
    Write-Host "4. Execute este script novamente" -ForegroundColor Yellow
    
    $installNow = Read-Host "Deseja abrir o site de download do Node.js agora? (S/N)"
    if ($installNow -eq "S" -or $installNow -eq "s") {
        Start-Process "https://nodejs.org/en/download/"
    }
    
    exit 1
}

# Se chegou aqui, Node.js está instalado
Write-Host "Node.js encontrado: $(node -v)" -ForegroundColor Green
Write-Host "npm encontrado: $(npm -v)" -ForegroundColor Green

# Navegando para o diretório do frontend
Set-Location -Path "frontend"
Write-Host "Diretório atual: $(Get-Location)" -ForegroundColor Cyan

# Verificar se node_modules existe
if (-not (Test-Path -Path "node_modules")) {
    Write-Host "Instalando dependências do projeto..." -ForegroundColor Yellow
    npm install

    # Verificar se a instalação foi bem-sucedida
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro ao instalar dependências. Verifique as mensagens acima." -ForegroundColor Red
        exit 1
    }
}

# Instalar as novas dependências necessárias para a arquitetura de roletas
Write-Host "Instalando dependências adicionais para a nova arquitetura de roletas..." -ForegroundColor Yellow
npm install axios socket.io-client events --save
npm install @types/node @types/react @types/react-dom @types/jest ts-jest @testing-library/react @testing-library/jest-dom --save-dev

# Iniciar o servidor de desenvolvimento
Write-Host "Iniciando o servidor de desenvolvimento..." -ForegroundColor Green
Write-Host "A aplicação estará disponível em http://localhost:5173/" -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C para encerrar." -ForegroundColor Cyan
npm run dev 