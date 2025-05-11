#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Demonstração de coleções separadas por roleta no MongoDB Atlas (produção)
"""

import os
import sys
import pymongo
from datetime import datetime
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

print("=== DEMONSTRAÇÃO DE COLEÇÕES SEPARADAS POR ROLETA NO MONGODB ATLAS ===\n")

# Usar a conexão do MongoDB Atlas do arquivo .env
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash')
DB_NAME = "runcash"  # Nome fixo do banco no Atlas

print(f"Usando MongoDB Atlas URI: {MONGODB_URI[:30]}...{MONGODB_URI[-20:]}")

try:
    # Conectar ao MongoDB Atlas
    print(f"Conectando ao MongoDB Atlas...")
    client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    
    # Verificar conexão
    client.server_info()
    print("✓ Conectado ao MongoDB Atlas com sucesso!")
    
    # Listar coleções existentes
    collections = db.list_collection_names()
    print(f"\nColeções existentes no banco '{DB_NAME}':")
    for col in collections:
        print(f"- {col}")
    
    # Obter roletas existentes
    print("\n== ROLETAS EXISTENTES ==")
    roletas = list(db.roletas.find({"ativa": True}))
    
    if not roletas:
        print("Nenhuma roleta ativa encontrada no MongoDB Atlas.")
        # Criar uma roleta de exemplo se não existir
        roleta_id = "2380033"
        roleta_nome = "Roleta de Demonstração"
        
        db.roletas.insert_one({
            "_id": roleta_id,
            "nome": roleta_nome,
            "ativa": True,
            "criado_em": datetime.now(),
            "atualizado_em": datetime.now()
        })
        
        print(f"Criada roleta de exemplo: {roleta_nome} (ID: {roleta_id})")
        roletas = list(db.roletas.find({"ativa": True}))
    
    # Mostrar roletas
    for i, roleta in enumerate(roletas):
        print(f"{i+1}. {roleta.get('nome')} (ID: {roleta.get('_id')})")
    
    # Escolher a primeira roleta para demonstração
    roleta = roletas[0]
    roleta_id = str(roleta.get('_id'))
    roleta_nome = roleta.get('nome')
    
    print(f"\nUsando roleta para demonstração: {roleta_nome} (ID: {roleta_id})")
    
    # Nome da coleção específica para esta roleta
    colecao_nome = f"roleta_numeros_{roleta_id}"
    
    # Verificar se a coleção já existe
    if colecao_nome in collections:
        print(f"Coleção {colecao_nome} já existe!")
        
        # Contar documentos
        count = db[colecao_nome].count_documents({})
        print(f"Total de documentos na coleção: {count}")
    else:
        print(f"Criando nova coleção: {colecao_nome}")
        
        # Criar índices
        db[colecao_nome].create_index([("timestamp", pymongo.DESCENDING)])
        db[colecao_nome].create_index([("numero", pymongo.ASCENDING)])
        db[colecao_nome].create_index([("cor", pymongo.ASCENDING)])
        print("✓ Índices criados!")
    
    # Inserir alguns números de exemplo
    print("\n== INSERINDO DADOS DE EXEMPLO ==")
    
    # Definir alguns números para demonstração
    numeros_teste = [10, 25, 0, 36, 15]
    
    for numero in numeros_teste:
        # Determinar cor (simplificado)
        if numero == 0:
            cor = "verde"
        elif numero % 2 == 0:
            cor = "preto"
        else:
            cor = "vermelho"
            
        # Criar documento
        documento = {
            "roleta_id": roleta_id,
            "roleta_nome": roleta_nome,
            "numero": numero,
            "cor": cor,
            "timestamp": datetime.now(),
            "criado_em": datetime.now()
        }
        
        # Inserir na coleção específica
        result = db[colecao_nome].insert_one(documento)
        
        if result.inserted_id:
            print(f"✓ Número {numero} ({cor}) inserido com sucesso!")
        else:
            print(f"✗ Falha ao inserir número {numero}")
    
    # Buscar números inseridos
    print("\n== NÚMEROS RECENTES DA ROLETA ==")
    numeros = list(db[colecao_nome].find().sort("timestamp", pymongo.DESCENDING).limit(10))
    
    for i, num in enumerate(numeros[:10]):
        timestamp = num.get("timestamp").strftime("%H:%M:%S") if "timestamp" in num else "N/A"
        print(f"{i+1}. Número: {num.get('numero')} | Cor: {num.get('cor')} | Timestamp: {timestamp}")
    
    # Demonstrar uso da view unificada
    print("\n== CRIANDO VIEW UNIFICADA ==")
    
    # Obter todas as coleções de roletas
    colecoes_roletas = [col for col in db.list_collection_names() if col.startswith("roleta_numeros_")]
    print(f"Coleções de roletas encontradas: {len(colecoes_roletas)}")
    for col in colecoes_roletas:
        print(f"- {col}")
    
    # Verificar se a view já existe
    if "roleta_numeros_view" in db.list_collection_names():
        print("View 'roleta_numeros_view' já existe. Removendo...")
        db.command("drop", "roleta_numeros_view")
    
    if colecoes_roletas:
        # Construir pipeline para união
        pipeline = []
        primeira_colecao = colecoes_roletas[0]
        
        for colecao in colecoes_roletas[1:]:
            pipeline.append({"$unionWith": {"coll": colecao}})
        
        # Criar view
        db.command(
            "create", 
            "roleta_numeros_view",
            viewOn=primeira_colecao,
            pipeline=pipeline
        )
        
        print(f"✓ View 'roleta_numeros_view' criada com {len(colecoes_roletas)} coleções!")
        
        # Contar documentos na view
        count_view = db.roleta_numeros_view.count_documents({})
        print(f"Total de documentos na view unificada: {count_view}")
    else:
        print("Nenhuma coleção de roleta encontrada para criar view.")
    
    # Verificar novamente as coleções após as alterações
    collections_apos = db.list_collection_names()
    print("\n== COLEÇÕES APÓS AS ALTERAÇÕES ==")
    for col in collections_apos:
        print(f"- {col}")
    
    print("\n=== DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO! ===")
    print("A estrutura de coleções separadas por roleta está implementada no MongoDB Atlas.")

except pymongo.errors.ConnectionFailure as e:
    print(f"Erro de conexão com MongoDB Atlas: {str(e)}")
except Exception as e:
    print(f"Erro durante a demonstração: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    # Fechar conexão
    if 'client' in locals():
        client.close()
        print("\nConexão com MongoDB Atlas fechada.")
    
    # Aguardar entrada do usuário para não fechar imediatamente
    input("\nPressione Enter para sair...") 