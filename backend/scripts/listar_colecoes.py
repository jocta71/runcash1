#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para listar todas as coleções em todos os bancos de dados MongoDB
"""

import os
import sys
import logging
import traceback
from pymongo import MongoClient
from datetime import datetime

# Configurar diretório de logs
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(log_dir, exist_ok=True)

# Configurar logging para console e arquivo
log_file = os.path.join(log_dir, f"listar_colecoes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [LISTAR_DB] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file)
    ]
)
logger = logging.getLogger('listar_db')

# Variáveis de ambiente
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/')

def main():
    """Função principal para listar coleções"""
    print(f"Iniciando listagem de coleções. Log será salvo em: {log_file}")
    logger.info("=" * 50)
    logger.info(f"Listando todos os bancos e coleções no MongoDB")
    logger.info(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Conectando em: {MONGODB_URI}")
    
    try:
        # Conectar ao MongoDB
        logger.info("Tentando conectar ao MongoDB...")
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        
        # Verificar conexão
        logger.info("Testando conexão...")
        client.admin.command('ping')
        logger.info(f"Conexão MongoDB estabelecida com sucesso")
        
        # Listar todos os bancos de dados
        logger.info("Obtendo lista de bancos de dados...")
        db_names = client.list_database_names()
        logger.info(f"Bancos de dados encontrados: {len(db_names)}")
        logger.info(f"Bancos: {', '.join(db_names)}")
        
        # Filtrar bancos de dados de sistema
        filtered_dbs = [db for db in db_names if db not in ['admin', 'local', 'config']]
        logger.info(f"Bancos não-sistema: {', '.join(filtered_dbs)}")
        
        if not filtered_dbs:
            logger.warning("Nenhum banco de dados não-sistema encontrado")
        
        # Processar cada banco de dados
        for db_name in filtered_dbs:
            try:
                db = client[db_name]
                logger.info(f"\nObtendo coleções para banco: {db_name}")
                collections = db.list_collection_names()
                
                logger.info(f"Banco de dados: {db_name}")
                logger.info(f"Total de coleções: {len(collections)}")
                
                if not collections:
                    logger.info(f"Banco {db_name} não tem coleções")
                    continue
                
                # Categorizar coleções
                numericas = []
                uuid_like = []
                system = []
                outras = []
                
                for col in collections:
                    if col.startswith("system."):
                        system.append(col)
                    elif col.isdigit():
                        numericas.append(col)
                    elif "-" in col and len(col) > 20:
                        uuid_like.append(col)
                    else:
                        outras.append(col)
                
                if numericas:
                    logger.info(f"Coleções numéricas ({len(numericas)}):")
                    for col in numericas:
                        logger.info(f"  - {col}")
                
                if uuid_like:
                    logger.info(f"Coleções tipo UUID ({len(uuid_like)}):")
                    for col in uuid_like:
                        logger.info(f"  - {col}")
                
                if outras:
                    logger.info(f"Outras coleções ({len(outras)}):")
                    for col in outras:
                        logger.info(f"  - {col}")
                
                if system:
                    logger.info(f"Coleções de sistema ({len(system)}): {', '.join(system)}")
            
            except Exception as db_err:
                logger.error(f"Erro ao processar banco {db_name}: {str(db_err)}")
                logger.debug(traceback.format_exc())
            
    except Exception as e:
        logger.error(f"Erro ao conectar ou processar banco de dados: {str(e)}")
        logger.error(traceback.format_exc())
    finally:
        if 'client' in locals():
            client.close()
            logger.info("Conexão MongoDB fechada")
    
    logger.info("Script concluído")
    print(f"Listagem concluída. Verifique o log em: {log_file}")

if __name__ == "__main__":
    main() 