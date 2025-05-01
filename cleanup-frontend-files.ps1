# Script para limpar arquivos temporários e não utilizados no frontend
Write-Host "Iniciando limpeza de arquivos temporários e não utilizados no frontend..." -ForegroundColor Green

# Criando pasta de backup para arquivos temporários
$tempBackupDir = ".\frontend\_temp_files_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "Criando diretório de backup para arquivos temporários: $tempBackupDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $tempBackupDir -Force | Out-Null

# 1. Arquivos temporários óbvios que podem ser removidos com segurança
$tempFiles = @(
    ".\frontend\temp_index.tsx",
    ".\frontend\temp.tsx",
    ".\frontend\new_index.tsx"
)

# Mover arquivos temporários para a pasta de backup
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        $fileName = Split-Path $file -Leaf
        $targetPath = Join-Path $tempBackupDir $fileName
        Write-Host "Movendo arquivo temporário: $file para backup..." -ForegroundColor Cyan
        Move-Item -Path $file -Destination $targetPath -Force
    } else {
        Write-Host "Arquivo temporário não encontrado: $file" -ForegroundColor Gray
    }
}

# 2. Verificar arquivos duplicados de configuração
$configFiles = @(
    @{
        Path = ".\frontend\vite.vercel.config.js"
        Description = "Configuração duplicada do Vite (vite.vercel.config.js)"
    }
)

Write-Host "`nArquivos de configuração duplicados:" -ForegroundColor Yellow
foreach ($configFile in $configFiles) {
    if (Test-Path $configFile.Path) {
        Write-Host "- $($configFile.Description)" -ForegroundColor Red
        $response = Read-Host "   Deseja mover para backup? (S/N)"
        if ($response -eq "S" -or $response -eq "s") {
            $fileName = Split-Path $configFile.Path -Leaf
            $targetPath = Join-Path $tempBackupDir $fileName
            Move-Item -Path $configFile.Path -Destination $targetPath -Force
            Write-Host "   Movido para backup: $targetPath" -ForegroundColor Green
        } else {
            Write-Host "   Mantido no projeto" -ForegroundColor Yellow
        }
    }
}

# 3. Verificar se o build existe
$buildDir = ".\frontend\dist\assets"
if (Test-Path $buildDir) {
    Write-Host "`nVerificando componentes não utilizados no build..." -ForegroundColor Cyan
    
    # Perguntar se deseja executar a análise completa
    $response = Read-Host "Deseja executar a análise completa de componentes não utilizados? Isso pode levar algum tempo. (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        # Executar o script de análise
        if (Test-Path ".\analyze-build-usage.ps1") {
            Write-Host "Executando análise de componentes..." -ForegroundColor Green
            & ".\analyze-build-usage.ps1"
        } else {
            Write-Host "Erro: Script de análise 'analyze-build-usage.ps1' não encontrado!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`nPasta de build não encontrada. Execute 'npm run build' para gerar o build antes de analisar componentes não utilizados." -ForegroundColor Yellow
}

# 4. Remover a pasta node_modules (opcional)
$response = Read-Host "`nDeseja remover a pasta node_modules para liberar espaço? (S/N)"
if ($response -eq "S" -or $response -eq "s") {
    $nodeModulesPath = ".\frontend\node_modules"
    if (Test-Path $nodeModulesPath) {
        Write-Host "Removendo pasta node_modules..." -ForegroundColor Yellow
        Remove-Item -Path $nodeModulesPath -Recurse -Force
        Write-Host "Pasta node_modules removida com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Pasta node_modules não encontrada." -ForegroundColor Gray
    }
}

Write-Host "`nLimpeza concluída!" -ForegroundColor Green
Write-Host "Arquivos temporários foram movidos para: $tempBackupDir" -ForegroundColor Green 