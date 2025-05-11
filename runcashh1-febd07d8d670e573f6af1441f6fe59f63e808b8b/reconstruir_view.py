#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para reconstruir a view unificada apenas com as coleções de IDs numéricos.
Este script:
1. Remove a view existente
2. Identifica todas as coleções com IDs numéricos
3. Cria uma nova view unificando essas coleções
"""

import os
import re
import sys
import logging
import pymongo
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("reconstruir_view.log")
    ]
)
logger = logging.getLogger("ReconstruirView")

def reconstruir_view():
    """Reconstrói a view unificada com as coleções de IDs numéricos"""
    print("=== RECONSTRUÇÃO DA VIEW UNIFICADA ===")
    print("Incluindo apenas coleções com IDs numéricos")
    
    # Obter URI do MongoDB
    mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash')
    
    try:
        # Conectar ao MongoDB
        print("\nConectando ao MongoDB Atlas...")
        client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        
        # Verificar conexão
        client.server_info()
        print("✓ Conectado ao MongoDB Atlas com sucesso!")
        
        # Acessar banco de dados de roletas
        db_roletas = client["roletas_db"]
        
        # Verificar se o banco existe
        if "roletas_db" not in client.list_database_names():
            print("✗ Banco de dados 'roletas_db' não encontrado!")
            return
        
        # Listar coleções
        colecoes = db_roletas.list_collection_names()
        print(f"\nColeções encontradas: {len(colecoes)}")
        
        # Identificar coleções de IDs numéricos
        id_numerico_pattern = re.compile(r'^[0-9]{7}$')
        colecoes_numericas = [col for col in colecoes 
                            if col not in ["metadados", "estatisticas", "numeros_view"] 
                            and not col.startswith("system.")
                            and id_numerico_pattern.match(col)]
        
        print(f"Coleções com IDs numéricos: {len(colecoes_numericas)}")
        
        if not colecoes_numericas:
            print("Nenhuma coleção numérica encontrada para criar a view!")
            return
        
        # Confirmar com o usuário
        confirmacao = input("\nAtualizar a view 'numeros_view' com as coleções numéricas? (s/n): ")
        if confirmacao.lower() not in ["s", "sim", "y", "yes"]:
            print("Operação cancelada pelo usuário.")
            return
        
        # Remover view se existir
        if "numeros_view" in colecoes:
            print("\nRemovendo view existente...")
            db_roletas.command("drop", "numeros_view")
            print("✓ View removida com sucesso!")
        
        print("\nCriando nova view com coleções:")
        for i, colecao in enumerate(colecoes_numericas[:5]):
            print(f"  {i+1}. {colecao}")
        
        if len(colecoes_numericas) > 5:
            print(f"  ... (e mais {len(colecoes_numericas) - 5} coleções)")
        
        # Criar view usando abordagem simples para evitar problemas com o $unionWith
        try:
            # Método 1: Usando $unionWith
            pipeline = []
            
            if len(colecoes_numericas) > 1:
                # Primeira coleção é a base
                primeira_colecao = colecoes_numericas[0]
                
                # Adicionar as demais usando $unionWith
                for colecao in colecoes_numericas[1:]:
                    pipeline.append({"$unionWith": {"coll": colecao}})
                
                # Criar view
                db_roletas.command(
                    "create",
                    "numeros_view",
                    viewOn=primeira_colecao,
                    pipeline=pipeline
                )
                print(f"✓ View 'numeros_view' criada com {len(colecoes_numericas)} coleções!")
            else:
                # Se tiver apenas uma coleção, cria view direta
                db_roletas.command(
                    "create",
                    "numeros_view",
                    viewOn=colecoes_numericas[0],
                    pipeline=[]
                )
                print(f"✓ View 'numeros_view' criada com 1 coleção!")
        except Exception as e:
            print(f"✗ Erro ao criar view (Método 1): {str(e)}")
            
            try:
                print("\nTentando método alternativo...")
                # Método 2: Usando aggregation na aplicação
                resultado = db_roletas.create_collection(
                    "numeros_view",
                    viewOn=colecoes_numericas[0],
                    pipeline=[]
                )
                print(f"✓ View 'numeros_view' criada (apenas com a coleção base: {colecoes_numericas[0]})")
                print("  Nota: Esta view não contém todas as coleções devido a limitações do MongoDB Atlas")
            except Exception as e2:
                print(f"✗ Erro ao criar view (Método 2): {str(e2)}")
        
        # Verificar se a view foi criada
        colecoes_atuais = db_roletas.list_collection_names()
        if "numeros_view" in colecoes_atuais:
            print("\n✓ View 'numeros_view' encontrada no banco de dados!")
        else:
            print("\n✗ View 'numeros_view' não encontrada no banco de dados!")
        
        # Fechar conexão
        client.close()
        print("\nConexão com MongoDB Atlas fechada.")
        
    except Exception as e:
        print(f"Erro durante a reconstrução da view: {str(e)}")
    
    print("\n=== RECONSTRUÇÃO CONCLUÍDA ===")

if __name__ == "__main__":
    reconstruir_view()
    input("\nPressione ENTER para sair...") 