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

# Lista de roletas permitidas (apenas para manter compatibilidade)
ALLOWED_ROULETTES = [
    "2010016",  # Immersive Roulette
    "2380335",  # Brazilian Mega Roulette
    "2010065",  # Bucharest Auto-Roulette
    "2010096",  # Speed Auto Roulette
    "2010017",  # Auto-Roulette
    "2010098"   # Auto-Roulette VIP
]

print("[DEBUG] Modo permissivo ativado: Todas as roletas estão permitidas")

def roleta_permitida_por_id(roleta_id):
    """
    Verifica se uma roleta está permitida (sempre retorna True)
    
    Args:
        roleta_id: ID da roleta para verificar
        
    Returns:
        bool: True para todas as roletas
    """
    # MODO PERMISSIVO: Permitir todas as roletas
    return True

# Para debug
if __name__ == "__main__":
    print(f"Modo permissivo ativado: Todas as roletas estão permitidas") 