#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para extrair apenas os números das roletas e armazená-los no MongoDB
sem aplicar nenhuma estratégia.
"""

import sys
import logging
from pymongo import MongoClient
from datetime import datetime
import json

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def update_mongodb_collections():
    """Extrai apenas os números das roletas e os armazena no MongoDB"""
    try:
        # Conectar ao MongoDB
        client = MongoClient('mongodb://localhost:27017/runcash')
        db = client.runcash
        
        # Obter todas as roletas
        roletas = list(db.roletas.find({}))
        logger.info(f"Encontradas {len(roletas)} roletas para extração de números")
        
        # Para cada roleta, apenas registrar seus números
        for roleta in roletas:
            roleta_id = str(roleta.get("_id") or roleta.get("id"))
            roleta_nome = roleta.get("nome")
            
            if not roleta_id or not roleta_nome:
                continue
                
            # Obter números da roleta
            numeros = roleta.get('numeros', [])
            
            if numeros:
                ultimo_numero = numeros[0] if numeros else None
                logger.info(f"Roleta {roleta_nome}: Último número extraído: {ultimo_numero}")
                
                # Emitir evento para WebSocket com o novo número
                evento = {
                    'type': 'new_number',
                    'roleta_id': roleta_id,
                    'roleta_nome': roleta_nome,
                    'numero': ultimo_numero,
                    'timestamp': datetime.now().isoformat()
                }
                
                # Log do evento
                logger.info(f"Enviando evento para WebSocket: {roleta_nome} - {ultimo_numero}")
                
                # Aqui você pode enviar o evento para WebSocket ou SSE se necessário
                # Mas o importante é que NÃO estamos processando estratégias
        
        client.close()
        logger.info("Extração de números concluída com sucesso")
        return True
    
    except Exception as e:
        logger.error(f"Erro ao extrair números das roletas: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    if update_mongodb_collections():
        logger.info("Extração de números concluída com sucesso")
        sys.exit(0)
    else:
        logger.error("Falha na extração de números")
        sys.exit(1) 