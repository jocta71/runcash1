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

# Obter lista de roletas permitidas do ambiente
def get_allowed_roulettes_from_env():
    """
    Obtém a lista de roletas permitidas das variáveis de ambiente
    Verifica em ordem de prioridade ALLOWED_ROULETTES e VITE_ALLOWED_ROULETTES
    """
    # Verificar primeira variável de ambiente
    env_roulettes = os.environ.get('ALLOWED_ROULETTES', '')
    
    # Se não encontrou, verificar segunda variável de ambiente
    if not env_roulettes or not env_roulettes.strip():
        env_roulettes = os.environ.get('VITE_ALLOWED_ROULETTES', '')
    
    # Se encontrou alguma variável preenchida, processar
    if env_roulettes and env_roulettes.strip():
        # Converter string para lista e remover espaços
        roulette_list = [r.strip() for r in env_roulettes.split(',') if r.strip()]
        print(f"[DEBUG] Roletas permitidas da variável de ambiente: {','.join(roulette_list)}")
        return roulette_list
    
    # Se não encontrou nenhuma variável, retornar lista vazia
    return []

# Lista padrão de roletas permitidas (caso não tenha no ambiente)
DEFAULT_ALLOWED_ROULETTES = [
    "2010016",  # Immersive Roulette
    "2380335",  # Brazilian Mega Roulette
    "2010065",  # Bucharest Auto-Roulette
    "2010096",  # Speed Auto Roulette
    "2010017",  # Auto-Roulette
    "2010098"   # Auto-Roulette VIP
]

# Usar roletas do ambiente ou a lista padrão
env_roulettes = get_allowed_roulettes_from_env()
ALLOWED_ROULETTES = env_roulettes if env_roulettes else DEFAULT_ALLOWED_ROULETTES

# Imprimir informações para diagnóstico
print(f"[DEBUG] Roletas permitidas configuradas: {ALLOWED_ROULETTES}")

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