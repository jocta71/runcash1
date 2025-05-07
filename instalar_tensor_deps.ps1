# Script para instalar as dependências necessárias para o RouletteAi
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Instalando dependências para RouletteAi" -ForegroundColor Cyan
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
python -m venv roulette_ai_env

# Ativar ambiente virtual
Write-Host "`nAtivando ambiente virtual..." -ForegroundColor Cyan
& ".\roulette_ai_env\Scripts\Activate.ps1"

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
    Write-Host "Você pode executar o RouletteAi com: python runcash_roulette_ai.py" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    
    Write-Host "`nInstruções de uso:" -ForegroundColor Yellow
    Write-Host "1. Cada vez que quiser usar o modelo, ative o ambiente virtual com:" -ForegroundColor Yellow
    Write-Host "   .\roulette_ai_env\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "2. Execute o script com:" -ForegroundColor Yellow
    Write-Host "   python runcash_roulette_ai.py" -ForegroundColor Yellow
    Write-Host "3. Siga as instruções na tela" -ForegroundColor Yellow
} else {
    Write-Host "`n============================================================" -ForegroundColor Red
    Write-Host "Falha na instalação do TensorFlow." -ForegroundColor Red
    Write-Host "Tente usar a versão estatística (teste_simples_roleta.py) que não requer TensorFlow" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Red
} 