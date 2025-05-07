# Script para instalar as dependências para o RouletteAi com estratégia de estados
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Instalando dependências para RouletteAi com estratégia" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Verificar se Python está instalado
try {
    $pythonVersion = (python --version 2>&1)
    Write-Host "Python encontrado: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "Python não encontrado! Por favor, instale o Python 3.x antes de continuar." -ForegroundColor Red
    Write-Host "Você pode baixar o Python em: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Criar ambiente virtual
Write-Host "`nCriando ambiente virtual..." -ForegroundColor Cyan
python -m venv roulette_strategy_env

# Ativar ambiente virtual
Write-Host "`nAtivando ambiente virtual..." -ForegroundColor Cyan
& ".\roulette_strategy_env\Scripts\Activate.ps1"

# Atualizar pip
Write-Host "`nAtualizando pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# Instalar requisitos (por etapas para maior confiabilidade)
Write-Host "`nInstalando NumPy..." -ForegroundColor Cyan
pip install numpy==1.24.3

Write-Host "`nInstalando PyMongo..." -ForegroundColor Cyan
pip install pymongo

Write-Host "`nInstalando Art (para ASCII art)..." -ForegroundColor Cyan
pip install art

Write-Host "`nInstalando TensorFlow (versão compatível com Python 3.9)..." -ForegroundColor Cyan
pip install tensorflow==2.15.0

# Verificar instalação do TensorFlow
Write-Host "`nVerificando instalação do TensorFlow..." -ForegroundColor Cyan
python -c "import tensorflow as tf; print(f'TensorFlow versão: {tf.__version__}')"

if ($?) {
    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host "Instalação concluída com sucesso!" -ForegroundColor Green
    Write-Host "Para executar a estratégia:" -ForegroundColor Green
    Write-Host "1. Ative o ambiente: .\roulette_strategy_env\Scripts\Activate.ps1" -ForegroundColor Green
    Write-Host "2. Execute: python roulette_ai_strategy.py" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host "`n============================================================" -ForegroundColor Yellow
    Write-Host "TensorFlow não instalado corretamente." -ForegroundColor Yellow
    Write-Host "A estratégia ainda funcionará, mas no modo estatístico." -ForegroundColor Yellow
    Write-Host "Para executar:" -ForegroundColor Yellow
    Write-Host "1. Ative o ambiente: .\roulette_strategy_env\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "2. Execute: python roulette_ai_strategy.py" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Yellow
} 