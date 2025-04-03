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

# Importar os módulos do scraper
try:
    from scraper_mongodb import scrape_roletas, simulate_roulette_data
    from data_source_mongo import MongoDataSource
    import mongo_config
    print("[INFO] ✅ Módulos do scraper importados com sucesso")
except ImportError as e:
    print(f"[ERRO CRÍTICO] ❌ Erro ao importar módulos do scraper: {str(e)}")
    sys.exit(1)

# Flag para controle de início/parada
executing = True

# Flag para indicar se está executando em modo de simulação
simulation_mode = False

def signal_handler(sig, frame):
    """
    Manipulador de sinais para interrupção limpa
    """
    global executing
    print("\n[INFO] 🛑 Recebido sinal de interrupção. Encerrando scraper...")
    executing = False
    sys.exit(0)

def iniciar_servidor_flask():
    """
    Inicia o servidor Flask em uma thread separada
    """
    try:
        # Importar o módulo server que contém a aplicação Flask
        from server import app, start_server
        
        print("[INFO] 🌐 Iniciando servidor Flask para API...")
        
        # Configurar host e porta a partir das variáveis de ambiente
        host = os.environ.get('HOST', '0.0.0.0')
        port = int(os.environ.get('PORT', 8080))
        debug = False  # Sempre falso para evitar problemas com o Flask em thread
        
        # Iniciar servidor em uma thread
        flask_thread = threading.Thread(
            target=lambda: app.run(host=host, port=port, debug=debug, use_reloader=False, threaded=True),
            daemon=True
        )
        flask_thread.start()
        
        print(f"[INFO] ✅ Servidor Flask iniciado em {host}:{port}")
        return flask_thread
    except Exception as e:
        print(f"[ERRO] ❌ Falha ao iniciar servidor Flask: {str(e)}")
        traceback.print_exc()
        return None

def main():
    """
    Função principal do scraper
    """
    global executing, simulation_mode
    
    # Registrar manipulador de sinal para CTRL+C
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Banner de inicialização
        logger.info("🚀 Iniciando scraper de roletas (modo de extração simplificada)")
        logger.info(f"📅 Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verificar variáveis de ambiente
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/runcash')
        db_name = os.environ.get('MONGODB_DB_NAME', 'runcash')
        min_cycle_time = int(os.environ.get('MIN_CYCLE_TIME', 10))  # Tempo mínimo entre ciclos
        max_errors = int(os.environ.get('MAX_ERRORS', 5))  # Máximo de erros antes de reiniciar
        
        # Log das configurações
        logger.info(f"🔌 Conectando a MongoDB: {mongodb_uri.split('@')[-1]}")
        logger.info(f"📊 Nome do banco de dados: {db_name}")
        logger.info(f"⏱️ Tempo mínimo entre ciclos: {min_cycle_time} segundos")
        
        # Verificar modo de simulação
        simulation_mode = os.environ.get('SIMULATION_MODE', '').lower() in ('true', '1', 'yes')
        if simulation_mode:
            logger.info("🧪 MODO DE SIMULAÇÃO ATIVADO - Gerando dados fictícios")
        
        # Inicializar a fonte de dados - corrigido para não passar argumentos
        # O MongoDataSource já lê as variáveis de ambiente internamente
        data_source = MongoDataSource()
        
        # Iniciar o servidor Flask em uma thread separada
        flask_thread = iniciar_servidor_flask()
        if not flask_thread:
            logger.warning("⚠️ Servidor Flask não pôde ser iniciado, continuando apenas com o scraper")
        
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
                
                if simulation_mode:
                    # Modo de simulação - gerar dados fictícios
                    simulate_roulette_data(data_source)
                    logger.info("🎲 Dados de simulação gerados com sucesso")
                else:
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
        logger.info("🛑 Scraper encerrado")

if __name__ == "__main__":
    # Executar a função principal
    main()