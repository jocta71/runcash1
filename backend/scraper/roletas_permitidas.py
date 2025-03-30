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

# Lista de roletas específicas permitidas (IDs)
# 2010016 - Immersive Roulette
# 2380335 - Brazilian Mega Roulette
# 2010065 - Bucharest Auto-Roulette
# 2010096 - Speed Auto Roulette
# 2010017 - Auto-Roulette
# 2010098 - Auto-Roulette VIP

# Obter lista de roletas permitidas do .env ou usar valores padrão
ALLOWED_ROULETTES_STR = os.environ.get('ALLOWED_ROULETTES', '2010016,2380335,2010065,2010096,2010017,2010098')

# Converter string em lista
ALLOWED_ROULETTES = ALLOWED_ROULETTES_STR.split(',')

# Remover "*" da lista se existir (não queremos permitir todas as roletas)
if "*" in ALLOWED_ROULETTES:
    ALLOWED_ROULETTES.remove("*")

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
    
    # Log detalhado para diagnóstico
    if not permitida:
        print(f"[DEBUG] Roleta rejeitada: ID={original_id}, ID_limpo={roleta_id}, não está na lista de permitidas")
    else:
        print(f"[DEBUG] Roleta aceita: ID={original_id}, ID_limpo={roleta_id}")
    
    return permitida

# Para debug
if __name__ == "__main__":
    print(f"Roletas permitidas: {ALLOWED_ROULETTES}") 