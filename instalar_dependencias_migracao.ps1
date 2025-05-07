# Script para instalar dependências para a migração do MongoDB
# PowerShell Script para Windows

Write-Host "========================================================"
Write-Host "    Instalação de Dependências para Migração MongoDB"
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
Write-Host "`nCriando ambiente virtual 'mongo_migration_env'..."
python -m venv mongo_migration_env

Write-Host "Ativando ambiente virtual..."
& .\mongo_migration_env\Scripts\Activate.ps1

# Instalar dependências
Write-Host "`nInstalando dependências necessárias..."
pip install pymongo tqdm

# Verificar se as dependências foram instaladas corretamente
$pkgCheck = pip list
if ($pkgCheck -match "pymongo" -and $pkgCheck -match "tqdm") {
    Write-Host "Dependências instaladas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Erro: Falha ao instalar algumas dependências." -ForegroundColor Red
    exit 1
}

# Criar script de execução
$batchContent = @"
@echo off
echo Iniciando Migração do MongoDB para coleções separadas...
call .\mongo_migration_env\Scripts\activate.bat
python mongo_migration_roletas.py %*
pause
"@

Set-Content -Path "executar_migracao_mongodb.bat" -Value $batchContent -Encoding UTF8

Write-Host "`n========================================================"
Write-Host "Instalação concluída com sucesso!" -ForegroundColor Green
Write-Host "Para executar a migração, use:"
Write-Host ".\executar_migracao_mongodb.bat"
Write-Host ""
Write-Host "Para forçar a migração mesmo em coleções existentes:"
Write-Host ".\executar_migracao_mongodb.bat --force"
Write-Host ""
Write-Host "Ou, se preferir usar o PowerShell:"
Write-Host ".\mongo_migration_env\Scripts\Activate.ps1"
Write-Host "python mongo_migration_roletas.py [--force]"
Write-Host "=========================================================" 