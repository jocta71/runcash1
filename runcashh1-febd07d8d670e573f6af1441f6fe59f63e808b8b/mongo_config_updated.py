#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Módulo de configuração e utilitários para MongoDB com suporte a coleções por roleta
Versão aprimorada que implementa uma coleção separada para cada roleta
"""

import os
import logging
from datetime import datetime
from typing import Dict, Any, Tuple, Dict, List
from pymongo import MongoClient, ASCENDING, DESCENDING, IndexModel
from pymongo.collection import Collection
from pymongo.database import Database

# Obter variáveis de ambiente ou usar valores padrão
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/runcash')
MONGODB_DB_NAME = os.environ.get('MONGODB_DB_NAME', 'runcash')

# Configurar logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("MongoConfig")

def conectar_mongodb() -> Tuple[MongoClient, Database]:
    """
    Estabelece conexão com MongoDB
    
    Returns:
        Tuple[MongoClient, Database]: Cliente MongoDB e objeto de banco de dados
    """
    try:
        # Conectar ao MongoDB
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = client[MONGODB_DB_NAME]
        
        # Verificar conexão
        db.command('ping')
        logger.info(f"Conexão MongoDB estabelecida com sucesso: {MONGODB_URI}")
        
        return client, db
    except Exception as e:
        logger.error(f"Erro ao conectar ao MongoDB: {str(e)}")
        raise

def obter_colecoes_roletas(db: Database) -> List[str]:
    """
    Obtém a lista de coleções de roletas
    
    Args:
        db: Conexão com o banco de dados MongoDB
        
    Returns:
        List[str]: Lista de nomes de coleções de roletas
    """
    return [col for col in db.list_collection_names() if col.startswith("roleta_numeros_")]

def inicializar_colecoes(usar_colecoes_separadas=True) -> Dict[str, Any]:
    """
    Inicializa as coleções do MongoDB e configura índices
    
    Args:
        usar_colecoes_separadas (bool): Se True, usa coleções separadas por roleta
        
    Returns:
        Dict[str, Any]: Dicionário com as coleções e metadados
    """
    try:
        # Conectar ao MongoDB
        client, db = conectar_mongodb()
        
        # Inicializar dicionário de coleções e metadados
        resultado = {
            "client": client,
            "db": db,
            "colecoes": {},
            "colecoes_por_roleta": {},
            "config": {
                "usa_colecoes_separadas": usar_colecoes_separadas
            }
        }
        
        # Colecão "roletas"
        resultado["colecoes"]["roletas"] = db["roletas"]
        
        # Criar índices para coleção "roletas" se não existirem
        if "nome_1" not in resultado["colecoes"]["roletas"].index_information():
            resultado["colecoes"]["roletas"].create_index([("nome", ASCENDING)])
            logger.info("Índice 'nome' criado para coleção 'roletas'")
        
        # Tratar a estratégia de coleções para números da roleta
        if usar_colecoes_separadas:
            # Usar coleções separadas por roleta
            # Verificar view unificada
            if "roleta_numeros_view" in db.list_collection_names():
                resultado["colecoes"]["roleta_numeros"] = db["roleta_numeros_view"]
                logger.info("Usando view unificada 'roleta_numeros_view' como coleção principal")
            else:
                # Criar view se existirem coleções separadas
                colecoes_separadas = obter_colecoes_roletas(db)
                
                if colecoes_separadas:
                    # Criar view
                    criar_view_unificada(db, colecoes_separadas)
                    resultado["colecoes"]["roleta_numeros"] = db["roleta_numeros_view"]
                    logger.info("View unificada 'roleta_numeros_view' criada e configurada")
                else:
                    # Fallback para coleção única se não houver coleções separadas
                    resultado["colecoes"]["roleta_numeros"] = db["roleta_numeros"]
                    logger.warning("Nenhuma coleção separada encontrada. Usando coleção única 'roleta_numeros'")
            
            # Adicionar coleções separadas ao resultado
            for colecao in obter_colecoes_roletas(db):
                # Extrair ID da roleta do nome da coleção
                roleta_id = colecao.replace("roleta_numeros_", "")
                resultado["colecoes_por_roleta"][roleta_id] = db[colecao]
                
            logger.info(f"Configurado para usar {len(resultado['colecoes_por_roleta'])} coleções separadas por roleta")
        else:
            # Usar coleção única (modo legado)
            resultado["colecoes"]["roleta_numeros"] = db["roleta_numeros"]
            logger.info("Configurado para usar coleção única 'roleta_numeros' (modo legado)")
            
            # Criar índices para coleção "roleta_numeros" se não existirem
            indices_numeros = resultado["colecoes"]["roleta_numeros"].index_information()
            
            if "roleta_id_1_timestamp_-1" not in indices_numeros:
                resultado["colecoes"]["roleta_numeros"].create_index([
                    ("roleta_id", ASCENDING), 
                    ("timestamp", DESCENDING)
                ])
                logger.info("Índice 'roleta_id_timestamp' criado para coleção 'roleta_numeros'")
            
            if "numero_1" not in indices_numeros:
                resultado["colecoes"]["roleta_numeros"].create_index([("numero", ASCENDING)])
                logger.info("Índice 'numero' criado para coleção 'roleta_numeros'")
            
            if "cor_1" not in indices_numeros:
                resultado["colecoes"]["roleta_numeros"].create_index([("cor", ASCENDING)])
                logger.info("Índice 'cor' criado para coleção 'roleta_numeros'")
        
        # Coleção "roleta_estatisticas_diarias"
        resultado["colecoes"]["roleta_estatisticas_diarias"] = db["roleta_estatisticas_diarias"]
        
        # Criar índices para coleção "roleta_estatisticas_diarias" se não existirem
        indices_estat = resultado["colecoes"]["roleta_estatisticas_diarias"].index_information()
        
        if "roleta_id_1_data_1" not in indices_estat:
            resultado["colecoes"]["roleta_estatisticas_diarias"].create_index([
                ("roleta_id", ASCENDING), 
                ("data", ASCENDING)
            ], unique=True)
            logger.info("Índice 'roleta_id_data' criado para coleção 'roleta_estatisticas_diarias'")
        
        # Coleção "roleta_sequencias"
        resultado["colecoes"]["roleta_sequencias"] = db["roleta_sequencias"]
        
        # Criar índices para coleção "roleta_sequencias" se não existirem
        indices_seq = resultado["colecoes"]["roleta_sequencias"].index_information()
        
        if "roleta_id_1_tipo_1_comprimento_-1" not in indices_seq:
            resultado["colecoes"]["roleta_sequencias"].create_index([
                ("roleta_id", ASCENDING), 
                ("tipo", ASCENDING),
                ("comprimento", DESCENDING)
            ])
            logger.info("Índice 'roleta_id_tipo_comprimento' criado para coleção 'roleta_sequencias'")
        
        logger.info("Todas as coleções inicializadas com sucesso")
        return resultado
    except Exception as e:
        logger.error(f"Erro ao inicializar coleções MongoDB: {str(e)}")
        raise

def criar_view_unificada(db: Database, colecoes: List[str]) -> bool:
    """
    Cria uma view que unifica todas as coleções de roletas
    
    Args:
        db: Conexão com o banco de dados MongoDB
        colecoes: Lista de nomes de coleções a unificar
        
    Returns:
        bool: True se a view foi criada com sucesso
    """
    try:
        if not colecoes:
            logger.warning("Nenhuma coleção fornecida para criar view unificada")
            return False
        
        # Remover view existente se existir
        if "roleta_numeros_view" in db.list_collection_names():
            db.command("drop", "roleta_numeros_view")
            logger.info("View existente removida")
        
        # Construir pipeline para união
        pipeline = []
        primeira_colecao = colecoes[0]
        
        for colecao in colecoes[1:]:
            pipeline.append({"$unionWith": {"coll": colecao}})
        
        # Criar view
        db.command(
            "create",
            "roleta_numeros_view",
            viewOn=primeira_colecao,
            pipeline=pipeline
        )
        
        logger.info(f"View unificada 'roleta_numeros_view' criada com {len(colecoes)} coleções")
        return True
    except Exception as e:
        logger.error(f"Erro ao criar view unificada: {str(e)}")
        return False

def garantir_colecao_roleta(db: Database, roleta_id: str, roleta_nome: str = None) -> Collection:
    """
    Garante que existe uma coleção para a roleta especificada
    
    Args:
        db: Conexão com o banco de dados MongoDB
        roleta_id: ID da roleta
        roleta_nome: Nome da roleta (opcional, para log)
        
    Returns:
        Collection: Objeto da coleção da roleta
    """
    # Nome da coleção
    nome_colecao = f"roleta_numeros_{roleta_id}"
    
    # Verificar se já existe
    if nome_colecao in db.list_collection_names():
        return db[nome_colecao]
    
    # Criar coleção
    db.create_collection(nome_colecao)
    
    # Criar índices
    db[nome_colecao].create_index([("timestamp", DESCENDING)])
    db[nome_colecao].create_index([("numero", ASCENDING)])
    db[nome_colecao].create_index([("cor", ASCENDING)])
    
    msg_log = f"Coleção '{nome_colecao}' criada"
    if roleta_nome:
        msg_log += f" para roleta '{roleta_nome}'"
    logger.info(msg_log)
    
    # Reconstruir view unificada
    colecoes = obter_colecoes_roletas(db)
    criar_view_unificada(db, colecoes)
    
    return db[nome_colecao]

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
    timestamp: Any = None
) -> Dict[str, Any]:
    """
    Converte dados de número para documento MongoDB
    
    Args:
        roleta_id (str): ID da roleta
        roleta_nome (str): Nome da roleta
        numero (int): Número sorteado
        cor (str, optional): Cor do número. Defaults to None.
        timestamp (Any, optional): Timestamp do evento. Defaults to None.
        
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
    
    return {
        "roleta_id": roleta_id,
        "roleta_nome": roleta_nome,
        "numero": numero,
        "cor": cor,
        "timestamp": ts,
        "criado_em": datetime.now()
    } 