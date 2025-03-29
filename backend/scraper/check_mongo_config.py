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
print(f"MONGODB_URI do ambiente: {env_uri}")

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
except Exception as e:
    print(f"❌ Erro ao conectar: {str(e)}") 