#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para remover as coleções antigas que não são mais usadas no modelo otimizado.
Este script remove as coleções comuns como 'roletas', 'roleta_numeros', etc.
e as coleções com formato UUID, mantendo apenas as coleções com IDs numéricos.
"""

import os
import sys
import logging
import pymongo
import re
from datetime import datetime
from dotenv import load_dotenv

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Padrão regex para identificar UUIDs
# Padrão regex para identificar UUIDs (formato padrão)
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

# Padrão para identificar UUIDs no formato usado no banco (com hífens)
UUID_DASH_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

# Padrão para identificar UUIDs no formato hexadecimal sem hífens
UUID_HEX_PATTERN = re.compile(r'^[0-9a-f]{32}$', re.IGNORECASE)

# Padrão para identificar nomes de coleção com formato de hash (como mostrado na imagem)
HASH_PATTERN = re.compile(r'^[0-9a-f]{8,}-?[0-9a-f]{4,}-?[0-9a-f]{4,}-?[0-9a-f]{4,}-?[0-9a-f]{4,}', re.IGNORECASE)
# Padrão para identificar IDs numéricos
NUMERIC_ID_PATTERN = re.compile(r'^[0-9]+$')

def carregar_variaveis_ambiente():
    """Carrega variáveis de ambiente do arquivo .env"""
    try:
        # Carregar variáveis de ambiente do arquivo .env
        load_dotenv()
        return True
    except Exception as e:
        logger.error(f"Erro ao carregar variáveis de ambiente: {str(e)}")
        return False

def remover_colecoes_antigas():
    """Remove as coleções antigas e coleções UUID que não são mais usadas no modelo otimizado"""
    # Carregar variáveis de ambiente
    carregar_variaveis_ambiente()
    
    # Obter URI do MongoDB
    mongodb_uri = 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=roletas_db'
    if not mongodb_uri:
        logger.error("MONGODB_URI não encontrado nas variáveis de ambiente")
        return False
    # Obter nome do banco de dados
    db_name = os.environ.get('ROLETAS_MONGODB_DB_NAME') or os.environ.get('MONGODB_DB_NAME')
    if not db_name:
        logger.error("ROLETAS_MONGODB_DB_NAME ou MONGODB_DB_NAME não encontrado nas variáveis de ambiente")
        return False
    
    # Verificar se é o banco correto
    if 'roletas_db' not in db_name:
        resposta = input(f"Atenção: O banco de dados '{db_name}' não parece ser o banco otimizado 'roletas_db'.\nDeseja continuar mesmo assim? (s/n): ")
        if resposta.lower() != 's':
            logger.info("Operação cancelada pelo usuário")
            return False
    
    try:
        # Conectar ao MongoDB
        logger.info(f"Conectando ao MongoDB: {mongodb_uri}")
        client = pymongo.MongoClient(mongodb_uri)
        db = client[db_name]
        
        # Verificar se o banco existe
        if db_name not in client.list_database_names():
            logger.error(f"Banco de dados '{db_name}' não encontrado")
            return False
        
        logger.info(f"Conectado ao banco de dados: {db_name}")
        
        # Listar todas as coleções
        colecoes = db.list_collection_names()
        logger.info(f"Total de coleções encontradas: {len(colecoes)}")
        
        # Coleções antigas a serem removidas
        colecoes_antigas = [
            "roletas",
            "roleta_numeros",
            "roleta_estatisticas_diarias",
            "roleta_sequencias",
            "estrategia_historico"
        ]
        
        # Identificar coleções UUID e coleções com IDs numéricos
        colecoes_uuid = []
        colecoes_numericas = []
        colecoes_sistema = ["metadados", "system.views"]
        
        for colecao in colecoes:
            if colecao in colecoes_antigas or colecao in colecoes_sistema:
                continue
                
            if UUID_PATTERN.match(colecao):
                colecoes_uuid.append(colecao)
            elif NUMERIC_ID_PATTERN.match(colecao):
                colecoes_numericas.append(colecao)
        
        # Verificar quais coleções antigas existem
        colecoes_para_remover = [col for col in colecoes_antigas if col in colecoes]
        
        # Adicionar coleções UUID à lista de remoção
        colecoes_para_remover.extend(colecoes_uuid)
        
        if not colecoes_para_remover:
            logger.info("Nenhuma coleção para remover encontrada. O banco já está otimizado!")
            return True
        
        logger.info(f"Coleções comuns para remover: {[c for c in colecoes_para_remover if c in colecoes_antigas]}")
        logger.info(f"Coleções UUID para remover: {colecoes_uuid}")
        logger.info(f"Coleções numéricas que serão mantidas: {colecoes_numericas}")
        
        # Confirmação do usuário
        logger.info(f"Total de {len(colecoes_para_remover)} coleções serão removidas permanentemente")
        logger.info(f"ATENÇÃO: Esta operação é IRREVERSÍVEL!")
        resposta = input("Deseja continuar com a remoção? (s/n): ")
        
        if resposta.lower() != 's':
            logger.info("Operação cancelada pelo usuário")
            return False
        
        # Criar backup das coleções (opção para preservar dados)
        resposta_backup = input("Deseja criar um backup das coleções antes de removê-las? (s/n): ")
        if resposta_backup.lower() == 's':
            logger.info("Criando backup das coleções...")
            backup_db_name = f"{db_name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            backup_db = client[backup_db_name]
            
            for colecao in colecoes_para_remover:
                # Copiar documentos
                documentos = list(db[colecao].find({}))
                if documentos:
                    backup_db[colecao].insert_many(documentos)
                    logger.info(f"Backup de '{colecao}' criado em '{backup_db_name}.{colecao}' ({len(documentos)} documentos)")
                else:
                    logger.info(f"Coleção '{colecao}' está vazia, backup não necessário")
            
            logger.info(f"Backup concluído! Todas as coleções foram copiadas para o banco '{backup_db_name}'")
        
        # Remover as coleções
        for colecao in colecoes_para_remover:
            # Contar documentos
            num_documentos = db[colecao].count_documents({})
            
            # Remover coleção
            db[colecao].drop()
            logger.info(f"Coleção '{colecao}' removida ({num_documentos} documentos)")
        
        logger.info(f"Todas as coleções selecionadas foram removidas com sucesso!")
        
        # Mostrar coleções restantes
        colecoes_restantes = db.list_collection_names()
        logger.info(f"Coleções restantes no banco: {len(colecoes_restantes)}")
        logger.info(f"As seguintes coleções foram mantidas: {colecoes_restantes}")
        
        return True
    except Exception as e:
        logger.error(f"Erro ao remover coleções: {str(e)}")
        return False
    finally:
        # Fechar conexão
        if 'client' in locals():
            client.close()
            logger.info("Conexão com MongoDB fechada")

if __name__ == "__main__":
    logger.info("=== Remoção de Coleções Antigas e UUIDs ===")
    
    # Avisos importantes
    logger.info("ATENÇÃO: Este script removerá permanentemente:")
    logger.info("1. Coleções antigas comuns (roletas, roleta_numeros, etc.)")
    logger.info("2. Coleções com formato UUID (ex: 8663c411-e6af-e341-3854-b163e3d349a3)")
    logger.info("Apenas coleções com IDs numéricos serão mantidas.")
    logger.info("Recomendamos fazer um backup completo do banco antes de prosseguir.")
    
    # Confirmação inicial
    resposta = input("Deseja continuar? (s/n): ")
    
    if resposta.lower() == 's':
        if remover_colecoes_antigas():
            logger.info("✅ Operação concluída com sucesso!")
        else:
            logger.error("❌ Falha na operação")
    else:
        logger.info("Operação cancelada pelo usuário") 