#!/usr/bin/env python3

import os
import sys
from dotenv import load_dotenv

# Tentar carregar variáveis de ambiente de diferentes locais
load_dotenv('../.env')  # backend/.env
load_dotenv('../../.env')  # raiz do projeto

# Importar configuração do MongoDB
from config import MONGODB_URI, MONGODB_DB_NAME, MONGODB_ENABLED

print("===== CONFIGURAÇÃO DO MONGODB =====")
print(f"MONGODB_URI: {MONGODB_URI}")
print(f"MONGODB_DB_NAME: {MONGODB_DB_NAME}")
print(f"MONGODB_ENABLED: {MONGODB_ENABLED}")
print("==================================")

# Verificar a variável de ambiente diretamente
env_uri = os.environ.get('MONGODB_URI', 'não definido no ambiente')
env_enabled = os.environ.get('MONGODB_ENABLED', 'não definido no ambiente')
print(f"MONGODB_URI do ambiente: {env_uri}")
print(f"MONGODB_ENABLED do ambiente: {env_enabled}")

# IMPORTANTE: Verificar se o MongoDB está realmente habilitado
if not MONGODB_ENABLED:
    print("\n⚠️ ATENÇÃO: MongoDB NÃO está habilitado! ⚠️")
    print("Para habilitar o MongoDB, configure a variável MONGODB_ENABLED=true")
    print("Isso pode ser feito no arquivo .env ou nas variáveis de ambiente do Railway.")
    print("⚠️ O scraper NÃO enviará dados para o MongoDB enquanto essa configuração não for alterada.")

# Tentar importar e instanciar a fonte de dados
try:
    from data_source_mongo import MongoDataSource
    print("\nTentando conectar ao MongoDB...")
    db = MongoDataSource()
    print("✅ Conexão bem-sucedida ao MongoDB!")
    
    # Tentar obter algumas informações do banco
    roletas = db.obter_roletas()
    print(f"Número de roletas encontradas: {len(roletas)}")
    if roletas:
        print(f"Primeira roleta: {roletas[0]['nome']}")
        
    # Tentar obter estatísticas da coleção roleta_numeros
    print("\nVerificando coleção roleta_numeros:")
    try:
        numeros_count = db.client["runcash"]['roleta_numeros'].count_documents({})
        print(f"✅ Total de números armazenados: {numeros_count}")
        
        # Verificar os números mais recentes
        ultimos_numeros = list(db.client["runcash"]['roleta_numeros'].find().sort('timestamp', -1).limit(5))
        
        if ultimos_numeros:
            print("\nÚltimos números inseridos:")
            for num in ultimos_numeros:
                print(f"  Roleta: {num.get('roleta_nome')}, Número: {num.get('numero')}, Timestamp: {num.get('timestamp')}")
        else:
            print("❌ Nenhum número encontrado na coleção.")
    except Exception as e:
        print(f"❌ Erro ao verificar coleção roleta_numeros: {str(e)}")
except Exception as e:
    print(f"❌ Erro ao conectar: {str(e)}") 