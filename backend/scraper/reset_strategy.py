#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para resetar o estado das estratégias para todas as roletas
"""

import sys
import time
import logging
from datetime import datetime
import os
from typing import List, Dict, Any, Optional
from pymongo import MongoClient

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('runcash')

# MongoDB
MONGODB_URI = os.environ.get('MONGODB_URI', "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash")

def main():
    """Função principal para resetar estratégias"""
    try:
        # Conectar ao MongoDB
        client = MongoClient(MONGODB_URI)
        db = client['runcash']
        
        # Listar todas as roletas cadastradas
        roletas = list(db.roletas.find({}))
        
        logger.info(f"Encontradas {len(roletas)} roletas")
        
        # Coleção para armazenar histórico de estratégias
        historico_colecao = db['estrategia_historico_novo']
        
        # Resetar todas as estratégias
        reset_count = 0
        
        for roleta in roletas:
            roleta_id = roleta['_id']
            roleta_nome = roleta['nome']
            
            # Encontrar último estado da estratégia para esta roleta
            ultimo_estado = historico_colecao.find_one(
                {'roleta_id': roleta_id},
                sort=[('timestamp', -1)]
            )
            
            if ultimo_estado and ultimo_estado.get('estado') != 'NEUTRAL':
                logger.info(f"Resetando estratégia para roleta {roleta_nome}")
                
                # Inserir novo documento com estado NEUTRAL
                historico_colecao.insert_one({
                    'roleta_id': roleta_id,
                    'roleta_nome': roleta_nome,
                    'estado': 'NEUTRAL',
                    'numero_gatilho': 0,
                    'terminais_gatilho': [],
                    'vitorias': ultimo_estado.get('vitorias', 0),
                    'derrotas': ultimo_estado.get('derrotas', 0),
                    'timestamp': datetime.now(),
                    'sugestao_display': 'AGUARDANDO GATILHO'
                })
                
                reset_count += 1
        
        logger.info(f"Resetadas {reset_count} estratégias com sucesso!")
        
        return 0
    except Exception as e:
        logger.error(f"Erro ao resetar estratégias: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 