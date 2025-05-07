# Script PowerShell para atualizar nomes das roletas no banco de dados

Write-Host "Iniciando atualização de nomes de roletas..." -ForegroundColor Cyan

# Verificar se o Python está instalado
$pythonCommand = $null
if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonCommand = "python"
} elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $pythonCommand = "python3"
} elseif (Test-Path "C:\Program Files\Python*\python.exe") {
    $pythonCommand = (Get-ChildItem "C:\Program Files\Python*\python.exe" | Select-Object -First 1).FullName
} else {
    Write-Host "❌ ERRO: Python não encontrado. Por favor, instale o Python 3." -ForegroundColor Red
    exit 1
}

Write-Host "Usando Python: $pythonCommand" -ForegroundColor Green

# Verificar se o script Python existe
if (-not (Test-Path "atualizar_nomes_roletas.py")) {
    Write-Host "❌ ERRO: Script 'atualizar_nomes_roletas.py' não encontrado." -ForegroundColor Red
    exit 1
}

# Verificar se as dependências estão instaladas
Write-Host "Verificando dependências..." -ForegroundColor Yellow

# Função para verificar e instalar pacotes Python
function Install-PythonPackage {
    param (
        [string]$PackageName
    )
    
    try {
        & $pythonCommand -c "import $PackageName" 2>$null
        return $true
    } catch {
        Write-Host "Instalando $PackageName..." -ForegroundColor Yellow
        & $pythonCommand -m pip install $PackageName
        return $false
    }
}

# Verificar e instalar pacotes
Install-PythonPackage -PackageName "pymongo"
Install-PythonPackage -PackageName "dotenv"

# Executar o script Python
Write-Host "`nExecutando script de atualização..." -ForegroundColor Cyan
& $pythonCommand atualizar_nomes_roletas.py

# Verificar resultado
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Atualização concluída com sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Ocorreu um erro durante a atualização." -ForegroundColor Red
}

# Finalizar
Write-Host "`nPara ver as mudanças, reinicie o servidor ou aguarde o próximo ciclo de atualização." -ForegroundColor Cyan
Write-Host "`nPressione qualquer tecla para sair..."
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 