#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de inicialização do scraper real - Versão sem estratégia
Este script apenas extrai números das roletas sem aplicar estratégias
"""

import time
import os
import sys
import threading
import multiprocessing
import signal
import logging
import json
import pymongo
import random
from datetime import datetime, timedelta
import traceback

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [SCRAPER] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('runcash_scraper')
logger.setLevel(logging.INFO)


# Banner inicial
print("\n\n" + "=" * 80)
print(" SCRAPER RunCash - Extração de Números (Versão Simplificada) ".center(80, "="))
print(f" Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "="))
print("=" * 80 + "\n")

# Verificar se estamos em ambiente de produção
IS_PRODUCTION = os.environ.get('PRODUCTION', False)

# Configurar variável de ambiente para o banco de dados roletas_db
os.environ['ROLETAS_MONGODB_DB_NAME'] = 'roletas_db'
logger.info(f"🔧 Configurando banco de dados: {os.environ['ROLETAS_MONGODB_DB_NAME']}")

# Importar os módulos do scraper
try:
    from scraper_mongodb import scrape_roletas
    
    # Tentar importar o adaptador para o novo banco de dados
    try:
        from adaptar_scraper_roletas_db import ScraperAdapter
        ADAPTADOR_DISPONIVEL = True
        logger.info("✅ Adaptador para banco de dados otimizado importado com sucesso")
    except ImportError as e:
        logger.warning(f"⚠️ Adaptador para banco otimizado não disponível: {str(e)}")
        logger.warning("⚠️ Usando fonte de dados MongoDB tradicional")
        ADAPTADOR_DISPONIVEL = False
        from data_source_mongo import MongoDataSource
    
    print("[INFO] ✅ Módulos do scraper importados com sucesso")
except ImportError as e:
    print(f"[ERRO CRÍTICO] ❌ Erro ao importar módulos do scraper: {str(e)}")
    sys.exit(1)

# Flag para controle de início/parada
executing = True

def signal_handler(sig, frame):
    """
    Manipulador de sinais para interrupção limpa
    """
    global executing
    print("\n[INFO] 🛑 Recebido sinal de interrupção. Encerrando scraper...")
    executing = False
    sys.exit(0)

def main():
    """
    Função principal do scraper
    """
    global executing
    
    # Registrar manipulador de sinal para CTRL+C
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Banner de inicialização
        logger.info("🚀 Iniciando scraper de roletas (modo de extração simplificada)")
        logger.info(f"📅 Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verificar variáveis de ambiente
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/runcash')
        min_cycle_time = int(os.environ.get('MIN_CYCLE_TIME', 10))  # Tempo mínimo entre ciclos
        max_errors = int(os.environ.get('MAX_ERRORS', 5))  # Máximo de erros antes de reiniciar
        
        # Log das configurações
        logger.info(f"🔌 Conectando a MongoDB: {mongodb_uri.split('@')[-1]}")
        logger.info(f"📊 Nome do banco de dados: {os.environ['ROLETAS_MONGODB_DB_NAME']}")
        logger.info(f"⏱️ Tempo mínimo entre ciclos: {min_cycle_time} segundos")
        
        # Inicializar a fonte de dados
        if ADAPTADOR_DISPONIVEL:
            logger.info("🔄 Inicializando adaptador para banco otimizado...")
            data_source = ScraperAdapter()
            logger.info("✅ Adaptador inicializado com sucesso")
        else:
            logger.info("🔄 Inicializando fonte de dados MongoDB tradicional...")
            data_source = MongoDataSource()
            logger.info("✅ Fonte de dados inicializada com sucesso")
        
        # Contador de ciclos e erros
        cycle_count = 0
        consecutive_errors = 0
        start_time = time.time()
        
        # Loop principal
        while executing:
            cycle_start = time.time()
            cycle_count += 1
            
            try:
                # Log do início do ciclo
                logger.info(f"🔄 Iniciando ciclo #{cycle_count} de extração")
                
                # Modo real - extrair dados das roletas
                scrape_roletas(data_source)
                logger.info("✅ Extração de números concluída com sucesso")
                
                # Resetar contador de erros após ciclo bem-sucedido
                consecutive_errors = 0
                
            except Exception as e:
                # Incrementar contador de erros consecutivos
                consecutive_errors += 1
                
                # Log do erro
                logger.error(f"❌ Erro durante o ciclo #{cycle_count}: {str(e)}")
                logger.error(traceback.format_exc())
                
                # Verificar se excedeu o limite de erros
                if consecutive_errors >= max_errors:
                    logger.critical(f"🚨 {consecutive_errors} erros consecutivos. Reiniciando o scraper...")
                    break
            
            # Calcular quanto tempo o ciclo levou
            cycle_duration = time.time() - cycle_start
            
            # Calcular tempo de espera para o próximo ciclo
            # Garantir que cada ciclo dure pelo menos o tempo mínimo configurado
            wait_time = max(0, min_cycle_time - cycle_duration)
            
            # Log do fim do ciclo
            logger.info(f"⏱️ Ciclo #{cycle_count} completado em {cycle_duration:.2f}s. "
                       f"Aguardando {wait_time:.2f}s para o próximo ciclo...")
            
            # Aguardar para o próximo ciclo (se o scraper não foi interrompido)
            if executing and wait_time > 0:
                time.sleep(wait_time)
        
        # Calcular estatísticas finais
        total_duration = time.time() - start_time
        logger.info(f"📊 Scraper executado por {total_duration:.2f}s, "
                   f"completando {cycle_count} ciclos.")
        
    except KeyboardInterrupt:
        logger.info("👋 Scraper interrompido pelo usuário")
    except Exception as e:
        logger.critical(f"🚨 Erro crítico no scraper: {str(e)}")
        logger.critical(traceback.format_exc())
    finally:
        # Fechar conexões
        if 'data_source' in locals():
            try:
                if hasattr(data_source, 'fechar'):
                    data_source.fechar()
                    logger.info("✅ Conexões com banco de dados fechadas")
            except Exception as e:
                logger.error(f"❌ Erro ao fechar conexões: {str(e)}")
                
        logger.info("🛑 Scraper encerrado")

if __name__ == "__main__":
    # Executar a função principal
    main() 