#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para migrar o formato das coleções de roletas de 'roleta_ID' para apenas 'ID'.
Este script renomeia as coleções e atualiza os metadados.
"""

import os
import sys
import logging
import pymongo
from datetime import datetime
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("migrar_colecoes.log")
    ]
)
logger = logging.getLogger("MigrarColecoes")

def migrar_colecoes():
    """Migra o formato das coleções de roleta_ID para apenas ID"""
    print("=== MIGRAÇÃO DE FORMATO DAS COLEÇÕES ===")
    print("De: roleta_ID")
    print("Para: ID")
    
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
        
        # Contar coleções de roletas
        colecoes_roletas = [col for col in colecoes if col.startswith("roleta_")]
        print(f"Coleções para migrar: {len(colecoes_roletas)}")
        
        if not colecoes_roletas:
            print("Nenhuma coleção para migrar encontrada!")
            return
        
        # Confirmar com o usuário
        confirmacao = input("\nATENÇÃO: Esta operação irá renomear as coleções. Deseja continuar? (s/n): ")
        if confirmacao.lower() not in ["s", "sim", "y", "yes"]:
            print("Operação cancelada pelo usuário.")
            return
        
        # Migrar coleções
        print("\n=== INICIANDO MIGRAÇÃO ===")
        
        # Mapear coleções para IDs
        mapeamento = {}
        for colecao in colecoes_roletas:
            partes = colecao.split("_")
            if len(partes) > 1:
                id_roleta = partes[1]
                mapeamento[colecao] = id_roleta
        
        # Processo de migração
        migradas = 0
        erros = 0
        
        for colecao_antiga, colecao_nova in mapeamento.items():
            try:
                print(f"Migrando: {colecao_antiga} -> {colecao_nova}")
                
                # Verificar se a coleção nova já existe
                if colecao_nova in colecoes:
                    print(f"  ⚠️ Coleção '{colecao_nova}' já existe! Pulando...")
                    erros += 1
                    continue
                
                # Renomear coleção
                db_roletas[colecao_antiga].rename(colecao_nova)
                
                # Atualizar metadados
                if "metadados" in colecoes:
                    db_roletas.metadados.update_many(
                        {"colecao": colecao_antiga},
                        {"$set": {
                            "colecao": colecao_nova,
                            "atualizado_em": datetime.now()
                        }}
                    )
                
                print(f"  ✓ Migração concluída!")
                migradas += 1
                
            except Exception as e:
                print(f"  ✗ Erro ao migrar coleção {colecao_antiga}: {str(e)}")
                erros += 1
        
        # Atualizar view se existir
        if "numeros_view" in colecoes:
            try:
                print("\nAtualizando view 'numeros_view'...")
                # Remover view existente
                db_roletas.command("drop", "numeros_view")
                
                # Reconstruir view
                colecoes_atual = [col for col in db_roletas.list_collection_names() 
                                if col != "metadados" and col != "estatisticas"]
                
                # Pipeline de agregação para union
                pipeline = []
                for colecao in colecoes_atual:
                    if colecao != "numeros_view" and not colecao.startswith("system."):
                        pipeline.append({"$unionWith": colecao})
                
                if pipeline:
                    # Remover o primeiro $unionWith
                    primeira_colecao = pipeline[0]["$unionWith"]
                    pipeline = pipeline[1:]
                    
                    # Criar view
                    db_roletas.command(
                        "create",
                        "numeros_view",
                        viewOn=primeira_colecao,
                        pipeline=pipeline
                    )
                    print("  ✓ View 'numeros_view' atualizada com sucesso!")
                else:
                    print("  ⚠️ Nenhuma coleção encontrada para criar a view!")
            except Exception as e:
                print(f"  ✗ Erro ao atualizar view: {str(e)}")
        
        # Resumo da migração
        print("\n=== RESUMO DA MIGRAÇÃO ===")
        print(f"Total de coleções processadas: {len(mapeamento)}")
        print(f"Coleções migradas com sucesso: {migradas}")
        print(f"Coleções com erros: {erros}")
        
        # Fechar conexão
        client.close()
        print("\nConexão com MongoDB Atlas fechada.")
        
    except Exception as e:
        print(f"Erro durante a migração: {str(e)}")
    
    print("\n=== MIGRAÇÃO CONCLUÍDA ===")

if __name__ == "__main__":
    migrar_colecoes()
    input("\nPressione ENTER para sair...") 