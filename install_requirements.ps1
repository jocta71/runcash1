# Script para instalar as dependências necessárias
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Instalando dependências para teste de RouletteAi" -ForegroundColor Cyan
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
python -m venv roulette_env

# Ativar ambiente virtual
Write-Host "`nAtivando ambiente virtual..." -ForegroundColor Cyan
& ".\roulette_env\Scripts\Activate.ps1"

# Instalar requisitos
Write-Host "`nInstalando pacotes necessários..." -ForegroundColor Cyan
pip install numpy tensorflow matplotlib pymongo pandas

# Verificar instalação
Write-Host "`nVerificando instalação..." -ForegroundColor Cyan
python -c "import numpy, tensorflow, matplotlib, pymongo, pandas; print('Todas as dependências instaladas com sucesso!')"

if ($?) {
    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host "Instalação concluída com sucesso!" -ForegroundColor Green
    Write-Host "Você pode executar o teste com: python test_roulette_ai.py" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host "`n============================================================" -ForegroundColor Red
    Write-Host "Falha na instalação de algumas dependências." -ForegroundColor Red
    Write-Host "Tente instalar manualmente com: pip install numpy tensorflow matplotlib pymongo pandas" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Red
} 