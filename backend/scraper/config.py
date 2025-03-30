#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Configurações do sistema de scraper de roletas
"""

import os
import logging
import platform
from datetime import datetime
from dotenv import load_dotenv
import sys

# Carregar variáveis de ambiente do arquivo .env se existir
load_dotenv()

# Configurações de ambiente
AMBIENTE_PROD = os.environ.get('PRODUCTION', '').lower() in ('true', '1', 't') or \
                os.environ.get('RENDER', '').lower() in ('true', '1', 't')

# Modo de simulação (padrão: True se não estiver em produção)
MODO_SIMULACAO = False  # Forçando modo real, não simulado

# Versão da API
API_VERSION = "1.0.0"

# URL do casino para scraping
CASINO_URL = os.environ.get('CASINO_URL', 'https://888casino.com/live-casino/#filters=live-roulette')

# Seletor CSS para encontrar as roletas no site
# Pode variar dependendo do site do casino
ROLETA_CSS_SELECTOR = os.environ.get('ROLETA_CSS_SELECTOR', '.cy-live-casino-grid-item')

# Configurações de intervalos
SCRAPE_INTERVAL_MINUTES = int(os.environ.get('SCRAPE_INTERVAL_MINUTES', '5'))
HEALTH_CHECK_INTERVAL = int(os.environ.get('HEALTH_CHECK_INTERVAL', '60'))  # Em segundos
MAX_CICLOS = int(os.environ.get('MAX_CICLOS', '1000'))
MAX_ERROS_CONSECUTIVOS = int(os.environ.get('MAX_ERROS_CONSECUTIVOS', '5'))

# Configurações do servidor
DEFAULT_HOST = os.environ.get('HOST', '0.0.0.0')
DEFAULT_PORT = int(os.environ.get('PORT', '5000'))

# Configurações de banco de dados
# Supabase
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
SUPABASE_ENABLED = os.environ.get('SUPABASE_ENABLED', '').lower() in ('true', '1', 't')

# MongoDB
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash')
MONGODB_DB_NAME = os.environ.get('MONGODB_DB_NAME', 'runcash')
MONGODB_ENABLED = os.environ.get('MONGODB_ENABLED', 'true').lower() in ('true', '1', 't')

# URL do Railway para envio de eventos
RAILWAY_URL = os.environ.get('RAILWAY_URL', 'https://runcash1-production.up.railway.app')

# Configuração de segurança
API_KEY = os.environ.get('API_KEY', 'dev_key')

# Importar função de verificação de roletas permitidas
from roletas_permitidas import roleta_permitida_por_id

# Configuração de logging
logger = logging.getLogger('runcash')

def configurar_logging():
    """Configura o sistema de logging"""
    # Configuração menos silenciosa para debug no Railway
    logging.basicConfig(
        level=logging.INFO,  # Mostrar logs de informação
        format='%(asctime)s - [RUNCASH] - %(levelname)s - %(message)s',  # Formato mais completo
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Silenciar apenas loggers muito verbosos
    for logger_name in ['selenium', 'urllib3']:
        logging.getLogger(logger_name).setLevel(logging.WARNING)
    
    # Configurar o logger principal para mostrar mais informações
    logger.setLevel(logging.INFO)  # Mostrar informações, não só erros críticos
    logger.handlers = []  # Limpar handlers existentes
    
    # Configurar formato para mostrar mais detalhes
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s - [RUNCASH] - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    
    # Mensagem inicial com mais detalhes
    logger.info(f"Log iniciado em {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Sistema operacional: {platform.system()} {platform.version()}")
    logger.info(f"Ambiente: {'Produção' if AMBIENTE_PROD else 'Desenvolvimento'}")
    logger.info(f"MongoDB: {'Habilitado' if MONGODB_ENABLED else 'Desabilitado'}")
    logger.info(f"MongoDB URI: {MONGODB_URI.replace(':8867Jpp@', ':****@')}")  # Ocultar senha
    logger.info(f"Railway URL: {RAILWAY_URL}")
    logger.info(f"Modo simulação: {MODO_SIMULACAO}")
    logger.info(f"Casino URL: {CASINO_URL}")
    
    return logger
