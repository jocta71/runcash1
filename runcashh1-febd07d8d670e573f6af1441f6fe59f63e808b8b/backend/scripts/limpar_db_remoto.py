#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para remover coleções UUID do banco de dados MongoDB remoto
usando a string de conexão fornecida
"""

import re
import os
import sys
import logging
import subprocess
from pymongo import MongoClient
from datetime import datetime

# Configurar diretório de logs
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(log_dir, exist_ok=True)

# Configurar logging para console e arquivo
log_file = os.path.join(log_dir, f"limpar_db_remoto_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [LIMPEZA_REMOTA] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file)
    ]
)
logger = logging.getLogger('limpeza_remota')

# String de conexão segura (codificada no script para evitar exposição em variáveis de ambiente)
MONGODB_URI = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=roletas_db"
DB_NAME = "roletas_db"

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

def listar_colecoes():
    """Lista todas as coleções no banco de dados"""
    logger.info("=" * 50)
    logger.info(f"Listando coleções do banco remoto {DB_NAME}")
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
        
        # Categorizar coleções
        numericas = []
        uuid_like = []
        outras = []
        
        for col in collections:
            if col.isdigit():
                numericas.append(col)
            elif is_uuid_collection(col):
                uuid_like.append(col)
            else:
                outras.append(col)
        
        logger.info(f"Coleções numéricas: {len(numericas)}")
        logger.info(f"Coleções UUID: {len(uuid_like)}")
        logger.info(f"Outras coleções: {len(outras)}")
        
        # Mostrar detalhes das coleções UUID
        if uuid_like:
            logger.info("Coleções UUID encontradas:")
            for i, col in enumerate(uuid_like):
                logger.info(f"  {i+1}. {col}")
            
            print(f"\nEncontradas {len(uuid_like)} coleções UUID para remover.")
        else:
            print("Nenhuma coleção UUID encontrada.")
        
        return uuid_like
        
    except Exception as e:
        logger.error(f"Erro ao conectar ou listar coleções: {str(e)}")
        print(f"Erro ao conectar ao banco de dados: {str(e)}")
        return []
    finally:
        if 'client' in locals():
            client.close()

def remover_colecoes(colecoes):
    """Remove as coleções especificadas"""
    if not colecoes:
        logger.info("Nenhuma coleção para remover.")
        return 0
    
    logger.info("=" * 50)
    logger.info(f"Iniciando remoção de {len(colecoes)} coleções UUID")
    
    try:
        # Conectar ao MongoDB
        client = MongoClient(MONGODB_URI)
        db = client[DB_NAME]
        
        # Verificar conexão
        db.command('ping')
        
        # Contador de coleções removidas
        removidas = 0
        
        # Remover cada coleção
        for colecao in colecoes:
            try:
                db.drop_collection(colecao)
                logger.info(f"Coleção removida: {colecao}")
                removidas += 1
            except Exception as e:
                logger.error(f"Erro ao remover coleção {colecao}: {str(e)}")
        
        logger.info(f"Remoção concluída. {removidas} de {len(colecoes)} coleções removidas.")
        return removidas
        
    except Exception as e:
        logger.error(f"Erro ao conectar ou remover coleções: {str(e)}")
        return 0
    finally:
        if 'client' in locals():
            client.close()

def main():
    """Função principal"""
    print("=" * 70)
    print("UTILITÁRIO DE REMOÇÃO DE COLEÇÕES UUID DO MONGODB REMOTO")
    print("=" * 70)
    print("")
    print(f"Banco de dados alvo: {DB_NAME}")
    print(f"Log será salvo em: {log_file}")
    print("")
    
    # Listar coleções
    print("Listando coleções do banco de dados remoto...")
    colecoes_uuid = listar_colecoes()
    
    if not colecoes_uuid:
        print("Nenhuma coleção UUID encontrada para remover.")
        return
    
    # Confirmar remoção
    print("\nDeseja remover todas essas coleções UUID? (s/n)")
    resposta = input("> ")
    
    if resposta.lower() != 's':
        print("Operação cancelada pelo usuário.")
        return
    
    # Remover coleções
    print("\nIniciando remoção das coleções UUID...")
    removidas = remover_colecoes(colecoes_uuid)
    
    # Listar coleções novamente
    print("\nListando coleções após a remoção...")
    colecoes_restantes = listar_colecoes()
    
    # Relatório final
    print("\nRelatório final:")
    print(f"  - Coleções UUID encontradas inicialmente: {len(colecoes_uuid)}")
    print(f"  - Coleções removidas com sucesso: {removidas}")
    print(f"  - Coleções UUID restantes: {len(colecoes_restantes)}")
    
    print("\nOperação concluída!")

if __name__ == "__main__":
    main() 