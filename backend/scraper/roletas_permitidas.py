#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Módulo para gerenciar roletas permitidas
Arquivo separado para facilitar atualizações de configuração
"""

import os
import logging
from dotenv import load_dotenv

# Configurar logger
logger = logging.getLogger('runcash')

# Carregar variáveis de ambiente
load_dotenv()

# Obter a lista de roletas permitidas da variável de ambiente
env_allowed_roulettes = os.environ.get('ALLOWED_ROULETTES', '')
env_vite_allowed_roulettes = os.environ.get('VITE_ALLOWED_ROULETTES', '')

# Lista de roletas permitidas (GameIDs específicos)
ALLOWED_ROULETTES = [
    "2010165", "2010033", "2010016", "2380373", "2010440", "2380390", 
    "2010565", "2380346", "2380049", "2380064", "2010048", "2010045", 
    "2380159", "2380335", "2380117", "2010143", "2380010", "2380038", 
    "2010096", "2010065", "2010059", "2010108", "2010170", "2010017", 
    "2380033", "2380032", "2380034", "2380039", "2010100", "2010098", 
    "2010097", "2010012", "2010110", "2010031", "2010106", "2010011", 
    "2010049", "2010336", "2010099"
]

print(f"[DEBUG] Lista de roletas permitidas: {len(ALLOWED_ROULETTES)} roletas configuradas")

def roleta_permitida_por_id(roleta_id):
    """
    Verifica se uma roleta está permitida
    
    Args:
        roleta_id: ID da roleta para verificar
        
    Returns:
        bool: True se a roleta estiver na lista de permitidas, False caso contrário
    """
    # Verificar se o ID está na lista de permitidos
    return roleta_id in ALLOWED_ROULETTES

# Para debug
if __name__ == "__main__":
    print(f"Lista de roletas permitidas: {len(ALLOWED_ROULETTES)} roletas")
    print(f"IDs: {', '.join(ALLOWED_ROULETTES)}") 