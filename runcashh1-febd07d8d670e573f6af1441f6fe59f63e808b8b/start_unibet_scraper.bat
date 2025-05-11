@echo off
echo Iniciando Scraper WebSocket Unibet
echo ==============================
echo.

REM Verifica se Python está instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Erro: Python nao encontrado. Por favor, instale o Python 3.8 ou superior.
    pause
    exit /b 1
)

REM Verifica se as dependências estão instaladas
echo Verificando dependencias...
pip show websocket-client >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando dependencias...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo Falha ao instalar dependencias.
        pause
        exit /b 1
    )
)

echo.
echo Escolha o metodo de captura:
echo 1 - Conexao direta WebSocket (mais leve)
echo 2 - Proxy com navegador (mais robusto)
echo.

set /p opcao="Digite a opcao (1 ou 2): "

if "%opcao%"=="1" (
    echo.
    echo Iniciando captura via WebSocket direta...
    python unibet_websocket_scraper.py
) else if "%opcao%"=="2" (
    echo.
    echo Verificando Playwright...
    python -c "import playwright" >nul 2>nul
    if %errorlevel% neq 0 (
        echo Instalando Playwright...
        pip install playwright
        python -m playwright install chromium
    )
    
    echo.
    echo Iniciando captura via Proxy Playwright...
    python unibet_proxy_scraper.py
) else (
    echo.
    echo Opcao invalida!
    pause
    exit /b 1
)

pause 