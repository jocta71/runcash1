#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Rotas adicionais da API
"""

import os
import sys
import json
import logging
from flask import jsonify, request
import importlib.util

# Variável global para o Flask app
app = None

# Função para registrar rotas no app Flask
def register_routes(flask_app):
    global app
    app = flask_app
    
    # Registrar todas as rotas no app Flask
    app.add_url_rule('/api/allowed-roulettes', 'get_allowed_roulettes', get_allowed_roulettes, methods=['GET'])
    
    print("[INFO] Rotas da API registradas com sucesso")
    return app

# Decorator para logging
def log_request_info(f):
    def wrapper(*args, **kwargs):
        print(f"[API] Recebida requisição para {f.__name__}")
        return f(*args, **kwargs)
    
    # Preservar metadados
    wrapper.__name__ = f.__name__
    return wrapper

@log_request_info
def get_allowed_roulettes():
    """Retorna a lista de IDs de roletas permitidas"""
    try:
        # Importar diretamente da config/ambiente
        try:
            # Tentar importar de forma dinâmica
            if importlib.util.find_spec("config") is not None:
                config = importlib.import_module("config")
                from config import roleta_permitida_por_id
                
                # Verificar se há uma lista definida no arquivo config
                if hasattr(config, "ROLETAS_PERMITIDAS"):
                    allowed_ids = config.ROLETAS_PERMITIDAS
                else:
                    # Caso não tenha, usar a variável de ambiente
                    allowed_ids = os.environ.get('ALLOWED_ROULETTES', '').split(',')
                    allowed_ids = [r.strip() for r in allowed_ids if r.strip()]
                    
                    # Se não houver nada configurado, usar valores padrão
                    if not allowed_ids:
                        allowed_ids = [
                            "2010016",  # Immersive Roulette
                            "2380335",  # Brazilian Mega Roulette
                            "2010065",  # Bucharest Auto-Roulette
                            "2010096",  # Speed Auto Roulette
                            "2010017",  # Auto-Roulette
                            "2010098"   # Auto-Roulette VIP
                        ]
            else:
                raise ImportError("Módulo 'config' não encontrado")
        except ImportError:
            # Caso não consiga importar, usar variável de ambiente
            allowed_ids = os.environ.get('ALLOWED_ROULETTES', '').split(',')
            allowed_ids = [r.strip() for r in allowed_ids if r.strip()]
            
            # Se não houver nada configurado, usar valores padrão
            if not allowed_ids:
                allowed_ids = [
                    "2010016",  # Immersive Roulette
                    "2380335",  # Brazilian Mega Roulette
                    "2010065",  # Bucharest Auto-Roulette
                    "2010096",  # Speed Auto Roulette
                    "2010017",  # Auto-Roulette
                    "2010098"   # Auto-Roulette VIP
                ]
        
        # Adicionar informações de nome, se disponíveis
        roulette_names = {
            "2010016": "Immersive Roulette",
            "2380335": "Brazilian Mega Roulette",
            "2010065": "Bucharest Auto-Roulette",
            "2010096": "Speed Auto Roulette",
            "2010017": "Auto-Roulette",
            "2010098": "Auto-Roulette VIP"
        }
        
        # Criar lista de objetos com id e nome
        roulettes = []
        for id in allowed_ids:
            name = roulette_names.get(id, f"Roleta {id}")
            roulettes.append({"id": id, "name": name})
        
        print(f"[API] Retornando {len(allowed_ids)} roletas permitidas")
        return jsonify({
            "success": True,
            "allowed_ids": allowed_ids,
            "roulettes": roulettes
        })
    except Exception as e:
        print(f"[ERRO] Erro ao obter roletas permitidas: {e}")
        if app and hasattr(app, 'logger'):
            app.logger.error(f"Erro ao obter roletas permitidas: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "allowed_ids": []
        }), 500 