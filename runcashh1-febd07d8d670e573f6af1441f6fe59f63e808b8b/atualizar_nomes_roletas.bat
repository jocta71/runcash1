@echo off
setlocal enabledelayedexpansion

echo ===== ATUALIZAR NOMES DAS ROLETAS =====
echo.

REM Verificar se o Python está instalado
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python
    goto :CONTINUE
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PYTHON_CMD=python3
    goto :CONTINUE
)

echo [ERRO] Python nao encontrado. Por favor, instale o Python 3.
echo.
echo Pressione qualquer tecla para sair...
pause >nul
exit /b 1

:CONTINUE
echo Usando Python: %PYTHON_CMD%
echo.

REM Verificar se o script Python existe
if not exist "atualizar_nomes_roletas.py" (
    echo [ERRO] Script 'atualizar_nomes_roletas.py' nao encontrado.
    echo.
    echo Pressione qualquer tecla para sair...
    pause >nul
    exit /b 1
)

REM Verificar se as dependências estão instaladas
echo Verificando dependencias...

%PYTHON_CMD% -c "import pymongo" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Instalando pymongo...
    %PYTHON_CMD% -m pip install pymongo
)

%PYTHON_CMD% -c "import dotenv" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Instalando python-dotenv...
    %PYTHON_CMD% -m pip install python-dotenv
)

echo.
echo Executando script de atualizacao...
echo.

REM Executar o script Python
%PYTHON_CMD% atualizar_nomes_roletas.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCESSO] Atualizacao concluida com sucesso!
) else (
    echo.
    echo [ERRO] Ocorreu um erro durante a atualizacao.
)

echo.
echo Para ver as mudancas, reinicie o servidor ou aguarde o proximo ciclo de atualizacao.
echo.
echo Pressione qualquer tecla para sair...
pause >nul 