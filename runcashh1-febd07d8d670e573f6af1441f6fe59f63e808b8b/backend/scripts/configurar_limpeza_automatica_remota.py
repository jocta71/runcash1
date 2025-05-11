#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para configurar a limpeza automática das coleções UUID no MongoDB remoto
sem depender de cron (usando um loop infinito com sleep)
"""

import re
import os
import sys
import time
import signal
import logging
import argparse
import subprocess
import threading
from pymongo import MongoClient
from datetime import datetime, timedelta

# Configurar diretório de logs
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(log_dir, exist_ok=True)

# Configurar logging para console e arquivo
log_file = os.path.join(log_dir, f"limpeza_automatica_{datetime.now().strftime('%Y%m%d')}.log")

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [LIMPEZA_AUTO] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, mode='a')  # Append mode
    ]
)
logger = logging.getLogger('limpeza_auto')

# String de conexão segura (codificada no script para evitar exposição em variáveis de ambiente)
MONGODB_URI = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=roletas_db"
DB_NAME = "roletas_db"

# Controle de execução
executando = True
thread_limpeza = None
ultima_execucao = None
intervalo_padrao = 24 * 60 * 60  # 24 horas em segundos
proxima_execucao = None

# Padrões para identificar coleções UUID
UUID_PATTERN_ALT = re.compile(r'^[0-9a-f]+-[0-9a-f]+-[0-9a-f]+-[0-9a-f]+-[0-9a-f]+$', re.IGNORECASE)

def is_uuid_collection(collection_name):
    """Verifica se o nome da coleção parece ser um UUID"""
    # Verificar UUID com formato alternativo
    if UUID_PATTERN_ALT.match(collection_name):
        return True
    
    # Verificar se tem formato de hash (muitos caracteres hexadecimais)
    if len(collection_name) > 20 and '-' in collection_name and all(c in '0123456789abcdefABCDEF-' for c in collection_name):
        return True
        
    return False

def limpar_colecoes():
    """Remove coleções UUID do banco de dados"""
    global ultima_execucao
    
    logger.info("=" * 50)
    logger.info(f"Iniciando limpeza automática de coleções UUID")
    logger.info(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # Conectar ao MongoDB
        logger.info("Conectando ao MongoDB remoto...")
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]
        
        # Verificar conexão
        db.command('ping')
        logger.info(f"Conexão ao MongoDB remoto estabelecida com sucesso")
        
        # Listar coleções
        collections = db.list_collection_names()
        logger.info(f"Total de coleções encontradas: {len(collections)}")
        
        # Identificar coleções UUID
        colecoes_uuid = []
        
        for col in collections:
            if is_uuid_collection(col):
                colecoes_uuid.append(col)
        
        logger.info(f"Coleções UUID encontradas: {len(colecoes_uuid)}")
        
        # Remover coleções UUID
        if colecoes_uuid:
            logger.info("Iniciando remoção das coleções...")
            removidas = 0
            
            for colecao in colecoes_uuid:
                try:
                    db.drop_collection(colecao)
                    logger.info(f"Coleção removida: {colecao}")
                    removidas += 1
                except Exception as e:
                    logger.error(f"Erro ao remover coleção {colecao}: {str(e)}")
            
            logger.info(f"Remoção concluída. {removidas} de {len(colecoes_uuid)} coleções removidas.")
        else:
            logger.info("Nenhuma coleção UUID encontrada para remover.")
        
        # Atualizar a última execução
        ultima_execucao = datetime.now()
        
    except Exception as e:
        logger.error(f"Erro durante a limpeza automática: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()
            logger.info("Conexão MongoDB fechada")
    
    logger.info("Limpeza automática concluída")

def thread_limpeza_func(intervalo):
    """Função executada pela thread de limpeza"""
    global executando, proxima_execucao
    
    logger.info(f"Thread de limpeza iniciada. Intervalo: {intervalo} segundos")
    proxima_execucao = datetime.now() + timedelta(seconds=10)  # Primeira execução após 10 segundos
    
    while executando:
        agora = datetime.now()
        
        # Verificar se é hora de executar a limpeza
        if proxima_execucao and agora >= proxima_execucao:
            logger.info(f"Executando limpeza programada")
            limpar_colecoes()
            proxima_execucao = datetime.now() + timedelta(seconds=intervalo)
            logger.info(f"Próxima execução programada para: {proxima_execucao.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Dormir por um tempo curto para não consumir CPU
        time.sleep(1)
    
    logger.info("Thread de limpeza encerrada")

def iniciar_limpeza_automatica(intervalo=intervalo_padrao):
    """Inicia a thread de limpeza automática"""
    global thread_limpeza
    
    if thread_limpeza and thread_limpeza.is_alive():
        logger.warning("Thread de limpeza já está em execução")
        return False
    
    # Criar e iniciar a thread
    thread_limpeza = threading.Thread(target=thread_limpeza_func, args=(intervalo,))
    thread_limpeza.daemon = True
    thread_limpeza.start()
    
    return True

def parar_limpeza_automatica():
    """Para a thread de limpeza automática"""
    global executando, thread_limpeza
    
    if not thread_limpeza or not thread_limpeza.is_alive():
        logger.warning("Thread de limpeza não está em execução")
        return False
    
    # Sinalizar que a thread deve parar
    executando = False
    
    # Aguardar a thread terminar
    thread_limpeza.join(timeout=5)
    
    if thread_limpeza.is_alive():
        logger.warning("A thread de limpeza não terminou normalmente")
        return False
    
    return True

def manipular_sinal(signum, frame):
    """Manipulador de sinais para encerramento limpo"""
    logger.info(f"Sinal recebido: {signum}. Encerrando...")
    
    # Parar a thread de limpeza
    parar_limpeza_automatica()
    
    # Encerrar o programa
    sys.exit(0)

def parse_args():
    """Analisar argumentos da linha de comando"""
    parser = argparse.ArgumentParser(
        description='Configura a limpeza automática de coleções UUID no MongoDB remoto'
    )
    
    parser.add_argument(
        '-i', '--intervalo',
        type=int,
        default=intervalo_padrao,
        help=f'Intervalo em segundos entre as limpezas (padrão: {intervalo_padrao})'
    )
    
    parser.add_argument(
        '--limpar-agora',
        action='store_true',
        help='Executa uma limpeza imediatamente ao iniciar'
    )
    
    return parser.parse_args()

def main():
    """Função principal"""
    global executando
    
    # Analisar argumentos
    args = parse_args()
    
    # Configurar manipuladores de sinais
    signal.signal(signal.SIGINT, manipular_sinal)   # Ctrl+C
    signal.signal(signal.SIGTERM, manipular_sinal)  # kill
    
    print("=" * 70)
    print("LIMPEZA AUTOMÁTICA DE COLEÇÕES UUID DO MONGODB REMOTO")
    print("=" * 70)
    print("")
    print(f"Banco de dados alvo: {DB_NAME}")
    print(f"Log será salvo em: {log_file}")
    print(f"Intervalo de limpeza: {args.intervalo} segundos")
    print("")
    
    # Executar limpeza imediata se solicitado
    if args.limpar_agora:
        print("Executando limpeza inicial...")
        limpar_colecoes()
    
    # Iniciar thread de limpeza automática
    print("Iniciando limpeza automática...")
    if iniciar_limpeza_automatica(args.intervalo):
        print(f"Limpeza automática iniciada com sucesso!")
        print(f"Pressione Ctrl+C para encerrar.")
        print("")
        
        try:
            # Manter o programa em execução
            while executando:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nEncerrando...")
        finally:
            # Garantir que a thread seja encerrada
            parar_limpeza_automatica()
    else:
        print("Falha ao iniciar a limpeza automática")

if __name__ == "__main__":
    main() 