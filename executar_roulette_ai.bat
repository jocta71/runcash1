@echo off
echo ============================================================
echo RouletteAi - Executando script em Python
echo ============================================================

REM Tentar executar a versão adaptada com TensorFlow
echo Tentando executar com TensorFlow...
python -c "import tensorflow" 2>nul
if %ERRORLEVEL% EQU 0 (
  echo TensorFlow encontrado, iniciando script adaptado...
  python RouletteAi_adaptado.py
  goto :end
)

REM Se TensorFlow não estiver disponível, perguntar se deseja instalar
echo.
echo TensorFlow nao encontrado.
echo.
set /p RESP="Deseja instalar TensorFlow 2.15? (S/N): "
if /i "%RESP%"=="S" (
  echo.
  echo Instalando TensorFlow, aguarde...
  powershell -ExecutionPolicy Bypass -File instalar_tensor_215.ps1
  
  REM Verificar se instalação foi bem-sucedida
  python -c "import tensorflow" 2>nul
  if %ERRORLEVEL% EQU 0 (
    echo TensorFlow instalado com sucesso. Executando script...
    python RouletteAi_adaptado.py
    goto :end
  ) else (
    echo Falha ao instalar TensorFlow. Executando versao alternativa...
    python runcash_roulette_ai_light.py
    goto :end
  )
) else (
  echo.
  echo Executando versao alternativa sem TensorFlow...
  python runcash_roulette_ai_light.py
)

:end
echo.
echo ============================================================
echo Script finalizado.
echo ============================================================
pause 