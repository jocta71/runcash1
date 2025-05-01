# Script para corrigir problemas de deploy no Vercel
Write-Host "Iniciando correção de problemas de deploy no Vercel..." -ForegroundColor Green

# 1. Verificar e atualizar vercel.json na raiz do projeto
$rootVercelExists = Test-Path ".\vercel.json"
$rootVercelFixed = $false

if (!$rootVercelExists) {
    Write-Host "Arquivo vercel.json na raiz não encontrado. Criando..." -ForegroundColor Yellow
    
    $rootVercelJson = @"
{
    "version": 2,
    "builds": [
        {
            "src": "api/**/*.js",
            "use": "@vercel/node"
        },
        {
            "src": "frontend/dist/**/*",
            "use": "@vercel/static"
        }
    ],
    "routes": [
        {
            "src": "/api/(.*)",
            "dest": "/api/\$1"
        },
        {
            "src": "/(.*)",
            "dest": "/frontend/dist/\$1"
        }
    ]
}
"@
    
    Set-Content -Path ".\vercel.json" -Value $rootVercelJson
    Write-Host "Arquivo vercel.json na raiz criado com sucesso!" -ForegroundColor Green
    $rootVercelFixed = $true
} else {
    Write-Host "Arquivo vercel.json na raiz existe. Verificando conteúdo manualmente..." -ForegroundColor Cyan
    Write-Host "Recomendamos verificar se o arquivo contém a configuração de build para o frontend (frontend/dist/**/*)" -ForegroundColor Yellow
}

# 2. Verificar o package.json para build scripts
$packageJsonExists = Test-Path ".\package.json"
$packageJsonFixed = $false

if ($packageJsonExists) {
    Write-Host "Verificando package.json na raiz..." -ForegroundColor Cyan
    $packageJsonContent = Get-Content -Path ".\package.json" -Raw
    
    # Verificar se há scripts de build adequados
    if (!$packageJsonContent.Contains('"build": "cd frontend && npm run build"')) {
        Write-Host "Script de build não configurado corretamente. Atualizando manualmente..." -ForegroundColor Yellow
        Write-Host "Recomendamos editar o package.json e garantir que contenha:" -ForegroundColor White
        Write-Host '"build": "cd frontend && npm run build"' -ForegroundColor Cyan
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
    Write-Host "Recomendamos verificar se o arquivo contém as configurações:" -ForegroundColor Yellow
    Write-Host '"framework": "vite",' -ForegroundColor White
    Write-Host '"buildCommand": "npm run build",' -ForegroundColor White
    Write-Host '"outputDirectory": "dist",' -ForegroundColor White
} else {
    Write-Host "Arquivo vercel.json não encontrado no frontend. Criando..." -ForegroundColor Yellow
    
    $frontendVercelJson = @"
{
    "framework": "vite",
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "installCommand": "npm install",
    "devCommand": "npm run dev",
    "rewrites": [
        { "source": "/(.*)", "destination": "/index.html" }
    ],
    "github": {
        "silent": true
    }
}
"@
    
    Set-Content -Path ".\frontend\vercel.json" -Value $frontendVercelJson
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
        Write-Host "Configuração do Vite pode precisar de ajustes. Recomendamos adicionar:" -ForegroundColor Yellow
        Write-Host "base: '/'," -ForegroundColor White
        Write-Host "build: { outDir: 'dist', ... }" -ForegroundColor White
    }
}

# Resumo das alterações
Write-Host "`nResumo das correções:" -ForegroundColor Green
if ($rootVercelFixed) {
    Write-Host "- vercel.json na raiz foi criado" -ForegroundColor Cyan
}
if ($packageJsonFixed) {
    Write-Host "- package.json foi atualizado com script de build correto" -ForegroundColor Cyan
}
if ($frontendVercelFixed) {
    Write-Host "- vercel.json no frontend foi criado" -ForegroundColor Cyan
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