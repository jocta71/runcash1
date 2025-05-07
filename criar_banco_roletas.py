#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para criar o banco de dados roletas_db com a nova estrutura de coleções separadas.
"""

import os
import sys
import pymongo
from datetime import datetime
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

print("=== CRIANDO BANCO DE DADOS SEPARADO PARA ROLETAS ===\n")

# Usar a conexão do MongoDB Atlas do arquivo .env
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash')
DB_ORIGINAL = "runcash"          # Banco original
DB_ROLETAS = "roletas_db"        # Novo banco para roletas

# IDs das roletas permitidas
ROLETAS_IDS = [
    "2010165", "2010033", "2010016", "2380373", "2010440", "2380390", 
    "2010565", "2380346", "2380049", "2380064", "2010048", "2010045", 
    "2380159", "2380335", "2380117", "2010143", "2380010", "2380038", 
    "2010096", "2010065", "2010059", "2010108", "2010170", "2010017", 
    "2380033", "2380032", "2380034", "2380039", "2010100", "2010098", 
    "2010097", "2010012", "2010110", "2010031", "2010106", "2010011", 
    "2010049", "2010336", "2010099"
]

print(f"Usando MongoDB Atlas URI: {MONGODB_URI[:30]}...{MONGODB_URI[-20:]}")
print(f"Banco original: {DB_ORIGINAL}")
print(f"Novo banco para roletas: {DB_ROLETAS}")
print(f"Total de roletas: {len(ROLETAS_IDS)}")

try:
    # Conectar ao MongoDB Atlas
    print(f"Conectando ao MongoDB Atlas...")
    client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    
    # Verificar conexão
    client.server_info()
    print("✓ Conectado ao MongoDB Atlas com sucesso!")
    
    # Acessar o banco de dados original para informações das roletas
    db_original = client[DB_ORIGINAL]
    
    # Acessar/criar o novo banco de dados para roletas
    db_roletas = client[DB_ROLETAS]
    
    # Listar bancos existentes
    dbs = client.list_database_names()
    print(f"\nBancos de dados existentes: {', '.join(dbs)}")
    
    # Verificar se o banco já existe
    if DB_ROLETAS in dbs:
        # Perguntar se deseja continuar (útil se for executar manualmente)
        continuar = input(f"\nO banco de dados '{DB_ROLETAS}' já existe. Continuar mesmo assim? (s/N): ")
        if continuar.lower() != 's':
            print("Operação cancelada pelo usuário.")
            sys.exit(0)
    else:
        print(f"\nCriando novo banco de dados: {DB_ROLETAS}")
    
    # Criar coleção para metadados das roletas no novo banco
    if "metadados" not in db_roletas.list_collection_names():
        print("\n== CRIANDO COLEÇÃO DE METADADOS ==")
        db_roletas.create_collection("metadados")
        db_roletas.metadados.create_index([("roleta_id", pymongo.ASCENDING)], unique=True)
        print("✓ Coleção 'metadados' criada com índice em 'roleta_id'")
    
    # Obter informações das roletas do banco original
    print("\n== OBTENDO INFORMAÇÕES DAS ROLETAS ==")
    
    # Inicializar contador
    roletas_encontradas = 0
    nomes_roletas = {}
    
    # Procurar em várias coleções possíveis que contêm nomes de roletas
    for colecao in ["roletas", "roulettestrategies", "strategies"]:
        if colecao in db_original.list_collection_names():
            print(f"Verificando coleção '{colecao}'...")
            
            # Ajustar o campo de ID e nome baseado na coleção
            id_field = "_id" if colecao == "roletas" else "roleta_id"
            nome_field = "nome" if colecao == "roletas" else "roleta_nome"
            
            # Buscar documentos
            for doc in db_original[colecao].find({id_field: {"$in": ROLETAS_IDS}}):
                roleta_id = doc.get(id_field)
                roleta_nome = doc.get(nome_field)
                
                if roleta_id and roleta_nome and roleta_id in ROLETAS_IDS:
                    nomes_roletas[roleta_id] = roleta_nome
                    roletas_encontradas += 1
    
    # Verificar também na coleção roleta_numeros
    if "roleta_numeros" in db_original.list_collection_names():
        print(f"Verificando coleção 'roleta_numeros' para nomes de roletas...")
        
        # Usar distinct para obter valores únicos
        for roleta_id in ROLETAS_IDS:
            if roleta_id not in nomes_roletas:
                # Buscar um documento de exemplo para esta roleta
                doc = db_original.roleta_numeros.find_one({"roleta_id": roleta_id})
                if doc and "roleta_nome" in doc:
                    nomes_roletas[roleta_id] = doc["roleta_nome"]
                    roletas_encontradas += 1
    
    print(f"Encontradas informações para {roletas_encontradas} roletas")
    
    # Para IDs sem nome encontrado, usar nome genérico
    for roleta_id in ROLETAS_IDS:
        if roleta_id not in nomes_roletas:
            nomes_roletas[roleta_id] = f"Roleta {roleta_id}"
    
    # Criar coleções para cada roleta no novo banco
    print("\n== CRIANDO COLEÇÕES PARA CADA ROLETA ==")
    
    for roleta_id in ROLETAS_IDS:
        roleta_nome = nomes_roletas.get(roleta_id)
        colecao_nome = f"roleta_{roleta_id}"
        
        # Verificar se a coleção já existe
        if colecao_nome in db_roletas.list_collection_names():
            print(f"Coleção '{colecao_nome}' já existe para roleta '{roleta_nome}'")
        else:
            # Criar coleção
            db_roletas.create_collection(colecao_nome)
            
            # Criar índices
            db_roletas[colecao_nome].create_index([("timestamp", pymongo.DESCENDING)])
            db_roletas[colecao_nome].create_index([("numero", pymongo.ASCENDING)])
            db_roletas[colecao_nome].create_index([("cor", pymongo.ASCENDING)])
            
            print(f"✓ Criada coleção '{colecao_nome}' para roleta '{roleta_nome}'")
        
        # Adicionar ou atualizar metadados
        db_roletas.metadados.update_one(
            {"roleta_id": roleta_id},
            {"$set": {
                "roleta_id": roleta_id,
                "roleta_nome": roleta_nome,
                "colecao": colecao_nome,
                "ativa": True,
                "atualizado_em": datetime.now()
            }},
            upsert=True
        )
    
    # Criar view unificada
    print("\n== CRIANDO VIEW UNIFICADA ==")
    
    # Obter todas as coleções de roletas
    colecoes_roletas = [col for col in db_roletas.list_collection_names() if col.startswith("roleta_")]
    colecoes_roletas = [col for col in colecoes_roletas if col != "roleta_metadados"]
    
    print(f"Coleções de roletas encontradas: {len(colecoes_roletas)}")
    
    # Verificar se há coleções para criar view
    if colecoes_roletas:
        # Verificar se a view já existe
        if "numeros_view" in db_roletas.list_collection_names():
            print("View 'numeros_view' já existe. Removendo...")
            db_roletas.command("drop", "numeros_view")
        
        # Construir pipeline para união
        pipeline = []
        primeira_colecao = colecoes_roletas[0]
        
        for colecao in colecoes_roletas[1:]:
            pipeline.append({"$unionWith": {"coll": colecao}})
        
        # Adicionar campos de roleta_id e roleta_nome
        pipeline.append({
            "$addFields": {
                "roleta_id": {
                    "$arrayElemAt": [{"$split": ["$colecao", "_"]}, 1]
                },
                "colecao": "$$ROOT.colecao"
            }
        })
        
        # Adicionar lookup para obter roleta_nome
        pipeline.append({
            "$lookup": {
                "from": "metadados",
                "localField": "roleta_id",
                "foreignField": "roleta_id",
                "as": "metadata"
            }
        })
        
        # Adicionar campo roleta_nome
        pipeline.append({
            "$addFields": {
                "roleta_nome": {
                    "$ifNull": [
                        {"$arrayElemAt": ["$metadata.roleta_nome", 0]},
                        "Roleta Desconhecida"
                    ]
                }
            }
        })
        
        # Remover campo metadata
        pipeline.append({"$project": {"metadata": 0}})
        
        # Criar view
        db_roletas.command(
            "create", 
            "numeros_view",
            viewOn=primeira_colecao,
            pipeline=pipeline
        )
        
        print(f"✓ View 'numeros_view' criada com {len(colecoes_roletas)} coleções!")
    else:
        print("Nenhuma coleção de roleta encontrada para criar view.")
    
    # Imprimir resumo
    print("\n== RESUMO DA NOVA ESTRUTURA ==")
    
    # Listar coleções do novo banco
    cols = db_roletas.list_collection_names()
    print(f"Total de coleções no banco '{DB_ROLETAS}': {len(cols)}")
    print("Coleções:")
    for col in sorted(cols):
        # Contar documentos
        count = db_roletas[col].count_documents({}) if col != "numeros_view" else "VIEW"
        print(f"- {col}: {count} documentos")
    
    print("\n=== BANCO DE DADOS PARA ROLETAS CRIADO COM SUCESSO! ===")
    print(f"Nome do banco: {DB_ROLETAS}")
    print(f"Total de coleções: {len(cols)}")
    print(f"Use este banco para armazenar os números das {len(ROLETAS_IDS)} roletas monitoradas.")

except pymongo.errors.ConnectionFailure as e:
    print(f"Erro de conexão com MongoDB Atlas: {str(e)}")
except Exception as e:
    print(f"Erro durante a criação do banco: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    # Fechar conexão
    if 'client' in locals():
        client.close()
        print("\nConexão com MongoDB Atlas fechada.")
    
    # Aguardar entrada do usuário para não fechar imediatamente
    input("\nPressione Enter para sair...") 