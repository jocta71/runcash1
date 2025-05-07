#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Módulo de configuração e utilitários para MongoDB
"""

import os
import logging
import re
from datetime import datetime
from typing import Dict, Any, Tuple, Dict, List
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from pymongo.database import Database

# Modificado para usar ROLETAS_MONGODB_DB_NAME se disponível
from config import MONGODB_URI, logger
# Usar variável de ambiente ROLETAS_MONGODB_DB_NAME se disponível, caso contrário usar MONGODB_DB_NAME
MONGODB_DB_NAME = os.environ.get('ROLETAS_MONGODB_DB_NAME') or os.environ.get('MONGODB_DB_NAME', 'runcash')

# Flag para identificar se estamos usando o banco otimizado de roletas - sempre TRUE agora
USANDO_BANCO_ROLETAS_DB = True

# Padrão para verificar se o ID é numérico
NUMERIC_ID_PATTERN = re.compile(r'^[0-9]+$')

def conectar_mongodb() -> Tuple[MongoClient, Database]:
    """
    Estabelece conexão com MongoDB
    
    Returns:
        Tuple[MongoClient, Database]: Cliente MongoDB e objeto de banco de dados
    """
    try:
        # Conectar ao MongoDB sem configuração de pool
        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB_NAME]
        
        # Verificar conexão
        db.command('ping')
        logger.info(f"Conexão MongoDB estabelecida com sucesso: {MONGODB_URI}")
        logger.info(f"Usando banco de dados: {MONGODB_DB_NAME}")
        logger.info("🔹 Usando modelo otimizado com coleções específicas por roleta")
        
        return client, db
    except Exception as e:
        logger.error(f"Erro ao conectar ao MongoDB: {str(e)}")
        raise

def criar_colecao_roleta(db: Database, roleta_id: str) -> Collection:
    """
    Cria uma coleção específica para uma roleta
    
    Args:
        db (Database): Banco de dados MongoDB
        roleta_id (str): ID da roleta
        
    Returns:
        Collection: Coleção criada
    """
    # Verificar se o ID da roleta é numérico
    if not NUMERIC_ID_PATTERN.match(roleta_id):
        logger.warning(f"ALERTA: Criando coleção com ID não numérico: {roleta_id}")
        logger.warning("IDs não numéricos podem causar problemas de compatibilidade")
    
    # Nome da coleção = ID da roleta
    colecao_nome = roleta_id
    
    # Verificar se a coleção já existe
    if colecao_nome not in db.list_collection_names():
        # Criar coleção
        db.create_collection(colecao_nome)
        
        # Criar índices
        db[colecao_nome].create_index([("timestamp", DESCENDING)])
        db[colecao_nome].create_index([("numero", ASCENDING)])
        db[colecao_nome].create_index([("cor", ASCENDING)])
        
        logger.info(f"Coleção específica '{colecao_nome}' criada com índices")
    else:
        logger.info(f"Coleção específica '{colecao_nome}' já existe")
    
    return db[colecao_nome]

def inicializar_colecoes_especificas(db: Database) -> Dict[str, Collection]:
    """
    Inicializa coleções específicas para roletas existentes
    
    Args:
        db (Database): Banco de dados MongoDB
        
    Returns:
        Dict[str, Collection]: Dicionário com as coleções por roleta
    """
    colecoes_por_roleta = {}
    
    try:
        # Coleção de metadados
        if "metadados" not in db.list_collection_names():
            db.create_collection("metadados")
            db.metadados.create_index([("roleta_id", ASCENDING)], unique=True)
            logger.info("Coleção 'metadados' criada")
        
        # Verificar roletas existentes na coleção metadados
        if "metadados" in db.list_collection_names():
            roletas_meta = list(db.metadados.find({"ativa": True}))
            logger.info(f"Encontradas {len(roletas_meta)} roletas na coleção 'metadados'")
            
            for roleta in roletas_meta:
                roleta_id = roleta.get("roleta_id")
                
                # Verificar se o ID é numérico
                if not NUMERIC_ID_PATTERN.match(str(roleta_id)):
                    logger.warning(f"ID não numérico encontrado: {roleta_id}")
                
                # Adicionar a coleção ao dicionário
                colecao = criar_colecao_roleta(db, roleta_id)
                colecoes_por_roleta[roleta_id] = colecao
        
        # Também verificar coleções existentes que podem ser de roletas
        colecoes_numericas = []
        colecoes_nao_numericas = []
        
        for colecao_nome in db.list_collection_names():
            # Ignorar coleções de sistema e metadados
            if colecao_nome.startswith("system.") or colecao_nome in ["metadados"]:
                continue
                
            # Se for uma coleção antiga comum, não considerar como roleta
            if colecao_nome in ["roletas", "roleta_numeros", "roleta_estatisticas_diarias", "roleta_sequencias"]:
                continue
                
            # Verificar se o nome da coleção é um ID numérico
            if NUMERIC_ID_PATTERN.match(colecao_nome):
                colecoes_numericas.append(colecao_nome)
                
                # Assumir que a coleção é uma roleta
                roleta_id = colecao_nome
                
                # Só adicionar se ainda não estiver no dicionário
                if roleta_id not in colecoes_por_roleta:
                    colecoes_por_roleta[roleta_id] = db[colecao_nome]
                
                # Verificar se está nos metadados
                if not db.metadados.find_one({"roleta_id": roleta_id}):
                    # Adicionar aos metadados
                    db.metadados.update_one(
                        {"roleta_id": roleta_id},
                        {"$set": {
                            "roleta_id": roleta_id,
                            "roleta_nome": f"Roleta {roleta_id}",
                            "colecao": roleta_id,
                            "ativa": True,
                            "atualizado_em": datetime.now()
                        }},
                        upsert=True
                    )
            else:
                # Manter um registro de coleções não numéricas para log
                colecoes_nao_numericas.append(colecao_nome)
        
        logger.info(f"Inicializadas {len(colecoes_por_roleta)} coleções específicas para roletas")
        
        # Informar sobre as coleções não numéricas
        if colecoes_nao_numericas:
            logger.warning(f"Encontradas {len(colecoes_nao_numericas)} coleções com IDs não numéricos: {', '.join(colecoes_nao_numericas)}")
            logger.warning("Essas coleções podem ser problemáticas para a compatibilidade")
        
        # Informar sobre as coleções que serão ignoradas
        for colecao_antiga in ["roletas", "roleta_numeros", "roleta_estatisticas_diarias", "roleta_sequencias"]:
            if colecao_antiga in db.list_collection_names():
                logger.info(f"ℹ️ A coleção '{colecao_antiga}' será ignorada no modelo otimizado")
        
        return colecoes_por_roleta
    except Exception as e:
        logger.error(f"Erro ao inicializar coleções específicas: {str(e)}")
        return {}

def inicializar_colecoes() -> Dict[str, Any]:
    """
    Inicializa as coleções do MongoDB e configura índices
    
    Returns:
        Dict[str, Collection]: Dicionário com as coleções
    """
    try:
        # Conectar ao MongoDB
        client, db = conectar_mongodb()
        
        # Inicializar dicionário de coleções específicas
        colecoes_por_roleta = inicializar_colecoes_especificas(db)
        
        # Inicializar dicionário de coleções (mantido para compatibilidade)
        colecoes = {}
        
        # Adicionar informações extras no resultado
        recursos = {
            "client": client,
            "db": db,
            "colecoes": colecoes,  # Dicionário vazio, não usamos mais as coleções comuns
            "colecoes_por_roleta": colecoes_por_roleta,
            "config": {
                "usa_colecoes_separadas": True  # Sempre TRUE
            }
        }
        
        logger.info("Todas as coleções inicializadas com sucesso")
        return recursos
    except Exception as e:
        logger.error(f"Erro ao inicializar coleções MongoDB: {str(e)}")
        raise

def numero_para_documento(
    roleta_id: str, 
    roleta_nome: str, 
    numero: int, 
    cor: str = None,
    timestamp: str = None
) -> Dict[str, Any]:
    """
    Converte um número para um documento MongoDB
    
    Args:
        roleta_id: ID da roleta
        roleta_nome: Nome da roleta
        numero: Número sorteado
        cor: Cor do número (opcional)
        timestamp: Timestamp do evento (opcional)
        
    Returns:
        Dict com documento para inserção
    """
    from scraper_core import determinar_cor_numero
    
    # Usar timestamp atual se não fornecido
    if timestamp is None:
        data_hora = datetime.now()
    else:
        # Converter string para datetime
        try:
            data_hora = datetime.fromisoformat(timestamp)
        except:
            data_hora = datetime.now()
    
    # Determinar cor se não fornecida
    if cor is None:
        cor = determinar_cor_numero(numero)
    
    # Criar documento
    documento = {
        "roleta_id": roleta_id,
        "roleta_nome": roleta_nome,
        "numero": numero,
        "cor": cor,
        "timestamp": data_hora,
        "criado_em": datetime.now()
    }
    
    return documento

def roleta_para_documento(roleta_id: str, roleta_nome: str) -> Dict[str, Any]:
    """
    Converte uma roleta para um documento MongoDB
    
    Args:
        roleta_id: ID da roleta
        roleta_nome: Nome da roleta
        
    Returns:
        Dict com documento para inserção
    """
    documento = {
        "_id": roleta_id,
        "nome": roleta_nome,
        "ativa": True,
        "criado_em": datetime.now(),
        "atualizado_em": datetime.now()
    }
    
    return documento

# Inicializar conexão quando o módulo é importado
if __name__ != "__main__":
    try:
        conectar_mongodb()
    except Exception as e:
        logger.error(f"Erro ao inicializar conexão MongoDB: {str(e)}") 