#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para verificar e corrigir a configuração do MongoDB
"""

import os
import sys
import json
import time
from datetime import datetime

def main():
    """Função principal para verificar e corrigir a configuração do MongoDB"""
    print("=== Verificador de Configuração do MongoDB Atlas ===")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Diretório atual: {os.getcwd()}")
    
    # Configurações do MongoDB Atlas
    mongodb_uri = os.environ.get('MONGODB_URI')
    mongodb_db_name = os.environ.get('MONGODB_DB_NAME', 'runcash')
    mongodb_enabled = os.environ.get('MONGODB_ENABLED', 'true')
    railway_url = os.environ.get('RAILWAY_URL', 'https://runcash1-production.up.railway.app')
    
    print("\nVariáveis de ambiente:")
    print(f"MONGODB_URI: {mongodb_uri}")
    print(f"MONGODB_DB_NAME: {mongodb_db_name}")
    print(f"MONGODB_ENABLED: {mongodb_enabled}")
    print(f"RAILWAY_URL: {railway_url}")
    
    # Criar ou atualizar o arquivo .env
    print("\nCriando/atualizando arquivo .env com configurações do MongoDB Atlas...")
    
    try:
        env_path = os.path.join(os.getcwd(), '.env')
        
        # Ler conteúdo atual do arquivo se existir
        env_content = ""
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                env_content = f.read()
        
        # Adicionar ou atualizar configurações do MongoDB
        mongodb_configs = [
            "# Configuração do MongoDB",
            f"MONGODB_URI={mongodb_uri}",
            f"MONGODB_DB_NAME={mongodb_db_name}",
            "MONGODB_ENABLED=true",
            f"RAILWAY_URL={railway_url}"
        ]
        
        # Verificar se as configurações já existem no arquivo
        if "MONGODB_URI=" not in env_content:
            env_content += "\n\n" + "\n".join(mongodb_configs)
            
            # Escrever o arquivo atualizado
            with open(env_path, 'w') as f:
                f.write(env_content)
            
            print(f"✅ Arquivo .env atualizado com sucesso em: {env_path}")
        else:
            print("ℹ️ Configurações do MongoDB já existem no arquivo .env.")
    except Exception as e:
        print(f"❌ Erro ao atualizar arquivo .env: {str(e)}")
    
    # Tentar conectar ao MongoDB
    try:
        print("\nTentando conectar ao MongoDB Atlas...")
        
        # Definir variáveis de ambiente para garantir
        os.environ['MONGODB_URI'] = mongodb_uri
        os.environ['MONGODB_DB_NAME'] = mongodb_db_name
        os.environ['MONGODB_ENABLED'] = 'true'
        
        import pymongo
        
        client = pymongo.MongoClient(
            mongodb_uri,
            serverSelectionTimeoutMS=10000
        )
        
        # Verificar conexão
        client.server_info()
        db = client[mongodb_db_name]
        
        print("✅ Conexão ao MongoDB Atlas estabelecida com sucesso!")
        
        # Listar coleções
        collections = db.list_collection_names()
        print(f"\nColeções disponíveis ({len(collections)}):")
        for coll in collections:
            print(f"- {coll}")
        
        # Verificar e criar coleções necessárias
        required_collections = ['roletas', 'roleta_numeros', 'roleta_estatisticas_diarias', 'roleta_sequencias']
        
        for coll_name in required_collections:
            if coll_name not in collections:
                print(f"\nCriando coleção {coll_name}...")
                db.create_collection(coll_name)
                print(f"✅ Coleção {coll_name} criada com sucesso!")
        
        # Testar inserção
        if 'roleta_numeros' in collections:
            print("\nVerificando coleção roleta_numeros...")
            
            # Contar documentos
            count = db.roleta_numeros.count_documents({})
            print(f"Total de documentos: {count}")
            
            if count > 0:
                # Mostrar alguns documentos recentes
                print("\nÚltimos documentos inseridos:")
                latest = list(db.roleta_numeros.find().sort("timestamp", -1).limit(5))
                for i, doc in enumerate(latest):
                    print(f"{i+1}. Roleta: {doc.get('roleta_nome')}, Número: {doc.get('numero')}, Timestamp: {doc.get('timestamp')}")
            else:
                # Testar inserção se não houver documentos
                print("\nTestando inserção na coleção roleta_numeros...")
                result = db.roleta_numeros.insert_one({
                    'roleta_id': 'test_id',
                    'roleta_nome': 'Roleta de Teste',
                    'numero': 17,
                    'cor': 'preto',
                    'timestamp': datetime.now(),
                    'teste': True
                })
                
                print(f"✅ Documento de teste inserido com ID: {result.inserted_id}")
                print("⚠️ Removendo documento de teste...")
                
                db.roleta_numeros.delete_one({'_id': result.inserted_id})
                print("✅ Documento de teste removido com sucesso!")
        
        # Testar acesso à URL do Railway
        print(f"\nVerificando acesso à URL do Railway: {railway_url}")
        import requests
        
        try:
            response = requests.get(railway_url, timeout=10)
            print(f"✅ URL do Railway respondeu com status: {response.status_code}")
            print(f"Resposta: {response.text[:100]}...")  # Mostrar primeiros 100 caracteres
        except Exception as e:
            print(f"❌ Erro ao acessar a URL do Railway: {str(e)}")
        
        print("\n✅ Verificação concluída com sucesso!")
        
    except pymongo.errors.ServerSelectionTimeoutError:
        print("❌ Tempo limite excedido ao tentar conectar ao MongoDB Atlas!")
        print("Verifique se o cluster MongoDB Atlas está acessível e se as credenciais estão corretas.")
    except pymongo.errors.ConnectionFailure:
        print("❌ Falha na conexão com o MongoDB Atlas!")
        print("Verifique se o cluster MongoDB Atlas está acessível e se as credenciais estão corretas.")
    except ImportError:
        print("❌ Pacotes necessários não encontrados. Instale usando:")
        print("pip install pymongo requests python-dotenv")
    except Exception as e:
        print(f"❌ Erro ao conectar ao MongoDB Atlas: {str(e)}")
    
    print("\n=== Verificação concluída ===")

if __name__ == "__main__":
    main() 