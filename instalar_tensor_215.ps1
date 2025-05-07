# Script simplificado para instalar TensorFlow 2.15 (compatível com Python 3.9)
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Instalando TensorFlow 2.15 (versão compatível)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Atualizar pip
Write-Host "Atualizando pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# Instalar pacotes necessários
Write-Host "Instalando NumPy, PyMongo e Art..." -ForegroundColor Cyan
pip install numpy==1.24.3 pymongo art

# Instalar TensorFlow 2.15
Write-Host "Instalando TensorFlow 2.15.0..." -ForegroundColor Cyan
pip install tensorflow==2.15.0

# Verificar instalação do TensorFlow
Write-Host "Verificando instalação..." -ForegroundColor Cyan
python -c "import tensorflow as tf; print(f'TensorFlow versão: {tf.__version__}')"

if ($?) {
    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host "Instalação concluída com sucesso!" -ForegroundColor Green
    Write-Host "Agora execute: python RouletteAi_adaptado.py" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host "`n============================================================" -ForegroundColor Red
    Write-Host "Falha na instalação do TensorFlow." -ForegroundColor Red
    Write-Host "Use a versão estatística: python runcash_roulette_ai_light.py" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Red
} 