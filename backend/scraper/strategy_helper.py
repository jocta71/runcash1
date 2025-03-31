#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Funções auxiliares para registro de números das roletas sem aplicar estratégias
"""

import os
import logging
import pymongo
from datetime import datetime
import json
from typing import List, Dict, Any, Optional
import random

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def atualizar_estrategia(
    roleta_id: str, 
    roleta_nome: str, 
    estado: str, 
    numero_gatilho: int,
    terminais_gatilho: List[int],
    vitorias: int,
    derrotas: int
) -> bool:
    """
    Função para registrar dados sobre números extraídos no MongoDB
    sem aplicar lógica de estratégia
    
    Args:
        roleta_id: ID da roleta (string)
        roleta_nome: Nome da roleta (string)
        estado: Estado atual (string) - será sempre NEUTRAL
        numero_gatilho: Último número extraído (int)
        terminais_gatilho: Lista vazia de terminais (list)
        vitorias: Não utilizado (int)
        derrotas: Não utilizado (int)
        
    Returns:
        bool: True se registrado com sucesso, False caso contrário
    """
    try:
        # Conectar ao MongoDB
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/runcash')
        db_name = os.environ.get('MONGODB_DB_NAME', 'runcash')
        
        client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        
        # Garantir que os tipos de dados estão corretos
        roleta_nome_str = str(roleta_nome) if roleta_nome is not None else "Roleta Desconhecida"
        numero_gatilho_int = int(numero_gatilho) if numero_gatilho is not None else -1
        
        # Criar documento para atualização na coleção roletas - sem dados de estratégia
        dados_roleta = {
            'ultimo_numero': numero_gatilho_int,
            'updated_at': datetime.now().isoformat(),
            'nome': roleta_nome_str
        }
        
        # Atualizar a coleção de roletas (principal)
        logger.info(f"Registrando número {numero_gatilho_int} para roleta {roleta_nome_str} (ID: {roleta_id})")
        resultado_roleta = db.roletas.update_one(
            {'_id': roleta_id},
            {'$set': dados_roleta},
            upsert=True
        )
        
        # Criar documento para coleção de histórico - apenas números, sem estratégia
        dados_historico = {
            'roleta_id': roleta_id,
            'roleta_nome': roleta_nome_str,
            'numero': numero_gatilho_int,
            'timestamp': datetime.now().isoformat()
        }
        
        # Inserir na coleção de histórico 
        logger.info(f"Salvando histórico para roleta {roleta_nome_str}")
        resultado_historico = db.estrategia_historico_novo.insert_one(dados_historico)
        
        return bool(resultado_roleta.acknowledged)
    
    except Exception as e:
        logger.error(f"Erro ao registrar número: {str(e)}")
        return False

def generate_display_suggestion(estado, terminais):
    """
    Função vazia que não gera mais sugestões de estratégia
    
    Args:
        estado (str): Estado (ignorado)
        terminais (list): Lista de terminais (ignorada)
        
    Returns:
        str: String vazia
    """
    return ""

def process_new_number(db, id_roleta, roleta_nome, numero):
    """
    Processa um novo número - apenas registrando-o sem aplicar estratégia
    
    Args:
        db: Objeto da fonte de dados (MongoDataSource)
        id_roleta (str): ID da roleta
        roleta_nome (str): Nome da roleta
        numero (int): Novo número a ser registrado
        
    Returns:
        dict: Estado neutro com informações básicas
    """
    try:
        # Registrar o novo número
        logger.info(f"Novo número extraído: Roleta {roleta_nome} (ID: {id_roleta}) - Número: {numero}")
        
        # Retornar objeto minimalista apenas com o número
        return {
            "estado": "NEUTRAL",
            "numero_gatilho": numero,
            "terminais_gatilho": [],
            "vitorias": 0,
            "derrotas": 0,
            "sugestao_display": ""
        }
        
    except Exception as e:
        logger.error(f"Erro ao processar novo número: {str(e)}")
        return {
            "estado": "NEUTRAL",
            "numero_gatilho": numero,
            "terminais_gatilho": [],
            "vitorias": 0,
            "derrotas": 0,
            "sugestao_display": ""
        } 