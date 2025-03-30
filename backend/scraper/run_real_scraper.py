#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para executar o scraper em modo real com integração de análise de estratégia
"""

import sys
import os

# Adicionar diretórios específicos ao path antes de qualquer importação
sys.path.insert(0, '/usr/local/lib/python3.10/dist-packages')  # Pacotes globais
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # Diretório atual

# Diagnóstico do ambiente
print(f"Python Version: {sys.version}", flush=True)
print(f"Python Path: {sys.path}", flush=True)
print(f"Current Directory: {os.getcwd()}", flush=True)
print(f"Script Location: {__file__}", flush=True)
print(f"Directory Contents: {os.listdir('.')}", flush=True)

# Importações básicas
try:
    print("Importando módulos essenciais...", flush=True)
    import time
    import logging
    import json
    import traceback
    from datetime import datetime
    import threading
    from dotenv import load_dotenv
    import subprocess
    import requests
    print("✅ Módulos básicos importados com sucesso", flush=True)
except ImportError as e:
    print(f"⚠️ Erro ao importar módulos: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Carregar variáveis de ambiente
load_dotenv()

# Configuração de logging básica - desativar para evitar duplicação
logging.basicConfig(level=logging.WARNING)  # Reduzir nível de log para evitar duplicação
logger = logging.getLogger(__name__)

# Função simples para logging no Railway
def railway_log(message):
    print(message, flush=True)  # flush=True força a saída imediata

# Log inicial super simples
print("\n\n", flush=True)
print("********** INICIANDO SCRAPER RUNCASH **********", flush=True)
print(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
print(f"Diretório: {os.getcwd()}", flush=True)
print(f"Python: {sys.version}", flush=True)
print("\n\n", flush=True)

# Flag para controlar o heartbeat
RUNNING = True

# Função para enviar heartbeat periódico
def heartbeat_thread():
    """Envia mensagens periódicas para garantir que o script está sendo executado"""
    counter = 0
    while RUNNING:
        counter += 1
        print(f"HEARTBEAT #{counter} - Scraper em execução | {datetime.now().isoformat()}", flush=True)
        time.sleep(30)  # Heartbeat a cada 30 segundos

# Iniciar thread de heartbeat
try:
    print("Iniciando thread de heartbeat...", flush=True)
    heartbeat = threading.Thread(target=heartbeat_thread)
    heartbeat.daemon = True
    heartbeat.start()
    print("Thread de heartbeat iniciada com sucesso", flush=True)
except Exception as e:
    print(f"Erro ao iniciar thread de heartbeat: {str(e)}", flush=True)

# Tentar instalar pacotes faltantes localmente
try:
    print("Verificando pacotes essenciais...")
    import requests
    print("✅ Pacote 'requests' já está instalado")
except ImportError:
    print("⚠️ Pacote 'requests' não encontrado, tentando instalar...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "requests"])
        print("✅ Pacote 'requests' instalado com sucesso!")
        
        # Adicionar caminho para pacotes instalados com --user ao sys.path
        import site
        import sys
        user_site = site.getusersitepackages()
        if user_site not in sys.path:
            sys.path.insert(0, user_site)
            
        # Agora importa após instalação e ajuste do path
        import requests
        print("✅ Pacote 'requests' importado com sucesso após instalação!")
    except Exception as e:
        print(f"❌ Erro ao instalar 'requests': {e}")
        sys.exit(1)

# Tentar outros imports essenciais
try:
    from selenium import webdriver
    print("✅ Pacote 'selenium' já está instalado")
except ImportError:
    print("⚠️ Pacote 'selenium' não encontrado, tentando instalar...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "selenium"])
        from selenium import webdriver
        print("✅ Pacote 'selenium' instalado com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao instalar 'selenium': {e}")
        sys.exit(1)

# Imports locais - reorganizados para evitar importação circular
try:
    from data_source_mongo import MongoDataSource
    from strategy_analyzer import StrategyAnalyzer
    from strategy_helper import atualizar_estrategia
    # Import scraper_mongodb later to avoid circular imports
    print("Módulos básicos importados com sucesso", flush=True)
except Exception as e:
    print(f"Erro ao importar módulos básicos: {str(e)}", flush=True)
    traceback.print_exc()
    sys.exit(1)

# Configuração do WebSocket e MongoDB
RAILWAY_URL = os.environ.get('RAILWAY_URL', 'https://runcash1-production.up.railway.app')
WEBSOCKET_SERVER_URL = f"{RAILWAY_URL}/emit-event"
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash')
MONGODB_ENABLED = os.environ.get('MONGODB_ENABLED', 'true').lower() in ('true', '1', 't')

# Log da configuração
print('==== Configuração do Scraper ====', flush=True)
print(f"WebSocket URL: {WEBSOCKET_SERVER_URL}", flush=True)
print(f"MongoDB habilitado: {MONGODB_ENABLED}", flush=True)
print(f"MongoDB URI: {MONGODB_URI.replace(':8867Jpp@', ':****@')}", flush=True)
print('===============================', flush=True)

def main():
    """
    Função principal para executar o scraper em modo real
    """
    print("Iniciando scraper REAL com integração de análise de estratégia...", flush=True)
    
    try:
        # Inicializar fonte de dados MongoDB
        print("Conectando ao MongoDB...", flush=True)
        db = MongoDataSource()
        print("Conexão ao MongoDB estabelecida com sucesso", flush=True)
        
        # Importar scraper_mongodb aqui para evitar importação circular
        try:
            print("Importando módulo scraper_mongodb...", flush=True)
            from scraper_mongodb import scrape_roletas
            print("Módulo scraper_mongodb importado com sucesso", flush=True)
        except Exception as e:
            print(f"Erro ao importar scraper_mongodb: {str(e)}", flush=True)
            traceback.print_exc()
            return 1
        
        # Hook simplificado para processar números
        def numero_hook(roleta_id, roleta_nome, numero):
            """Hook chamado quando um novo número é detectado pelo scraper"""
            print(f"NOVO NÚMERO: Roleta={roleta_nome}, Número={numero}", flush=True)
            
            try:
                # Enviar evento via WebSocket
                data = {
                    "roleta_id": roleta_id,
                    "roleta_nome": roleta_nome,
                    "numero": numero,
                    "timestamp": datetime.now().isoformat()
                }
                
                print(f"Enviando evento para WebSocket: {roleta_nome} - {numero}", flush=True)
                requests.post(WEBSOCKET_SERVER_URL, json={"event": "new_number", "data": data})
            except Exception as e:
                print(f"Erro ao processar número: {str(e)}", flush=True)
        
        print("Executando scraper - acessando site da casa de apostas...", flush=True)
        
        # Executar o scraper real com o hook simplificado
        scrape_roletas(db, numero_hook=numero_hook)
        
        return 0
        
    except Exception as e:
        print(f"Erro ao executar scraper: {str(e)}", flush=True)
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    try:
        print("SCRAPER PRINCIPAL INICIANDO", flush=True)
        exit_code = main()
        print(f"Scraper encerrado com código: {exit_code}", flush=True)
        RUNNING = False  # Parar o heartbeat
        sys.exit(exit_code)
    except Exception as e:
        print(f"Erro crítico não tratado: {str(e)}", flush=True)
        traceback.print_exc()
        RUNNING = False  # Parar o heartbeat
        sys.exit(1)