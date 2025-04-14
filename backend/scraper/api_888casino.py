#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
API 888Casino - Módulo de simulação para substituir a API do 888Casino
Este módulo fornece funções simuladas para permitir que o scraper funcione sem a API real
"""

import random
import time
import logging
from datetime import datetime

# Configurar logger
logger = logging.getLogger('runcash')

class Casino888API:
    """Classe que simula a API do 888Casino"""
    
    def __init__(self, base_url=None):
        """
        Inicializa o cliente da API
        
        Args:
            base_url (str, optional): URL base da API. Não é usado na versão simulada.
        """
        self.initialized = True
        self.base_url = base_url or "https://888casino.com/live-casino/#filters=live-roulette"
        logger.info(f"API 888Casino Simulator inicializada com URL: {self.base_url}")
        
        # Roletas simuladas (usar IDs que estão nas listas de permitidas)
        self.roulettes = {
            "2010016": {"name": "Immersive Roulette", "last_numbers": []},
            "2380335": {"name": "Brazilian Mega Roulette", "last_numbers": []},
            "2010065": {"name": "Bucharest Auto-Roulette", "last_numbers": []},
            "2010096": {"name": "Speed Auto Roulette", "last_numbers": []},
            "2010017": {"name": "Auto-Roulette", "last_numbers": []},
            "2010098": {"name": "Auto-Roulette VIP", "last_numbers": []}
        }
        
        # Gerar alguns números aleatórios para cada roleta
        for roleta_id in self.roulettes:
            self.roulettes[roleta_id]["last_numbers"] = [
                random.randint(0, 36) for _ in range(random.randint(5, 10))
            ]
    
    def get_roulette_tables(self, regulation_id=None):
        """
        Obtém as mesas de roleta disponíveis (simuladas)
        
        Args:
            regulation_id (int, optional): ID de regulamentação. Não usado na versão simulada.
            
        Returns:
            dict: Dicionário com as mesas de roleta
        """
        logger.info(f"Buscando mesas de roleta com regulation_id: {regulation_id}")
        
        # Simular um pequeno atraso para parecer com uma API real
        time.sleep(0.5)
        
        # Atualizar números aleatoriamente para cada chamada
        for roleta_id in self.roulettes:
            # Adicionar um novo número aleatório a cada chamada (às vezes)
            if random.random() > 0.7:  # 30% de chance de adicionar um novo número
                new_number = random.randint(0, 36)
                self.roulettes[roleta_id]["last_numbers"].insert(0, new_number)
                # Manter só os últimos 20 números
                if len(self.roulettes[roleta_id]["last_numbers"]) > 20:
                    self.roulettes[roleta_id]["last_numbers"] = self.roulettes[roleta_id]["last_numbers"][:20]
        
        # Retornar as roletas simuladas
        return self.roulettes
    
    def get_all_roulette_tables(self):
        """
        Obtém todas as mesas de roleta (simuladas)
        
        Returns:
            dict: Dicionário com todas as mesas de roleta
        """
        logger.info("Buscando todas as mesas de roleta")
        return self.get_roulette_tables()
    
    def get_table_info(self, table_id):
        """
        Obtém informações de uma mesa específica (simuladas)
        
        Args:
            table_id (str): ID da mesa
            
        Returns:
            dict: Dicionário com informações da mesa ou None se não encontrada
        """
        logger.info(f"Buscando informações da mesa {table_id}")
        return self.roulettes.get(table_id)

# Função para criar uma instância da API
def create_api_client(base_url=None):
    """
    Cria uma instância do cliente da API
    
    Args:
        base_url (str, optional): URL base da API
        
    Returns:
        Casino888API: Instância do cliente da API
    """
    return Casino888API(base_url)

# Função para verificar se a API está online
def check_api_status():
    """
    Verifica se a API está online (sempre retorna True)
    
    Returns:
        bool: True se a API estiver online
    """
    return True

# Exportar funções e classes importantes
__all__ = ['Casino888API', 'create_api_client', 'check_api_status'] 