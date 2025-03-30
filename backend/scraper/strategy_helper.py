#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Funções auxiliares para a integração da estratégia com o MongoDB
"""

import os
import logging
import pymongo
from datetime import datetime
import json
from typing import List, Dict, Any, Optional

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
    Função simplificada para atualizar dados de estratégia no MongoDB
    
    Args:
        roleta_id: ID da roleta (string)
        roleta_nome: Nome da roleta (string)
        estado: Estado atual da estratégia (string)
        numero_gatilho: Número gatilho (int)
        terminais_gatilho: Lista de terminais (list)
        vitorias: Contagem de vitórias (int)
        derrotas: Contagem de derrotas (int)
        
    Returns:
        bool: True se atualizado com sucesso, False caso contrário
    """
    try:
        # Conectar ao MongoDB
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/runcash')
        db_name = os.environ.get('MONGODB_DB_NAME', 'runcash')
        
        client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        
        # Garantir que os tipos de dados estão corretos
        roleta_nome_str = str(roleta_nome) if roleta_nome is not None else "Roleta Desconhecida"
        estado_str = str(estado) if estado is not None else "NEUTRAL"
        numero_gatilho_int = int(numero_gatilho) if numero_gatilho is not None else -1
        terminais_list = list(terminais_gatilho) if terminais_gatilho is not None else []
        vitorias_int = int(vitorias) if vitorias is not None else 0
        derrotas_int = int(derrotas) if derrotas is not None else 0
        
        # Criar documento para atualização na coleção roletas
        dados_roleta = {
            'estado_estrategia': estado_str,
            'numero_gatilho': numero_gatilho_int,
            'terminais_gatilho': terminais_list,
            'vitorias': vitorias_int,
            'derrotas': derrotas_int,
            'updated_at': datetime.now().isoformat(),
            'nome': roleta_nome_str
        }
        
        # Atualizar a coleção de roletas (principal)
        logger.info(f"Atualizando roleta {roleta_nome_str} (ID: {roleta_id}) com estado: {estado_str}")
        resultado_roleta = db.roletas.update_one(
            {'_id': roleta_id},
            {'$set': dados_roleta},
            upsert=True
        )
        
        # Criar documento para coleção de histórico
        dados_historico = {
            'roleta_id': roleta_id,
            'roleta_nome': roleta_nome_str,
            'estado_estrategia': estado_str,
            'numero_gatilho': numero_gatilho_int,
            'terminais_gatilho': terminais_list,
            'vitorias': vitorias_int,
            'derrotas': derrotas_int,
            'timestamp': datetime.now().isoformat()
        }
        
        # Inserir na coleção de histórico nova (que criamos sem validação)
        logger.info(f"Salvando histórico para roleta {roleta_nome_str}")
        resultado_historico = db.estrategia_historico_novo.insert_one(dados_historico)
        
        return bool(resultado_roleta.acknowledged)
    
    except Exception as e:
        logger.error(f"Erro ao atualizar estratégia: {str(e)}")
        return False

def generate_display_suggestion(estado, terminais):
    """
    Gera uma sugestão de exibição com base no estado da estratégia
    
    Args:
        estado (str): Estado atual da estratégia (NEUTRAL, TRIGGER, POST_GALE_NEUTRAL, MORTO)
        terminais (list): Lista de terminais para apostar
        
    Returns:
        str: Texto a ser exibido para o usuário
    """
    if estado == "NEUTRAL":
        return "AGUARDANDO GATILHO"
    elif estado == "TRIGGER" and terminais:
        return f"APOSTAR EM: {','.join(map(str, terminais))}"
    elif estado == "POST_GALE_NEUTRAL" and terminais:
        return f"GALE EM: {','.join(map(str, terminais))}"
    elif estado == "MORTO":
        return "AGUARDANDO PRÓXIMO CICLO"
    return ""

def process_new_number(estrategia, numero):
    """
    Processa um novo número para a estratégia
    
    Args:
        estrategia (dict): Dicionário com o estado atual da estratégia
        numero (int): Novo número a ser processado
        
    Returns:
        dict: Estado atualizado da estratégia
    """
    # Implementação simples para evitar erro
    # Esta função deve ser implementada de acordo com a lógica específica da estratégia
    return estrategia 