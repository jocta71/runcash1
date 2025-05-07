#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Módulo de configuração e utilitários para MongoDB
"""

import os
import logging
from datetime import datetime
from typing import Dict, Any, Tuple, Dict, List
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from pymongo.database import Database

# Modificado para usar ROLETAS_MONGODB_DB_NAME se disponível
from config import MONGODB_URI, logger
# Usar variável de ambiente ROLETAS_MONGODB_DB_NAME se disponível, caso contrário usar MONGODB_DB_NAME
MONGODB_DB_NAME = os.environ.get('ROLETAS_MONGODB_DB_NAME') or os.environ.get('MONGODB_DB_NAME', 'runcash')

# Flag para identificar se estamos usando o banco otimizado de roletas
USANDO_BANCO_ROLETAS_DB = 'roletas_db' in MONGODB_DB_NAME

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
        
        if USANDO_BANCO_ROLETAS_DB:
            logger.info("🔹 Usando modelo otimizado com coleções específicas por roleta")
        else:
            logger.info("🔸 Usando modelo tradicional com coleções comuns")
        
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
        
        # Verificar se já existem roletas cadastradas no banco
        # Primeiro verificar na coleção de roletas (modelo tradicional)
        if "roletas" in db.list_collection_names():
            roletas = list(db.roletas.find({"ativa": True}))
            logger.info(f"Encontradas {len(roletas)} roletas na coleção 'roletas'")
            
            # Criar coleções específicas para cada roleta
            for roleta in roletas:
                roleta_id = str(roleta.get("_id"))
                roleta_nome = roleta.get("nome")
                
                # Criar coleção para esta roleta
                colecao = criar_colecao_roleta(db, roleta_id)
                colecoes_por_roleta[roleta_id] = colecao
                
                # Registrar na coleção de metadados
                db.metadados.update_one(
                    {"roleta_id": roleta_id},
                    {"$set": {
                        "roleta_id": roleta_id,
                        "roleta_nome": roleta_nome,
                        "colecao": roleta_id,
                        "ativa": True,
                        "atualizado_em": datetime.now()
                    }},
                    upsert=True
                )
        
        # Também verificar coleções existentes que podem ser de roletas
        for colecao_nome in db.list_collection_names():
            # Ignorar coleções de sistema e metadados
            if colecao_nome.startswith("system.") or colecao_nome in ["metadados", "estatisticas", "roletas"]:
                continue
                
            # Assumir que a coleção é uma roleta
            roleta_id = colecao_nome
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
        
        logger.info(f"Inicializadas {len(colecoes_por_roleta)} coleções específicas para roletas")
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
        
        # Inicializar dicionário de coleções
        colecoes = {}
        
        # Se estiver usando o banco de roletas_db, criar coleções específicas
        colecoes_por_roleta = {}
        if USANDO_BANCO_ROLETAS_DB:
            colecoes_por_roleta = inicializar_colecoes_especificas(db)
        
        # Colecão "roletas"
        colecoes['roletas'] = db['roletas']
        
        # Criar índices para coleção "roletas" se não existirem
        if 'nome_1' not in colecoes['roletas'].index_information():
            colecoes['roletas'].create_index([('nome', ASCENDING)])
            logger.info("Índice 'nome' criado para coleção 'roletas'")
        
        # Coleção "roleta_numeros" (usando apenas no modo tradicional)
        colecoes['roleta_numeros'] = db['roleta_numeros']
        
        # Criar índices para coleção "roleta_numeros" se não existirem
        indices_numeros = colecoes['roleta_numeros'].index_information()
        
        if 'roleta_id_1_timestamp_-1' not in indices_numeros:
            colecoes['roleta_numeros'].create_index([
                ('roleta_id', ASCENDING), 
                ('timestamp', DESCENDING)
            ])
            logger.info("Índice 'roleta_id_timestamp' criado para coleção 'roleta_numeros'")
        
        if 'numero_1' not in indices_numeros:
            colecoes['roleta_numeros'].create_index([('numero', ASCENDING)])
            logger.info("Índice 'numero' criado para coleção 'roleta_numeros'")
        
        if 'cor_1' not in indices_numeros:
            colecoes['roleta_numeros'].create_index([('cor', ASCENDING)])
            logger.info("Índice 'cor' criado para coleção 'roleta_numeros'")
        
        # Coleção "roleta_estatisticas_diarias"
        colecoes['roleta_estatisticas_diarias'] = db['roleta_estatisticas_diarias']
        
        # Criar índices para coleção "roleta_estatisticas_diarias" se não existirem
        indices_estat = colecoes['roleta_estatisticas_diarias'].index_information()
        
        if 'roleta_id_1_data_1' not in indices_estat:
            colecoes['roleta_estatisticas_diarias'].create_index([
                ('roleta_id', ASCENDING), 
                ('data', ASCENDING)
            ], unique=True)
            logger.info("Índice 'roleta_id_data' criado para coleção 'roleta_estatisticas_diarias'")
        
        # Coleção "roleta_sequencias"
        colecoes['roleta_sequencias'] = db['roleta_sequencias']
        
        # Criar índices para coleção "roleta_sequencias" se não existirem
        indices_seq = colecoes['roleta_sequencias'].index_information()
        
        if 'roleta_id_1_tipo_1_comprimento_-1' not in indices_seq:
            colecoes['roleta_sequencias'].create_index([
                ('roleta_id', ASCENDING), 
                ('tipo', ASCENDING),
                ('comprimento', DESCENDING)
            ])
            logger.info("Índice 'roleta_id_tipo_comprimento' criado para coleção 'roleta_sequencias'")
        
        # Adicionar informações extras no resultado
        recursos = {
            "client": client,
            "db": db,
            "colecoes": colecoes,
            "colecoes_por_roleta": colecoes_por_roleta,
            "config": {
                "usa_colecoes_separadas": USANDO_BANCO_ROLETAS_DB
            }
        }
        
        logger.info("Todas as coleções inicializadas com sucesso")
        return recursos
    except Exception as e:
        logger.error(f"Erro ao inicializar coleções MongoDB: {str(e)}")
        raise

def roleta_para_documento(roleta_id: str, roleta_nome: str) -> Dict[str, Any]:
    """
    Converte dados de roleta para documento MongoDB
    
    Args:
        roleta_id (str): ID da roleta
        roleta_nome (str): Nome da roleta
        
    Returns:
        Dict[str, Any]: Documento formatado para MongoDB
    """
    agora = datetime.now()
    
    return {
        "_id": roleta_id,
        "nome": roleta_nome,
        "ativa": True,
        "criado_em": agora,
        "atualizado_em": agora
    }

def numero_para_documento(
    roleta_id: str, 
    roleta_nome: str, 
    numero: int, 
    cor: str = None,
    timestamp: str = None
) -> Dict[str, Any]:
    """
    Converte dados de número para documento MongoDB
    
    Args:
        roleta_id (str): ID da roleta
        roleta_nome (str): Nome da roleta
        numero (int): Número sorteado
        cor (str, optional): Cor do número. Defaults to None.
        timestamp (str, optional): Timestamp do evento. Defaults to None.
        
    Returns:
        Dict[str, Any]: Documento formatado para MongoDB
    """
    # Usar timestamp fornecido ou atual
    if timestamp is None or not timestamp:
        ts = datetime.now()
    else:
        # Tentar converter de string para datetime
        try:
            if isinstance(timestamp, str):
                ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            else:
                ts = timestamp
        except:
            ts = datetime.now()
    
    # Determinar cor se não fornecida
    if not cor:
        from scraper_core import determinar_cor_numero
        cor = determinar_cor_numero(numero)
    
    # Documento base
    documento = {
        "numero": numero,
        "cor": cor,
        "timestamp": ts,
        "criado_em": datetime.now()
    }
    
    # Adicionar roleta_id e roleta_nome apenas se não estiver usando coleções específicas
    # (quando usar coleções específicas, o roleta_id já está implícito na coleção)
    if not USANDO_BANCO_ROLETAS_DB:
        documento["roleta_id"] = roleta_id
        documento["roleta_nome"] = roleta_nome
    
    return documento

def estatistica_diaria_para_documento(roleta_id: str, data: datetime, dados_estatisticos: dict) -> dict:
    """
    Converte estatísticas diárias para um documento MongoDB
    
    Args:
        roleta_id (str): ID da roleta
        data (datetime): Data da estatística
        dados_estatisticos (dict): Dados estatísticos (contagens, frequências, etc.)
        
    Returns:
        dict: Documento MongoDB para inserção
    """
    return {
        "roleta_id": roleta_id,
        "data": data.strftime("%Y-%m-%d"),
        "total_numeros": dados_estatisticos.get("total_numeros", 0),
        "numeros_vermelhos": dados_estatisticos.get("numeros_vermelhos", 0),
        "numeros_pretos": dados_estatisticos.get("numeros_pretos", 0),
        "zeros": dados_estatisticos.get("zeros", 0),
        "numeros_pares": dados_estatisticos.get("numeros_pares", 0),
        "numeros_impares": dados_estatisticos.get("numeros_impares", 0),
        "numero_mais_frequente": dados_estatisticos.get("numero_mais_frequente", 0),
        "frequencia_maxima": dados_estatisticos.get("frequencia_maxima", 0),
        "atualizado_em": datetime.now()
    }

def sequencia_para_documento(roleta_id: str, tipo: str, valor: str, 
                            comprimento: int, inicio: datetime, fim: datetime = None) -> dict:
    """
    Converte dados de sequência para um documento MongoDB
    
    Args:
        roleta_id (str): ID da roleta
        tipo (str): Tipo da sequência (cor, paridade, etc.)
        valor (str): Valor da sequência (vermelho, par, etc.)
        comprimento (int): Comprimento da sequência
        inicio (datetime): Timestamp de início
        fim (datetime, optional): Timestamp de fim. Defaults to None.
        
    Returns:
        dict: Documento MongoDB para inserção
    """
    documento = {
        "roleta_id": roleta_id,
        "tipo": tipo,
        "valor": valor,
        "comprimento": comprimento,
        "inicio_timestamp": inicio,
        "criado_em": datetime.now()
    }
    
    if fim:
        documento["fim_timestamp"] = fim
        
    return documento

# Inicializar conexão quando o módulo é importado
if __name__ != "__main__":
    try:
        conectar_mongodb()
    except Exception as e:
        logger.error(f"Erro ao inicializar conexão MongoDB: {str(e)}") 