# Script para analisar quais arquivos foram realmente usados no build
Write-Host "Analisando quais arquivos foram incluídos no build..." -ForegroundColor Green

# Diretório de build
$buildDir = ".\frontend\dist\assets"
if (!(Test-Path $buildDir)) {
    Write-Host "Erro: Pasta de build não encontrada em $buildDir" -ForegroundColor Red
    Write-Host "Execute 'npm run build' primeiro para gerar os arquivos de build" -ForegroundColor Yellow
    exit
}

# Obtém o conteúdo dos arquivos JS do build
Write-Host "Extraindo informações dos arquivos de build..." -ForegroundColor Cyan
$buildFiles = Get-ChildItem -Path $buildDir -Filter "*.js"
$allBuildContent = ""

foreach ($file in $buildFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $allBuildContent += $content
}

# Lista todos os componentes no diretório src
Write-Host "Listando todos os componentes no diretório src..." -ForegroundColor Cyan
$allComponentFiles = Get-ChildItem -Path ".\frontend\src\components" -Recurse -Filter "*.tsx" | Where-Object { $_.Name -ne "index.tsx" }

# Lista para componentes usados e não usados
$usedComponents = @()
$unusedComponents = @()

# Verifica cada componente
foreach ($component in $allComponentFiles) {
    $componentName = [System.IO.Path]::GetFileNameWithoutExtension($component.Name)
    
    # Verifica se o nome do componente aparece no conteúdo do build
    if ($allBuildContent -match [regex]::Escape("$componentName")) {
        $usedComponents += $component.FullName
    } else {
        $unusedComponents += $component.FullName
    }
}

# Exibe resultados
Write-Host "`nResultados da Análise:" -ForegroundColor Green
Write-Host "----------------------" -ForegroundColor Green
Write-Host "Total de componentes verificados: $($allComponentFiles.Count)" -ForegroundColor White
Write-Host "Componentes utilizados no build: $($usedComponents.Count)" -ForegroundColor Green
Write-Host "Componentes NÃO utilizados no build: $($unusedComponents.Count)" -ForegroundColor Yellow

# Salva os resultados em arquivos
$usedComponents | Out-File -FilePath ".\frontend\components-used.txt"
$unusedComponents | Out-File -FilePath ".\frontend\components-unused.txt"

Write-Host "`nLista de componentes não utilizados salva em 'frontend\components-unused.txt'" -ForegroundColor Cyan
Write-Host "Lista de componentes utilizados salva em 'frontend\components-used.txt'" -ForegroundColor Cyan

# Perguntar se deseja mover os componentes não utilizados para uma pasta de backup
$response = Read-Host "Deseja mover os componentes não utilizados para uma pasta de backup? (S/N)"
if ($response -eq "S" -or $response -eq "s") {
    $backupDir = ".\frontend\_unused_components_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "Criando diretório de backup: $backupDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    foreach ($component in $unusedComponents) {
        $componentRelative = $component.Replace((Get-Location).Path + "\", "")
        $targetDir = Join-Path $backupDir (Split-Path $componentRelative -Parent).Replace("frontend\", "")
        
        # Criar estrutura de diretórios no backup
        if (!(Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        
        $fileName = Split-Path $component -Leaf
        $targetPath = Join-Path $targetDir $fileName
        
        Write-Host "Movendo $componentRelative para backup..." -ForegroundColor Cyan
        Copy-Item -Path $component -Destination $targetPath -Force
    }
    
    Write-Host "`nTodos os componentes não utilizados foram copiados para: $backupDir" -ForegroundColor Green
    Write-Host "Recomendação: Execute o projeto após essa operação para verificar se tudo ainda funciona corretamente." -ForegroundColor Yellow
    Write-Host "Você pode então decidir excluir permanentemente os arquivos originais." -ForegroundColor Yellow
} else {
    Write-Host "Operação de backup cancelada." -ForegroundColor Yellow
}

# Também verifica arquivos temporários óbvios
$tempFiles = @(
    ".\frontend\temp_index.tsx",
    ".\frontend\temp.tsx",
    ".\frontend\new_index.tsx"
)

Write-Host "`nArquivos temporários que podem ser removidos:" -ForegroundColor Yellow
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        Write-Host "- $file" -ForegroundColor Red
    }
}

Write-Host "`nAnálise concluída!" -ForegroundColor Green 