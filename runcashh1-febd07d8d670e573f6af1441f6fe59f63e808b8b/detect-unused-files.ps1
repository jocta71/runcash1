# Script para detectar arquivos potencialmente não utilizados
Write-Host "Verificando arquivos potencialmente não utilizados..."
Write-Host "Isso pode levar alguns minutos dependendo do tamanho do projeto."

$files = Get-ChildItem -Path .\frontend\src -Recurse -Include *.ts,*.tsx,*.js,*.jsx
$unusedFiles = @()

foreach ($file in $files) {
    $basename = $file.Name
    $basenameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($basename)

    # Ignorar arquivos especiais como index.ts, global.d.ts, etc.
    if ($basenameWithoutExt -eq "index" -or $basename -match "\.d\.ts$" -or $basename -eq "vite-env.d.ts") {
        continue
    }

    # Buscar por importações no projeto (ignorando arquivos de teste e o próprio arquivo)
    $content = Select-String -Path .\frontend\src\*.ts,.\frontend\src\*.tsx,.\frontend\src\*.js,.\frontend\src\*.jsx `
        -Pattern "from\s+['\`"].*$basenameWithoutExt['\`"]|import\s+.*$basenameWithoutExt|require\(['\`"].*$basenameWithoutExt['\`"]\)" `
        -Exclude $file.FullName,*test*,*spec*

    if ($content.Count -eq 0) {
        $unusedFiles += $file.FullName
        Write-Host "Potencialmente não utilizado: $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Total de arquivos potencialmente não utilizados: $($unusedFiles.Count)" -ForegroundColor Cyan
Write-Host ""

# Verificar se os arquivos estão listados em algum index.ts/js
Write-Host "Verificando se os arquivos estão exportados em arquivos index..."

$indexFiles = Get-ChildItem -Path .\frontend\src -Recurse -Include index.ts,index.tsx,index.js,index.jsx
$indirectlyUsedFiles = @()

foreach ($unusedFile in $unusedFiles) {
    $unusedBasename = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileName($unusedFile))
    
    foreach ($indexFile in $indexFiles) {
        $indexContent = Get-Content $indexFile.FullName -Raw
        if ($indexContent -match "from\s+['\`"].*$unusedBasename['\`"]|export\s+.*$unusedBasename") {
            $indirectlyUsedFiles += $unusedFile
            Write-Host "Exportado em index: $unusedFile → $($indexFile.FullName)" -ForegroundColor Green
            break
        }
    }
}

$realUnusedFiles = $unusedFiles | Where-Object { $indirectlyUsedFiles -notcontains $_ }

Write-Host ""
Write-Host "Arquivos realmente não utilizados: $($realUnusedFiles.Count)" -ForegroundColor Red
$realUnusedFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
Write-Host ""

# Verificar se os arquivos são componentes React (podem estar sendo usados dinamicamente)
Write-Host "Verificando se os arquivos são componentes React que podem estar sendo usados dinamicamente..."

$reactComponents = @()
foreach ($file in $realUnusedFiles) {
    $content = Get-Content $file -Raw
    if ($content -match "export\s+default|React\.Component|function\s+\w+\s*\(.*\)\s*{.*return\s+\(" -or 
        $content -match "const\s+\w+\s*=\s*\(.*\)\s*=>\s*{.*return\s+\(" -or
        $content -match "import\s+.*React") {
        $reactComponents += $file
        Write-Host "Possível componente React: $file" -ForegroundColor Blue
    }
}

Write-Host ""
Write-Host "Resumo da análise:"
Write-Host "- Total de arquivos verificados: $($files.Count)"
Write-Host "- Arquivos potencialmente não utilizados: $($unusedFiles.Count)"
Write-Host "- Arquivos exportados em index files: $($indirectlyUsedFiles.Count)"
Write-Host "- Possíveis componentes React: $($reactComponents.Count)"
Write-Host "- Arquivos realmente não utilizados (excluindo React): $($realUnusedFiles.Count - $reactComponents.Count)" -ForegroundColor Red 