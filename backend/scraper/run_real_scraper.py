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

## ADICIONANDO CONFIGURAÇÃO DO SELENIUM HEADLESS E XVFB

# Importar módulos necessários para o Selenium headless
try:
    print("Configurando ambiente para Selenium headless...")
    import os
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    
    # Verificar se devemos usar Xvfb
    if hasattr(config, 'USE_XVFB') and config.USE_XVFB:
        try:
            print("Iniciando servidor X virtual (Xvfb)...")
            from pyvirtualdisplay import Display
            display = Display(visible=0, size=(1920, 1080))
            display.start()
            print("✅ Servidor X virtual iniciado com sucesso")
        except Exception as e:
            print(f"⚠️ Erro ao iniciar Xvfb: {e}")
            print("Continuando sem Xvfb...")
    
    # Configurar opções do Firefox otimizadas para Railway
    def configurar_firefox_railway():
        print("Configurando Firefox otimizado para Railway...")
        options = FirefoxOptions()
        
        # Aplicar opções do config
        if hasattr(config, 'SELENIUM_OPTIONS'):
            for key, value in config.SELENIUM_OPTIONS.items():
                if key == 'headless':
                    options.headless = value
                else:
                    options.add_argument(f"--{key}={value}" if value is not True else f"--{key}")
        
        # Adicionar argumentos essenciais para Railway
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-extensions")
        options.add_argument("--remote-debugging-port=9222")
        
        return options
    
    # Configurar opções do Chrome otimizadas para Railway
    def configurar_chrome_railway():
        print("Configurando Chrome otimizado para Railway...")
        options = ChromeOptions()
        
        # Aplicar opções do config
        if hasattr(config, 'SELENIUM_OPTIONS'):
            for key, value in config.SELENIUM_OPTIONS.items():
                options.add_argument(f"--{key}={value}" if value is not True else f"--{key}")
        
        # Adicionar argumentos essenciais para Railway
        options.add_argument("--headless")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-extensions")
        options.add_argument("--remote-debugging-port=9222")
        
        return options
    
    print("✅ Configuração do Selenium headless concluída")
except Exception as e:
    print(f"⚠️ Erro ao configurar ambiente Selenium headless: {e}")

## FIM DA CONFIGURAÇÃO DO SELENIUM HEADLESS

# Adicionar funções de inicialização do WebDriver modificadas
def iniciar_firefox_railway():
    try:
        print("Iniciando Firefox otimizado para Railway...")
        options = configurar_firefox_railway()
        driver = webdriver.Firefox(options=options)
        driver.set_page_load_timeout(60)
        print("✅ Firefox iniciado com sucesso no Railway")
        return driver
    except Exception as e:
        print(f"❌ Erro ao iniciar Firefox no Railway: {e}")
        return None

def iniciar_chrome_railway():
    try:
        print("Iniciando Chrome otimizado para Railway...")
        options = configurar_chrome_railway()
        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(60)
        print("✅ Chrome iniciado com sucesso no Railway")
        return driver
    except Exception as e:
        print(f"❌ Erro ao iniciar Chrome no Railway: {e}")
        return None

# Adicionar suporte para acesso direto via API
try:
    print("Configurando acesso via API direta...")
    import requests
    import json
    import time
    import random
    from datetime import datetime
    
    # Configurar sessão com headers adequados
    def criar_sessao_api():
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://casino.com/',
            'Origin': 'https://casino.com'
        })
        return session
    
    # Função para acessar API do Pragmatic Play
    def acessar_api_pragmatic(session, endpoint="tables?limit=100"):
        try:
            base_url = config.DIRECT_API_ENDPOINTS.get("pragmatic")
            url = f"{base_url}/{endpoint}"
            print(f"Acessando API Pragmatic: {url}")
            
            response = session.get(url, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Erro ao acessar API Pragmatic: {response.status_code}")
                return None
        except Exception as e:
            print(f"Exceção ao acessar API Pragmatic: {e}")
            return None
    
    # Função para processar dados de roleta da Pragmatic
    def processar_dados_pragmatic(data):
        if not data or "data" not in data:
            return []
            
        roletas = []
        for item in data.get("data", []):
            if item.get("game") == "roulette":
                nome_roleta = item.get("name", "")
                if "roulette" in nome_roleta.lower():
                    # Extrair informações da roleta
                    roleta_id = item.get("id", "")
                    numeros_recentes = item.get("statistics", {}).get("results", [])
                    roletas.append({
                        "nome": nome_roleta,
                        "id": roleta_id,
                        "numeros_recentes": numeros_recentes,
                        "provider": "pragmatic"
                    })
        
        print(f"Encontradas {len(roletas)} roletas Pragmatic via API direta")
        return roletas
    
    # Função principal para obter dados via API direta
    def obter_dados_via_api():
        print("Iniciando coleta de dados via API direta...")
        session = criar_sessao_api()
        
        # Coletar dados da Pragmatic
        dados_pragmatic = acessar_api_pragmatic(session)
        roletas_pragmatic = processar_dados_pragmatic(dados_pragmatic)
        
        # Aqui você pode adicionar outras APIs conforme necessário
        
        # Retornar todos os dados coletados
        return roletas_pragmatic
    
    print("✅ Configuração de acesso via API direta concluída")
except Exception as e:
    print(f"⚠️ Erro ao configurar acesso via API direta: {e}")

# Modificar a função principal para usar API direta quando configurado
def coletar_dados_roletas():
    """Coleta dados de roletas usando o método apropriado (API direta ou navegador)"""
    if hasattr(config, 'USE_DIRECT_API') and config.USE_DIRECT_API:
        # Usar método de API direta
        print("Usando método de API direta para coletar dados...")
        return obter_dados_via_api()
    else:
        # Usar método de automação com navegador (código existente)
        print("Usando método de automação com navegador para coletar dados...")
        # Chamar a função original de scraping aqui
        return scrape_roletas()  # ou a função original que você usava

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