#!/bin/bash
set -e

echo "===== RunCash - Iniciando Serviços no Railway ====="

# Configurar variáveis de ambiente
echo "Configurando variáveis de ambiente para o backend..."
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}

echo "Configurando variáveis de ambiente para o scraper..."
export PYTHONPATH=${PYTHONPATH:-}
export PYTHONUNBUFFERED=1

# Exibir informações do ambiente
echo "PATH: $PATH"
echo "PYTHONPATH: $PYTHONPATH"
echo "Node.js: $(node -v 2>/dev/null || echo 'não instalado')"
echo "NPM: $(npm -v 2>/dev/null || echo 'não instalado')"
echo "Python: $(python3 -V 2>/dev/null || echo 'não instalado')"

# Verificar Python
if command -v python3 &> /dev/null; then
    echo "Python encontrado, verificando dependências..."
    pip install -q requests selenium webdriver-manager pymongo python-dotenv || echo "Aviso: Algumas dependências Python podem estar faltando"
else
    echo "Python não está disponível. Pulando inicialização de serviços Python."
fi

# Verificar Node.js
if command -v node &> /dev/null; then
    echo "Node.js encontrado, iniciando serviço de assinaturas..."
    # Iniciar o serviço Asaas em segundo plano se o arquivo app.js existir
    if [ -f "src/app.js" ]; then
        echo "Iniciando serviço de assinaturas Asaas..."
        node src/app.js &
        ASAAS_PID=$!
        echo "Serviço de assinaturas iniciado com PID: $ASAAS_PID"
    else
        echo "Arquivo src/app.js não encontrado. Não foi possível iniciar o serviço de assinaturas."
    fi
else
    echo "Node.js não está disponível. Pulando inicialização de serviços Node.js."
fi

# Função para encerrar processos filhos ao sair
cleanup() {
    echo "Encerrando processos..."
    if [ ! -z "$ASAAS_PID" ]; then
        kill $ASAAS_PID 2>/dev/null || echo "Processo $ASAAS_PID já encerrado"
    fi
    # Adicionar outros processos aqui se necessário
}

# Registrar função de limpeza para sinais de término
trap cleanup SIGINT SIGTERM

# Aguardar indefinidamente (manterá o contêiner em execução)
echo "Todos os serviços iniciados. Aguardando..."
tail -f /dev/null & wait 