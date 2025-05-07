# Script para instalar dependências da Estratégia de Terminais
# PowerShell Script para Windows

Write-Host "========================================================"
Write-Host "    Instalação da Estratégia de Terminais para Roleta"
Write-Host "========================================================"

# Verificar se o Python está instalado
try {
    $pythonVersion = python --version 2>&1
    if (-not $pythonVersion.ToString().StartsWith("Python")) {
        throw "Python não encontrado"
    }
    Write-Host "Python encontrado: $pythonVersion"
} catch {
    Write-Host "Python não encontrado. Por favor, instale o Python 3.9 ou superior:"
    Write-Host "https://www.python.org/downloads/"
    Write-Host "Certifique-se de marcar a opção 'Add Python to PATH' durante a instalação."
    exit 1
}

# Criar e ativar ambiente virtual
Write-Host "`nCriando ambiente virtual 'terminal_env'..."
python -m venv terminal_env

Write-Host "Ativando ambiente virtual..."
& .\terminal_env\Scripts\Activate.ps1

# Instalar dependências
Write-Host "`nInstalando dependências necessárias..."
pip install pymongo art

# Verificar se as dependências foram instaladas corretamente
$pkgCheck = pip list
if ($pkgCheck -match "pymongo" -and $pkgCheck -match "art") {
    Write-Host "Dependências instaladas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Erro: Falha ao instalar algumas dependências." -ForegroundColor Red
    exit 1
}

# Criar script de execução
$batchContent = @"
@echo off
echo Iniciando Estratégia de Terminais para Roleta...
call .\terminal_env\Scripts\activate.bat
python roulette_terminal_strategy.py
pause
"@

Set-Content -Path "executar_estrategia_terminal.bat" -Value $batchContent -Encoding UTF8

Write-Host "`n========================================================"
Write-Host "Instalação concluída com sucesso!" -ForegroundColor Green
Write-Host "Para executar a estratégia de terminais, use:"
Write-Host ".\executar_estrategia_terminal.bat"
Write-Host "`nOu, se preferir usar o PowerShell:"
Write-Host ".\terminal_env\Scripts\Activate.ps1"
Write-Host "python roulette_terminal_strategy.py"
Write-Host "========================================================" 