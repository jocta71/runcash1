#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para remover coleções UUID do banco de dados roletas_db

Uso:
    python remover_colecoes_uuid.py         # Modo interativo
    python remover_colecoes_uuid.py --auto  # Modo automático (sem confirmação)
"""

import re
import os
import sys
import logging
import argparse
from pymongo import MongoClient
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [REMOVER_UUID] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('remover_uuid')

# Variáveis de ambiente
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('ROLETAS_MONGODB_DB_NAME', 'roletas_db')

# Padrões para identificar coleções UUID
# Padrão padrão de UUID
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

# Padrão observado na imagem (formato com hífens e caracteres hexadecimais)
UUID_PATTERN_ALT = re.compile(r'^[0-9a-f]+-[0-9a-f]+-[0-9a-f]+-[0-9a-f]+-[0-9a-f]+$', re.IGNORECASE)

def is_uuid_collection(collection_name):
    """Verifica se o nome da coleção parece ser um UUID"""
    # Verificar pelos dois padrões
    if UUID_PATTERN.match(collection_name) or UUID_PATTERN_ALT.match(collection_name):
        return True
    
    # Verificar se tem formato de hash (muitos caracteres hexadecimais)
    if len(collection_name) > 20 and all(c in '0123456789abcdefABCDEF-' for c in collection_name):
        return True
        
    return False

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Remove UUID collections from MongoDB')
    parser.add_argument('--auto', action='store_true', help='Run in automatic mode without confirmation')
    return parser.parse_args()

def main():
    """Função principal para remover coleções UUID"""
    args = parse_args()
    auto_mode = args.auto
    
    logger.info("=" * 50)
    logger.info(f"Iniciando remoção de coleções UUID do banco {DB_NAME}")
    logger.info(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Modo: {'Automático' if auto_mode else 'Interativo'}")
    
    try:
        # Conectar ao MongoDB
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        
        # Verificar conexão
        db.command('ping')
        logger.info(f"Conexão MongoDB estabelecida com sucesso")
        
        # Listar todas as coleções
        colecoes = db.list_collection_names()
        logger.info(f"Total de coleções encontradas: {len(colecoes)}")
        
        # Identificar coleções UUID
        colecoes_uuid = []
        colecoes_numericas = []
        outras_colecoes = []
        
        for colecao in colecoes:
            if is_uuid_collection(colecao):
                colecoes_uuid.append(colecao)
            elif colecao.isdigit():
                colecoes_numericas.append(colecao)
            else:
                outras_colecoes.append(colecao)
        
        logger.info(f"Coleções UUID encontradas: {len(colecoes_uuid)}")
        logger.info(f"Coleções numéricas encontradas: {len(colecoes_numericas)}")
        logger.info(f"Outras coleções encontradas: {len(outras_colecoes)}")
        
        # Listar coleções UUID encontradas
        if colecoes_uuid:
            logger.info("Coleções UUID identificadas:")
            for i, colecao in enumerate(colecoes_uuid):
                logger.info(f"{i+1}. {colecao}")
        
        # Verificar se há coleções para remover
        if colecoes_uuid:
            # Modo interativo: pedir confirmação
            if not auto_mode:
                print("\nColeções UUID a serem removidas:")
                for i, colecao in enumerate(colecoes_uuid):
                    print(f"{i+1}. {colecao}")
                
                confirmacao = input("\nDeseja remover todas essas coleções UUID? (s/n): ")
                proceder = confirmacao.lower() == 's'
            else:
                # Modo automático: proceder sem confirmação
                proceder = True
                logger.info("Modo automático: removendo coleções sem confirmação")
            
            # Executar a remoção se confirmado
            if proceder:
                # Remover coleções UUID
                for colecao in colecoes_uuid:
                    try:
                        db.drop_collection(colecao)
                        logger.info(f"Coleção removida: {colecao}")
                    except Exception as e:
                        logger.error(f"Erro ao remover coleção {colecao}: {str(e)}")
                
                logger.info(f"Remoção de coleções UUID concluída. {len(colecoes_uuid)} coleções removidas.")
            else:
                logger.info("Operação cancelada pelo usuário.")
        else:
            logger.info("Nenhuma coleção UUID encontrada para remover.")
        
        # Mostrar coleções restantes
        colecoes_restantes = db.list_collection_names()
        logger.info(f"Total de coleções restantes: {len(colecoes_restantes)}")
        
    except Exception as e:
        logger.error(f"Erro ao conectar ou processar banco de dados: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()
            logger.info("Conexão MongoDB fechada")
    
    logger.info("Script concluído")

if __name__ == "__main__":
    main() 