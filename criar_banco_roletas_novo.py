#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para criar um novo banco de dados otimizado para roletas.
Utiliza o formato de coleção simplificado: apenas o ID da roleta.
"""

import os
import sys
import logging
import pymongo
from datetime import datetime, timedelta
from typing import List, Dict, Any
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("criar_banco_roletas.log")
    ]
)
logger = logging.getLogger("CriarBancoRoletas")

def criar_banco():
    """Cria um banco de dados otimizado para roletas"""
    print("=== CRIANDO BANCO DE DADOS SEPARADO PARA ROLETAS ===")
    
    # Configurações
    mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash')
    db_original = "runcash"
    db_roletas = "roletas_db"
    
    print(f"\nUsando MongoDB Atlas URI: {mongodb_uri[:25]}...")
    print(f"Banco original: {db_original}")
    print(f"Novo banco para roletas: {db_roletas}")
    
    try:
        # Obter roletas do banco original
        roletas = obter_roletas_existentes(mongodb_uri, db_original)
        print(f"Total de roletas: {len(roletas)}")
        
        # Conectar ao MongoDB Atlas
        print(f"Conectando ao MongoDB Atlas...")
        client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
        
        # Verificar conexão
        client.server_info()
        print(f"✓ Conectado ao MongoDB Atlas com sucesso!")
        
        # Acessar bancos de dados
        db = client[db_roletas]
        
        # Listar bancos existentes
        dbs = client.list_database_names()
        print(f"\nBancos de dados existentes: {', '.join(dbs)}")
        
        print(f"\nCriando novo banco de dados: {db_roletas}")
        
        # Criar coleção de metadados
        print("\n== CRIANDO COLEÇÃO DE METADADOS ==")
        if "metadados" not in db.list_collection_names():
            db.create_collection("metadados")
            db.metadados.create_index("roleta_id", unique=True)
            print(f"✓ Coleção 'metadados' criada com índice em 'roleta_id'")
        else:
            print(f"Coleção 'metadados' já existe.")
        
        # Obter informações das roletas
        print("\n== OBTENDO INFORMAÇÕES DAS ROLETAS ==")
        for roleta in roletas:
            # Inserir metadados
            db.metadados.update_one(
                {"roleta_id": roleta["id"]},
                {"$set": {
                    "roleta_id": roleta["id"],
                    "roleta_nome": roleta["nome"],
                    "colecao": roleta["id"],  # Agora a coleção tem apenas o ID
                    "ativa": True,
                    "atualizado_em": datetime.now()
                }},
                upsert=True
            )
        
        # Criar coleções para cada roleta
        print("\n== CRIANDO COLEÇÕES PARA CADA ROLETA ==")
        for roleta in roletas:
            colecao_nome = roleta["id"]  # Formato novo: apenas ID
            
            # Criar coleção se não existir
            if colecao_nome not in db.list_collection_names():
                db.create_collection(colecao_nome)
                
                # Criar índices
                db[colecao_nome].create_index([("timestamp", pymongo.DESCENDING)])
                db[colecao_nome].create_index([("numero", pymongo.ASCENDING)])
                db[colecao_nome].create_index([("cor", pymongo.ASCENDING)])
                
                print(f"✓ Criada coleção '{colecao_nome}' para roleta '{roleta['nome']}'")
            else:
                print(f"Coleção '{colecao_nome}' para roleta '{roleta['nome']}' já existe.")
        
        # Criar view unificada para consulta global
        print("\n== CRIANDO VIEW UNIFICADA ==")
        # Obter todas as coleções de roletas
        colecoes_roletas = [
            col for col in db.list_collection_names() 
            if col not in ["metadados", "estatisticas", "numeros_view"] and not col.startswith("system.")
        ]
        
        print(f"Coleções de roletas encontradas: {len(colecoes_roletas)}")
        
        # Criar view se existirem coleções
        if colecoes_roletas:
            # Remover view se existir
            if "numeros_view" in db.list_collection_names():
                db.command("drop", "numeros_view")
            
            # Pipeline de agregação para union
            pipeline = []
            for colecao in colecoes_roletas[1:]:  # Pegar a partir do segundo
                pipeline.append({"$unionWith": colecao})
            
            # Criar view
            db.command(
                "create",
                "numeros_view",
                viewOn=colecoes_roletas[0],  # Primeira coleção
                pipeline=pipeline
            )
            
            print(f"✓ View 'numeros_view' criada com {len(colecoes_roletas)} coleções!")
        else:
            print("⚠️ Nenhuma coleção de roleta encontrada para criar a view!")
        
        # Resumo da estrutura
        print("\n== RESUMO DA NOVA ESTRUTURA ==")
        colecoes = db.list_collection_names()
        print(f"Total de coleções no banco '{db_roletas}': {len(colecoes)}")
        
        # Detalhes das coleções
        print("Coleções:")
        for colecao in colecoes:
            if colecao == "numeros_view":
                print(f"- {colecao}: VIEW documentos")
            else:
                count = db[colecao].count_documents({})
                print(f"- {colecao}: {count} documentos")
        
        # Fechar conexão
        client.close()
        
        print("\n=== BANCO DE DADOS PARA ROLETAS CRIADO COM SUCESSO! ===")
        print(f"Nome do banco: {db_roletas}")
        print(f"Total de coleções: {len(colecoes)}")
        print(f"Use este banco para armazenar os números das {len(roletas)} roletas monitoradas.")
        
        print("\nConexão com MongoDB Atlas fechada.")
        
    except Exception as e:
        print(f"Erro durante a criação do banco de dados: {str(e)}")

def obter_roletas_existentes(uri: str, db_nome: str) -> List[Dict[str, Any]]:
    """
    Obtém as roletas existentes no banco original
    
    Args:
        uri (str): URI do MongoDB
        db_nome (str): Nome do banco de dados
        
    Returns:
        List[Dict[str, Any]]: Lista de roletas
    """
    roletas = []
    
    try:
        # Conectar ao MongoDB
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
        db = client[db_nome]
        
        # Verificar coleção de roletas
        print("Verificando coleção 'roletas'...")
        if "roletas" in db.list_collection_names():
            for doc in db.roletas.find({}):
                if "_id" in doc and "nome" in doc:
                    roletas.append({
                        "id": str(doc["_id"]),
                        "nome": doc["nome"]
                    })
        
        # Verificar coleção de estratégias de roletas
        print("Verificando coleção 'roulettestrategies'...")
        if "roulettestrategies" in db.list_collection_names():
            for doc in db.roulettestrategies.find({}):
                if "roletaNome" in doc and "roletaId" in doc:
                    # Verificar se a roleta já existe na lista
                    existe = False
                    for r in roletas:
                        if r["id"] == str(doc["roletaId"]):
                            existe = True
                            break
                    
                    if not existe:
                        roletas.append({
                            "id": str(doc["roletaId"]),
                            "nome": doc["roletaNome"]
                        })
        
        # Verificar coleção de estratégias
        print("Verificando coleção 'strategies'...")
        if "strategies" in db.list_collection_names():
            for doc in db.strategies.find({}):
                if "roletaNome" in doc and "roletaId" in doc:
                    # Verificar se a roleta já existe na lista
                    existe = False
                    for r in roletas:
                        if r["id"] == str(doc["roletaId"]):
                            existe = True
                            break
                    
                    if not existe:
                        roletas.append({
                            "id": str(doc["roletaId"]),
                            "nome": doc["roletaNome"]
                        })
        
        # Verificar na coleção de números para roletas sem ID
        print("Verificando coleção 'roleta_numeros' para nomes de roletas...")
        if "roleta_numeros" in db.list_collection_names():
            # Consulta de agregação para obter roletas distintas
            pipeline = [
                {"$group": {
                    "_id": {
                        "roleta_id": "$roleta_id",
                        "roleta_nome": "$roleta_nome"
                    }
                }},
                {"$project": {
                    "_id": 0,
                    "id": "$_id.roleta_id",
                    "nome": "$_id.roleta_nome"
                }}
            ]
            
            resultado = list(db.roleta_numeros.aggregate(pipeline))
            
            for doc in resultado:
                if "id" in doc and "nome" in doc:
                    # Verificar se a roleta já existe na lista
                    existe = False
                    for r in roletas:
                        if r["id"] == str(doc["id"]):
                            existe = True
                            break
                    
                    if not existe:
                        roletas.append({
                            "id": str(doc["id"]),
                            "nome": doc["nome"]
                        })
        
        # Fechar conexão
        client.close()
        
        print(f"Encontradas informações para {len(roletas)} roletas")
        
    except Exception as e:
        print(f"Erro ao obter roletas existentes: {str(e)}")
    
    return roletas

if __name__ == "__main__":
    criar_banco()
    input("\nPressione Enter para sair...") 