# Script PowerShell para instalar as dependências necessárias para o sistema otimizado de banco de dados de roletas
# Autor: AI Assistant
# Data: 2023

# Função para exibir mensagens coloridas
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    Write-Host $Message -ForegroundColor $Color
}

# Função para verificar se Python está instalado
function Test-Python {
    try {
        $pythonVersion = python --version 2>&1
        if ($pythonVersion -match "Python 3") {
            Write-ColorOutput "Python 3 encontrado: $pythonVersion" "Green"
            return $true
        } else {
            Write-ColorOutput "Versão incompatível do Python encontrada: $pythonVersion" "Yellow"
            return $false
        }
    } catch {
        Write-ColorOutput "Python não encontrado no sistema." "Red"
        return $false
    }
}

# Função para verificar se pip está instalado
function Test-Pip {
    try {
        $pipVersion = python -m pip --version 2>&1
        Write-ColorOutput "Pip encontrado: $pipVersion" "Green"
        return $true
    } catch {
        Write-ColorOutput "Pip não encontrado no sistema." "Red"
        return $false
    }
}

# Função para instalar pacotes via pip
function Install-PipPackage {
    param(
        [string]$Package,
        [string]$Version = ""
    )
    
    $packageSpec = $Package
    if ($Version -ne "") {
        $packageSpec = "$Package==$Version"
    }
    
    Write-ColorOutput "Instalando $packageSpec..." "Cyan"
    
    try {
        $output = python -m pip install $packageSpec 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ $Package instalado com sucesso!" "Green"
            return $true
        } else {
            Write-ColorOutput "✗ Erro ao instalar $Package." "Red"
            Write-ColorOutput $output "Red"
            return $false
        }
    } catch {
        Write-ColorOutput "✗ Exceção ao instalar $Package: $_" "Red"
        return $false
    }
}

# Função para criar ambiente virtual (opcional)
function Create-VirtualEnv {
    param(
        [string]$EnvName = "roletas_env"
    )
    
    Write-ColorOutput "Verificando se o módulo venv está disponível..." "Cyan"
    $hasVenv = python -c "import venv; print('venv disponível')" 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "Criando ambiente virtual '$EnvName'..." "Cyan"
        python -m venv $EnvName
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Ambiente virtual '$EnvName' criado com sucesso!" "Green"
            return $true
        } else {
            Write-ColorOutput "✗ Erro ao criar ambiente virtual." "Red"
            return $false
        }
    } else {
        Write-ColorOutput "Módulo venv não disponível. Instalando..." "Yellow"
        Install-PipPackage "virtualenv"
        
        Write-ColorOutput "Criando ambiente virtual usando virtualenv..." "Cyan"
        python -m virtualenv $EnvName
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Ambiente virtual '$EnvName' criado com sucesso!" "Green"
            return $true
        } else {
            Write-ColorOutput "✗ Erro ao criar ambiente virtual." "Red"
            return $false
        }
    }
}

# Função principal
function Install-Dependencies {
    Write-ColorOutput "===================================" "Magenta"
    Write-ColorOutput "Instalação de Dependências para o Sistema de Banco de Dados de Roletas" "Magenta"
    Write-ColorOutput "===================================" "Magenta"
    
    # Verificar Python
    $pythonInstalled = Test-Python
    if (-not $pythonInstalled) {
        Write-ColorOutput "Python 3.7+ é necessário. Por favor, instale Python e tente novamente." "Red"
        return
    }
    
    # Verificar pip
    $pipInstalled = Test-Pip
    if (-not $pipInstalled) {
        Write-ColorOutput "Pip é necessário. Por favor, instale pip e tente novamente." "Red"
        return
    }
    
    # Perguntar sobre ambiente virtual
    $createVenv = Read-Host "Deseja criar um ambiente virtual? (s/n) [padrão: n]"
    $envActivated = $false
    
    if ($createVenv -eq "s" -or $createVenv -eq "S") {
        $envName = Read-Host "Nome do ambiente virtual [padrão: roletas_env]"
        if ([string]::IsNullOrEmpty($envName)) {
            $envName = "roletas_env"
        }
        
        $envCreated = Create-VirtualEnv $envName
        
        if ($envCreated) {
            Write-ColorOutput "Ativando ambiente virtual..." "Cyan"
            
            # Determinar script de ativação baseado no PowerShell
            $activateScript = Join-Path $envName "Scripts\Activate.ps1"
            
            if (Test-Path $activateScript) {
                & $activateScript
                $envActivated = $true
                Write-ColorOutput "✓ Ambiente virtual '$envName' ativado!" "Green"
            } else {
                Write-ColorOutput "✗ Script de ativação não encontrado. Continuando sem ambiente virtual." "Yellow"
            }
        }
    } else {
        Write-ColorOutput "Continuando sem ambiente virtual." "Cyan"
    }
    
    # Instalar dependências
    Write-ColorOutput "`nInstalando dependências necessárias..." "Cyan"
    
    $packagesToInstall = @(
        @{Name="pymongo"; Version="3.12.0"},
        @{Name="python-dotenv"; Version="0.19.0"},
        @{Name="dnspython"; Version="2.2.1"}
    )
    
    $allSuccess = $true
    
    foreach ($package in $packagesToInstall) {
        $success = Install-PipPackage $package.Name $package.Version
        if (-not $success) {
            $allSuccess = $false
        }
    }
    
    # Verificar dependências instaladas
    if ($allSuccess) {
        Write-ColorOutput "`nTodas as dependências foram instaladas com sucesso!" "Green"
    } else {
        Write-ColorOutput "`nAlgumas dependências não puderam ser instaladas. Verifique os erros acima." "Yellow"
    }
    
    # Instrução sobre como executar
    Write-ColorOutput "`nPara usar o sistema, execute primeiro:" "Cyan"
    Write-ColorOutput "python criar_banco_roletas.py" "White"
    
    Write-ColorOutput "`nEm seguida, você pode utilizar o adaptador no seu código:" "Cyan"
    Write-ColorOutput "from adaptar_scraper_roletas_db import ScraperAdapter" "White"
    
    # Se ativou ambiente virtual, perguntar se deseja desativá-lo
    if ($envActivated) {
        $deactivateEnv = Read-Host "`nDeseja desativar o ambiente virtual? (s/n) [padrão: n]"
        
        if ($deactivateEnv -eq "s" -or $deactivateEnv -eq "S") {
            deactivate
            Write-ColorOutput "Ambiente virtual desativado." "Green"
            
            Write-ColorOutput "`nLembre-se de ativar o ambiente virtual antes de executar o script:" "Yellow"
            Write-ColorOutput "& .\$envName\Scripts\Activate.ps1" "White"
        } else {
            Write-ColorOutput "`nAmbiente virtual permanece ativo." "Green"
        }
    }
    
    Write-ColorOutput "`n===================================" "Magenta"
    Write-ColorOutput "Instalação concluída!" "Magenta"
    Write-ColorOutput "===================================" "Magenta"
}

# Executar função principal
Install-Dependencies

# Aguardar pressionar uma tecla antes de sair
Write-Host "`nPressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 