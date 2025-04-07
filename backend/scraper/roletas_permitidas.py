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

# Lista de roletas permitidas
if env_allowed_roulettes:
    # Usar a variável ALLOWED_ROULETTES se estiver definida
    ALLOWED_ROULETTES = [r.strip() for r in env_allowed_roulettes.split(',') if r.strip()]
    print(f"[DEBUG] Usando variável de ambiente ALLOWED_ROULETTES: {len(ALLOWED_ROULETTES)} roletas configuradas")
elif env_vite_allowed_roulettes:
    # Usar a variável VITE_ALLOWED_ROULETTES se ALLOWED_ROULETTES não estiver definida
    ALLOWED_ROULETTES = [r.strip() for r in env_vite_allowed_roulettes.split(',') if r.strip()]
    print(f"[DEBUG] Usando variável de ambiente VITE_ALLOWED_ROULETTES: {len(ALLOWED_ROULETTES)} roletas configuradas")
else:
    # Lista fixa de roletas permitidas como fallback
    ALLOWED_ROULETTES = [
        "2010016",  # Immersive Roulette
        "2380335",  # Brazilian Mega Roulette
        "2010065",  # Bucharest Auto-Roulette
        "2010096",  # Speed Auto Roulette
        "2010017",  # Auto-Roulette
        "2010098"   # Auto-Roulette VIP
    ]
    print(f"[DEBUG] Usando lista fixa de roletas: {len(ALLOWED_ROULETTES)} roletas configuradas")

# Imprimir informações para diagnóstico
print(f"[DEBUG] Roletas permitidas: {ALLOWED_ROULETTES}")

def roleta_permitida_por_id(roleta_id):
    """
    Verifica se uma roleta está na lista de permitidas pelo ID
    
    Args:
        roleta_id: ID da roleta para verificar
        
    Returns:
        bool: True se a roleta está permitida, False caso contrário
    """
    # Remover qualquer prefixo/sufixo do ID (às vezes ocorre)
    original_id = roleta_id
    if '_' in roleta_id:
        roleta_id = roleta_id.split('_')[0]
    
    # Verificar se a roleta está na lista de permitidas
    permitida = roleta_id in ALLOWED_ROULETTES
    
    # Log apenas para roletas aceitas
    if permitida:
        print(f"[DEBUG] Roleta aceita: ID={original_id}, ID_limpo={roleta_id}")
    
    return permitida

# Para debug
if __name__ == "__main__":
    print(f"Roletas permitidas: {ALLOWED_ROULETTES}") 