# Script para remover arquivos não utilizados no build
Write-Host "Iniciando limpeza de arquivos não utilizados no build do frontend..." -ForegroundColor Green

# Criando pasta de backup para segurança
$backupDir = ".\frontend\_unused_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "Criando diretório de backup: $backupDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Função para mover arquivo para backup
function Move-ToBackup {
    param (
        [string]$filePath
    )
    
    if (Test-Path $filePath) {
        $fileName = Split-Path $filePath -Leaf
        $relativePath = (Resolve-Path $filePath -Relative).Replace(".\", "")
        $targetDir = Join-Path $backupDir (Split-Path $relativePath -Parent)
        
        # Criar estrutura de diretórios no backup
        if (!(Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        
        $targetPath = Join-Path $targetDir $fileName
        Write-Host "Movendo $relativePath para backup..." -ForegroundColor Cyan
        Move-Item -Path $filePath -Destination $targetPath -Force
    } else {
        Write-Host "Arquivo não encontrado: $filePath" -ForegroundColor Red
    }
}

# 1. Remover arquivos temporários óbvios
$tempFiles = @(
    ".\frontend\temp_index.tsx",
    ".\frontend\temp.tsx",
    ".\frontend\new_index.tsx"
)

foreach ($file in $tempFiles) {
    Move-ToBackup $file
}

# 2. Remover configurações duplicadas
Move-ToBackup ".\frontend\vite.vercel.config.js"

# 3. Mover componentes órfãos para pasta de backup
Write-Host "Verificando componentes órfãos que não são usados no build..." -ForegroundColor Yellow

# Componentes órfãos identificados pelo comando find-orphans
# Esta é uma lista parcial, você deve ajustar conforme necessário
$orphanComponents = @(
    ".\frontend\src\components\ApexChartStats.tsx",
    ".\frontend\src\components\AuthRoute.tsx",
    ".\frontend\src\components\ChartSelectorExample.tsx",
    ".\frontend\src\components\CustomLoader.tsx",
    ".\frontend\src\components\ExemploPremiumContent.tsx",
    ".\frontend\src\components\Layout.tsx",
    ".\frontend\src\components\LoginModal.tsx",
    ".\frontend\src\components\Navbar.tsx",
    ".\frontend\src\components\PaymentForm.tsx"
    # Adicione mais componentes conforme necessário
)

foreach ($component in $orphanComponents) {
    Move-ToBackup $component
}

# 4. Move componentes UI não utilizados
# ATENÇÃO: Alguns componentes UI podem ser importados dinamicamente
# Verifique cuidadosamente antes de remover
$unusedUIComponents = @(
    ".\frontend\src\components\ui\accordion.tsx",
    ".\frontend\src\components\ui\alert-dialog.tsx",
    ".\frontend\src\components\ui\aspect-ratio.tsx",
    ".\frontend\src\components\ui\avatar.tsx",
    ".\frontend\src\components\ui\carousel.tsx"
    # Adicione mais conforme necessário
)

foreach ($component in $unusedUIComponents) {
    Move-ToBackup $component
}

Write-Host "Limpeza concluída!" -ForegroundColor Green
Write-Host "Os arquivos foram movidos para o diretório de backup: $backupDir" -ForegroundColor Green
Write-Host "IMPORTANTE: Verifique se a aplicação ainda funciona corretamente antes de excluir permanentemente os arquivos de backup." -ForegroundColor Yellow 