#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para atualizar os nomes das roletas na coleção metadados do banco roletas_db.
Substitui os nomes genéricos "Roleta ID" por nomes descritivos.
"""

import os
import sys
import pymongo
from datetime import datetime
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

print("=== ATUALIZANDO NOMES DAS ROLETAS NO BANCO DE DADOS ===\n")

# Usar a conexão do MongoDB Atlas do arquivo .env
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash')
DB_ROLETAS = "roletas_db"  # Banco de dados para roletas

# Mapeamento de IDs para nomes descritivos
# Adicione mais roletas conforme necessário
MAPEAMENTO_NOMES = {
    # Roletas Evolution Gaming
    "2010011": "Deutsches Roulette",
    "2010012": "American Roulette",
    "2010016": "Immersive Roulette",
    "2010031": "Jawhara Roulette",
    "2010033": "Lightning Roulette",
    "2010048": "Dansk Roulette",
    "2010049": "Ruletka Live",
    "2010059": "Bucharest Roulette",
    "2010065": "Bucharest Auto-Roulette",
    "2010096": "Speed Auto Roulette",
    "2010097": "Instant Roulette",
    "2010098": "Auto-Roulette VIP",
    "2010099": "Football Studio Roulette",
    "2010100": "Venezia Roulette",
    "2010106": "Türkçe Rulet",
    "2010108": "Dragonara Roulette",
    "2010110": "Hippodrome Grand Casino",
    "2010143": "Ruleta Relámpago en Vivo",
    "2010165": "Roulette",
    "2010170": "Lightning Roulette Italia",
    "2010336": "Türkçe Lightning Rulet",
    "2010440": "XXXtreme Lightning Roulette",
    "2010565": "Gold Vault Roulette",
    
    # Roletas Pragmatic
    "2380010": "Speed Roulette 1",
    "2380032": "Russian Roulette",
    "2380033": "German Roulette",
    "2380034": "Roulette Italia Tricolore",
    "2380038": "Roulette Macao",
    "2380039": "Turkish Roulette",
    "2380049": "Mega Roulette",
    "2380064": "Roulette 1",
    "2380117": "VIP Roulette",
    "2380159": "Romanian Roulette",
    "2380335": "Brazilian Mega Roulette",
    "2380346": "VIP Auto Roulette",
    "2380373": "Fortune Roulette",
    "2380390": "Immersive Roulette Deluxe"
}

# Conectar ao MongoDB
try:
    print(f"Conectando ao MongoDB Atlas...")
    client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    
    # Verificar conexão
    client.server_info()
    print("✓ Conectado ao MongoDB Atlas com sucesso!")
    
    # Acessar o banco de dados para roletas
    db_roletas = client[DB_ROLETAS]
    
    # Verificar se a coleção de metadados existe
    if "metadados" not in db_roletas.list_collection_names():
        print("❌ Coleção 'metadados' não encontrada! Execute o script criar_banco_roletas.py primeiro.")
        sys.exit(1)
    
    # Obter todas as roletas na coleção metadados
    total_roletas = db_roletas.metadados.count_documents({})
    print(f"\nTotal de roletas na coleção metadados: {total_roletas}")
    print(f"Total de roletas no mapeamento: {len(MAPEAMENTO_NOMES)}")
    
    # Estatísticas
    roletas_atualizadas = 0
    roletas_nao_encontradas = 0
    
    # Processar cada roleta no mapeamento
    print("\n== ATUALIZANDO NOMES DAS ROLETAS ==")
    for roleta_id, novo_nome in MAPEAMENTO_NOMES.items():
        # Buscar documento atual
        documento = db_roletas.metadados.find_one({"roleta_id": roleta_id})
        
        if documento:
            nome_antigo = documento.get("roleta_nome", f"Roleta {roleta_id}")
            
            # Verificar se o nome já está atualizado
            if nome_antigo == novo_nome:
                print(f"✓ ID {roleta_id}: Nome já está atualizado como '{novo_nome}'")
                continue
            
            # Atualizar nome
            resultado = db_roletas.metadados.update_one(
                {"roleta_id": roleta_id},
                {"$set": {
                    "roleta_nome": novo_nome,
                    "atualizado_em": datetime.now()
                }}
            )
            
            if resultado.modified_count > 0:
                print(f"✓ ID {roleta_id}: Nome atualizado de '{nome_antigo}' para '{novo_nome}'")
                roletas_atualizadas += 1
            else:
                print(f"⚠ ID {roleta_id}: Sem alterações ('{nome_antigo}')")
        else:
            print(f"❌ ID {roleta_id}: Roleta não encontrada na coleção metadados.")
            roletas_nao_encontradas += 1
    
    # Verificar se há roletas no banco que não estão no mapeamento
    print("\n== VERIFICANDO ROLETAS SEM NOME DESCRITIVO ==")
    roletas_sem_mapeamento = 0
    
    for documento in db_roletas.metadados.find({}):
        roleta_id = documento.get("roleta_id")
        if roleta_id not in MAPEAMENTO_NOMES:
            nome_atual = documento.get("roleta_nome", f"Roleta {roleta_id}")
            print(f"⚠ ID {roleta_id}: Não possui nome descritivo no mapeamento (nome atual: '{nome_atual}')")
            roletas_sem_mapeamento += 1
    
    # Resumo das operações
    print("\n== RESUMO ==")
    print(f"Total de roletas processadas: {len(MAPEAMENTO_NOMES)}")
    print(f"Roletas atualizadas: {roletas_atualizadas}")
    print(f"Roletas não encontradas: {roletas_nao_encontradas}")
    print(f"Roletas sem mapeamento: {roletas_sem_mapeamento}")
    
    print("\n=== ATUALIZAÇÃO DE NOMES CONCLUÍDA! ===")

except pymongo.errors.ConnectionFailure as e:
    print(f"Erro de conexão com MongoDB Atlas: {str(e)}")
except Exception as e:
    print(f"Erro durante a atualização: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    # Fechar conexão
    if 'client' in locals():
        client.close()
        print("Conexão com o MongoDB encerrada.") 