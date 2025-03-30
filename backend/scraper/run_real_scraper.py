#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para executar o scraper em modo real com integração de análise de estratégia
"""

import sys
import time
import logging
import json
import requests
import traceback
from datetime import datetime
import os
import threading
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging para mostrar mais informações
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [RUNCASH_SCRAPER] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # Ensure logs go to stdout for Railway
    ]
)
logger = logging.getLogger(__name__)

# Função para garantir que as mensagens apareçam na aba Deploy Logs do Railway
def log_to_railway(message):
    """Função que garante que os logs apareçam na aba Deploy Logs do Railway"""
    print(message)  # Print direto para stdout
    sys.stdout.flush()  # Forçar flush do buffer para garantir que os logs sejam exibidos imediatamente
    logger.info(message)  # Também registrar usando o logger

# Flag para controlar o heartbeat
RUNNING = True

# Função para enviar heartbeat periódico
def heartbeat_thread():
    """Envia mensagens periódicas para garantir que o script está sendo executado"""
    counter = 0
    while RUNNING:
        counter += 1
        message = f"❤️ HEARTBEAT #{counter} - Scraper em execução | {datetime.now().isoformat()}"
        log_to_railway(message)
        # Mostrar uso de memória, se disponível
        try:
            import psutil
            process = psutil.Process(os.getpid())
            mem_usage = process.memory_info().rss / 1024 / 1024  # em MB
            log_to_railway(f"📊 Memória em uso: {mem_usage:.2f} MB")
        except:
            pass
        time.sleep(60)  # Heartbeat a cada 60 segundos

# Iniciar thread de heartbeat
heartbeat = threading.Thread(target=heartbeat_thread)
heartbeat.daemon = True
heartbeat.start()

# Adicionar logs visíveis para o Railway
print("\n\n")
print("*"*80)
print("*"*80)
print("*"*30 + " INICIANDO SCRAPER RUNCASH " + "*"*30)
print("*"*80)
print("*"*80)
print("\n")

# Usar a função log_to_railway para garantir visibilidade
log_to_railway("🔄 Script run_real_scraper.py iniciando...")
log_to_railway(f"📅 Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log_to_railway(f"📂 Diretório: {os.getcwd()}")
log_to_railway(f"🐍 Python: {sys.version}")
log_to_railway(f"🔧 Variáveis de ambiente carregadas: {os.environ.get('MONGODB_URI') is not None}")
log_to_railway(f"🔌 Railway URL: {os.environ.get('RAILWAY_URL', 'não definido')}")
log_to_railway(f"📊 MongoDB habilitado: {os.environ.get('MONGODB_ENABLED', 'não definido')}")
log_to_railway(f"🔍 Sistema operacional: {sys.platform}")
print("==================================================\n\n")

# Imports locais - reorganizados para evitar importação circular
try:
    from data_source_mongo import MongoDataSource
    from strategy_analyzer import StrategyAnalyzer
    from strategy_helper import atualizar_estrategia
    # Import scraper_mongodb later to avoid circular imports
    logger.info("✅ Módulos básicos importados com sucesso")
except Exception as e:
    logger.error(f"❌ Erro ao importar módulos básicos: {str(e)}")
    traceback.print_exc()
    sys.exit(1)

# Dicionário global para armazenar instâncias de analisadores de estratégia
_strategy_analyzers = {}

# Configuração do WebSocket - usar a URL do Railway
RAILWAY_URL = os.environ.get('RAILWAY_URL', 'https://runcash1-production.up.railway.app')
WEBSOCKET_SERVER_URL = f"{RAILWAY_URL}/emit-event"

# Informações adicionais de MongoDB
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash')
MONGODB_ENABLED = os.environ.get('MONGODB_ENABLED', 'true').lower() in ('true', '1', 't')

# Log da configuração
print('==== Configuração do Scraper ====')
log_to_railway(f"🔌 WebSocket configurado para: {WEBSOCKET_SERVER_URL}")
log_to_railway(f"📊 MongoDB habilitado: {MONGODB_ENABLED}")
log_to_railway(f"📊 MongoDB URI: {MONGODB_URI.replace(':8867Jpp@', ':****@')}")
print('===============================')

def notify_websocket(event_type, data):
    """
    Envia um evento para o servidor WebSocket
    """
    try:
        payload = {
            "event": event_type,
            "data": data
        }
        
        log_to_railway(f"\n[WebSocket] Enviando evento {event_type}:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        response = requests.post(WEBSOCKET_SERVER_URL, json=payload)
        
        if response.status_code == 200:
            log_to_railway(f"[WebSocket] ✅ Evento {event_type} enviado com sucesso")
        else:
            print(f"[WebSocket] ❌ Falha ao enviar evento: {response.status_code} - {response.text}")
            logger.error(f"[WebSocket] ❌ Falha ao enviar evento: {response.status_code} - {response.text}")
    
    except Exception as e:
        print(f"[WebSocket] ❌ Erro ao notificar WebSocket: {str(e)}")
        logger.error(f"[WebSocket] ❌ Erro ao notificar WebSocket: {str(e)}")
        traceback.print_exc()

def get_analyzer(roleta_id, roleta_nome):
    """
    Obtém ou cria uma instância do analisador de estratégia para uma roleta
    """
    global _strategy_analyzers
    
    # Criar chave global única para esta roleta
    key = f"{roleta_id}:{roleta_nome}"
    
    # Se já existe um analisador para esta roleta, retorná-lo
    if key in _strategy_analyzers:
        return _strategy_analyzers[key]
    
    # Caso contrário, criar uma nova instância
    try:
        logger.info(f"\n[Estratégia] 🎲 Criando novo analisador para roleta: {roleta_nome}")
        analyzer = StrategyAnalyzer(table_name=roleta_nome)
        _strategy_analyzers[key] = analyzer
        return analyzer
    except Exception as e:
        logger.error(f"[Estratégia] ❌ Erro ao criar analisador: {str(e)}")
        return None

def generate_display_suggestion(estado, terminais):
    """
    Gera uma sugestão de exibição baseada no estado da estratégia
    """
    if estado == "NEUTRAL":
        return "AGUARDANDO GATILHO"
    elif estado == "TRIGGER" and terminais:
        return f"APOSTAR EM: {','.join(map(str, terminais))}"
    elif estado == "POST_GALE_NEUTRAL" and terminais:
        return f"GALE EM: {','.join(map(str, terminais))}"
    elif estado == "MORTO":
        return "AGUARDANDO PRÓXIMO CICLO"
    
    return ""

def process_new_number(db, roleta_id, roleta_nome, numero):
    """
    Processa um novo número com o analisador de estratégia e atualiza no MongoDB
    """
    print(f"\n{'='*50}")
    print(f"🎲 NOVO NÚMERO DETECTADO")
    print(f"📍 Roleta: {roleta_nome}")
    print(f"🔢 Número: {numero}")
    print(f"{'='*50}")
    
    try:
        # Obter o analisador para esta roleta
        analyzer = get_analyzer(roleta_id, roleta_nome)
        
        if not analyzer:
            print(f"❌ Não foi possível obter analisador para roleta {roleta_nome}")
            logger.error(f"❌ Não foi possível obter analisador para roleta {roleta_nome}")
            return None
        
        # Adicionar o novo número
        analyzer.add_number(numero)
        
        # Obter o status atual da estratégia
        data = analyzer.get_data()
        estrategia = data.get("estrategia", {})
        
        # Atualizar no MongoDB
        log_to_railway(f"\n[MongoDB] 💾 Atualizando estratégia para roleta {roleta_nome}")
        
        atualizar_estrategia(
            roleta_id=roleta_id,
            roleta_nome=roleta_nome,
            estado=estrategia.get("estado", "NEUTRAL"),
            numero_gatilho=estrategia.get("numero_gatilho", -1),
            terminais_gatilho=estrategia.get("terminais_gatilho", []),
            vitorias=estrategia.get("vitorias", 0),
            derrotas=estrategia.get("derrotas", 0)
        )
        
        # Notificar o WebSocket sobre o novo número
        event_data = {
            "roleta_id": roleta_id,
            "roleta_nome": roleta_nome,
            "numero": numero,
            "timestamp": datetime.now().isoformat()
        }
        notify_websocket("new_number", event_data)
        
        # Notificar o WebSocket sobre a atualização da estratégia
        strategy_data = {
            "roleta_id": roleta_id,
            "roleta_nome": roleta_nome,
            "estado": estrategia.get("estado", "NEUTRAL"),
            "numero_gatilho": estrategia.get("numero_gatilho", -1),
            "terminais_gatilho": estrategia.get("terminais_gatilho", []),
            "vitorias": estrategia.get("vitorias", 0),
            "derrotas": estrategia.get("derrotas", 0),
            "display_suggestion": generate_display_suggestion(
                estrategia.get("estado", "NEUTRAL"),
                estrategia.get("terminais_gatilho", [])
            ),
            "timestamp": datetime.now().isoformat()
        }
        notify_websocket("strategy_update", strategy_data)
        
        # Mostrar resumo da estratégia
        log_to_railway(f"\n[Estratégia] 📊 Status Atual:")
        print(f"Estado: {estrategia.get('estado', 'NEUTRAL')}")
        print(f"Vitórias: {estrategia.get('vitorias', 0)}")
        print(f"Derrotas: {estrategia.get('derrotas', 0)}")
        if estrategia.get('terminais_gatilho'):
            print(f"Terminais: {estrategia.get('terminais_gatilho', [])}")
        print(f"{'='*50}\n")
        
        return estrategia
    
    except Exception as e:
        print(f"❌ Erro ao processar número {numero} para roleta {roleta_nome}: {str(e)}")
        logger.error(f"❌ Erro ao processar número {numero} para roleta {roleta_nome}: {str(e)}")
        traceback.print_exc()
        return None

def main():
    """
    Função principal para executar o scraper em modo real
    """
    print("\n🚀 Iniciando scraper REAL com integração de análise de estratégia...")
    
    try:
        # Inicializar fonte de dados MongoDB
        print("Conectando ao MongoDB...")
        db = MongoDataSource()
        print("✅ Conexão ao MongoDB estabelecida com sucesso")
        
        # Importar scraper_mongodb aqui para evitar importação circular
        try:
            from scraper_mongodb import scrape_roletas
            logger.info("✅ Módulo scraper_mongodb importado com sucesso")
        except Exception as e:
            logger.error(f"❌ Erro ao importar scraper_mongodb: {str(e)}")
            traceback.print_exc()
            return 1
        
        # Hook para processar números da roleta
        def numero_hook(roleta_id, roleta_nome, numero):
            """
            Hook chamado quando um novo número é detectado pelo scraper
            """
            # Processar o número com o analisador de estratégia
            log_to_railway(f"📍 Processando número {numero} para roleta {roleta_nome}")
            status = process_new_number(db, roleta_id, roleta_nome, numero)
            
            if not status:
                print(f"❌ Falha ao processar número {numero} para estratégia")
        
        print("\n🎰 Executando em modo REAL - Acessando site da casa de apostas")
        
        # Executar o scraper real com o hook
        scrape_roletas(db, numero_hook=numero_hook)
        
        return 0
        
    except Exception as e:
        print(f"💥 Erro ao executar scraper: {str(e)}")
        logger.error(f"💥 Erro ao executar scraper: {str(e)}")
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    try:
        print("🏁 Iniciando script run_real_scraper.py")
        exit_code = main()
        print(f"🛑 Script encerrado com código: {exit_code}")
        RUNNING = False  # Parar o heartbeat
        sys.exit(exit_code)
    except Exception as e:
        print(f"💥 Erro crítico não tratado: {str(e)}")
        logger.critical(f"💥 Erro crítico não tratado: {str(e)}")
        traceback.print_exc()
        RUNNING = False  # Parar o heartbeat
        sys.exit(1)