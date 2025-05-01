# Script para corrigir problemas de deploy no Vercel
Write-Host "Iniciando correção de problemas de deploy no Vercel..." -ForegroundColor Green

# 1. Verificar e atualizar vercel.json na raiz do projeto
$rootVercelExists = Test-Path ".\vercel.json"
$rootVercelFixed = $false

if (!$rootVercelExists) {
    Write-Host "Arquivo vercel.json na raiz não encontrado. Criando..." -ForegroundColor Yellow
    
    $rootVercelJson = @{
        "version" = 2
        "builds" = @(
            @{
                "src" = "api/**/*.js"
                "use" = "@vercel/node"
            },
            @{
                "src" = "frontend/dist/**/*"
                "use" = "@vercel/static"
            }
        )
        "routes" = @(
            @{
                "src" = "/api/(.*)"
                "dest" = "/api/$1"
            },
            @{
                "src" = "/(.*)"
                "dest" = "/frontend/dist/$1"
            }
        )
    }
    
    $rootVercelJson | ConvertTo-Json -Depth 10 | Set-Content -Path ".\vercel.json"
    Write-Host "Arquivo vercel.json na raiz criado com sucesso!" -ForegroundColor Green
    $rootVercelFixed = $true
} else {
    Write-Host "Arquivo vercel.json na raiz existe. Verificando configuração..." -ForegroundColor Cyan
    $vercelContent = Get-Content -Path ".\vercel.json" -Raw | ConvertFrom-Json
    
    # Verificar se a configuração de build para frontend está correta
    $frontendBuildFound = $false
    foreach ($build in $vercelContent.builds) {
        if ($build.src -eq "frontend/dist/**/*" -or $build.src -eq "frontend/**/*" -or $build.src -eq "public/**/*") {
            $frontendBuildFound = $true
            break
        }
    }
    
    if (!$frontendBuildFound) {
        Write-Host "Configuração de build para frontend não encontrada. Atualizando..." -ForegroundColor Yellow
        
        # Adicionar configuração de build para frontend
        $newBuilds = $vercelContent.builds + @{
            "src" = "frontend/dist/**/*"
            "use" = "@vercel/static"
        }
        
        $vercelContent.builds = $newBuilds
        $vercelContent | ConvertTo-Json -Depth 10 | Set-Content -Path ".\vercel.json"
        Write-Host "Configuração de build para frontend adicionada com sucesso!" -ForegroundColor Green
        $rootVercelFixed = $true
    }
}

# 2. Verificar o package.json para build scripts
$packageJsonExists = Test-Path ".\package.json"
$packageJsonFixed = $false

if ($packageJsonExists) {
    Write-Host "Verificando package.json na raiz..." -ForegroundColor Cyan
    $packageJson = Get-Content -Path ".\package.json" -Raw | ConvertFrom-Json
    
    # Verificar se há scripts de build adequados
    if (!$packageJson.scripts.build -or !$packageJson.scripts.build.Contains("cd frontend && npm run build")) {
        Write-Host "Script de build não configurado corretamente. Atualizando..." -ForegroundColor Yellow
        
        $packageJson.scripts.build = "cd frontend && npm run build"
        
        $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path ".\package.json"
        Write-Host "Script de build atualizado com sucesso!" -ForegroundColor Green
        $packageJsonFixed = $true
    }
}

# 3. Verificar a estrutura do diretório frontend
$frontendDistExists = Test-Path ".\frontend\dist"
if (!$frontendDistExists) {
    Write-Host "Diretório de build 'frontend/dist' não encontrado. Executando build..." -ForegroundColor Yellow
    
    # Executar build
    Write-Host "Executando 'npm run build'..." -ForegroundColor Cyan
    npm run build
    
    # Verificar se o build foi bem-sucedido
    if (Test-Path ".\frontend\dist") {
        Write-Host "Build concluído com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "Erro ao executar o build. Verifique os erros acima." -ForegroundColor Red
    }
}

# 4. Verificar se há um arquivo vercel.config.js no frontend que pode estar interferindo
$frontendVercelConfigExists = Test-Path ".\frontend\vercel.config.js"
if ($frontendVercelConfigExists) {
    Write-Host "Arquivo vercel.config.js encontrado no frontend. Pode estar causando conflito." -ForegroundColor Yellow
    $response = Read-Host "Deseja fazer backup e remover este arquivo? (S/N)"
    
    if ($response -eq "S" -or $response -eq "s") {
        Move-Item -Path ".\frontend\vercel.config.js" -Destination ".\frontend\vercel.config.js.bak"
        Write-Host "Arquivo renomeado para vercel.config.js.bak" -ForegroundColor Green
    }
}

# 5. Verificar frontend/vercel.json
$frontendVercelExists = Test-Path ".\frontend\vercel.json"
$frontendVercelFixed = $false

if ($frontendVercelExists) {
    Write-Host "Verificando vercel.json no frontend..." -ForegroundColor Cyan
    $frontendVercel = Get-Content -Path ".\frontend\vercel.json" -Raw | ConvertFrom-Json
    
    # Verificar se a configuração está correta
    if (!$frontendVercel.framework -or $frontendVercel.framework -ne "vite" -or !$frontendVercel.outputDirectory -or $frontendVercel.outputDirectory -ne "dist") {
        Write-Host "Configuração do vercel.json no frontend não está correta. Atualizando..." -ForegroundColor Yellow
        
        $frontendVercel.framework = "vite"
        $frontendVercel.buildCommand = "vite build"
        $frontendVercel.outputDirectory = "dist"
        
        $frontendVercel | ConvertTo-Json -Depth 10 | Set-Content -Path ".\frontend\vercel.json"
        Write-Host "Configuração do vercel.json no frontend atualizada com sucesso!" -ForegroundColor Green
        $frontendVercelFixed = $true
    }
} else {
    Write-Host "Arquivo vercel.json não encontrado no frontend. Criando..." -ForegroundColor Yellow
    
    $frontendVercelJson = @{
        "framework" = "vite"
        "buildCommand" = "vite build"
        "outputDirectory" = "dist"
        "rewrites" = @(
            @{ "source" = "/(.*)", "destination" = "/index.html" }
        )
    }
    
    $frontendVercelJson | ConvertTo-Json -Depth 10 | Set-Content -Path ".\frontend\vercel.json"
    Write-Host "Arquivo vercel.json no frontend criado com sucesso!" -ForegroundColor Green
    $frontendVercelFixed = $true
}

# 6. Verificar arquivos de configuração do Vite
$viteConfigExists = Test-Path ".\frontend\vite.config.ts"
if ($viteConfigExists) {
    Write-Host "Arquivo vite.config.ts encontrado. Verificando configuração..." -ForegroundColor Cyan
    $viteConfig = Get-Content -Path ".\frontend\vite.config.ts" -Raw
    
    # Verificar se a configuração tem base e outDir
    if (!$viteConfig.Contains("base:") -or !$viteConfig.Contains("outDir:")) {
        Write-Host "Configuração do Vite pode precisar de ajustes. Verifique manualmente." -ForegroundColor Yellow
    }
}

# Resumo das alterações
Write-Host "`nResumo das correções:" -ForegroundColor Green
if ($rootVercelFixed) {
    Write-Host "- vercel.json na raiz foi atualizado" -ForegroundColor Cyan
}
if ($packageJsonFixed) {
    Write-Host "- package.json foi atualizado com script de build correto" -ForegroundColor Cyan
}
if ($frontendVercelFixed) {
    Write-Host "- vercel.json no frontend foi atualizado" -ForegroundColor Cyan
}

# Instruções para deploy
Write-Host "`nAgora você pode tentar o deploy no Vercel com os seguintes passos:" -ForegroundColor Green
Write-Host "1. Execute 'vercel' ou 'vercel --prod' no terminal" -ForegroundColor White
Write-Host "2. Siga as instruções de login e confirmação" -ForegroundColor White
Write-Host "3. Certifique-se de que a configuração de projeto detectada seja 'Vite'" -ForegroundColor White
Write-Host "4. Defina o diretório de build como 'frontend/dist' se solicitado" -ForegroundColor White

Write-Host "`nCaso ainda tenha problemas, considere verificar:" -ForegroundColor Yellow
Write-Host "- Se há conflitos entre as configurações da raiz e do frontend" -ForegroundColor White
Write-Host "- Se as variáveis de ambiente estão configuradas corretamente" -ForegroundColor White
Write-Host "- Se há erros específicos no console do Vercel durante o deploy" -ForegroundColor White 