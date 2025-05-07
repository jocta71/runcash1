#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para padronizar as coleções de roletas, mantendo apenas os IDs numéricos.
Este script:
1. Identifica coleções duplicadas (UUID vs ID numérico)
2. Migra dados das coleções UUID para as numéricas
3. Remove as coleções UUID
4. Atualiza os metadados
"""

import os
import re
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
        logging.FileHandler("padronizar_ids.log")
    ]
)
logger = logging.getLogger("PadronizarIDs")

def padronizar_ids():
    """Padroniza as coleções de roletas para usar apenas IDs numéricos"""
    print("=== PADRONIZAÇÃO DE IDs DE ROLETAS ===")
    print("Mantendo apenas: IDs numéricos (ex: 2010048)")
    print("Removendo: UUIDs (ex: a8a1f746-6002-eabf-b14d-d78d13877599)")
    
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
        
        # Separar coleções por tipo
        colecoes_uuid = []
        colecoes_numericas = []
        colecoes_sistema = []
        
        # Padrão para identificar UUIDs
        uuid_pattern = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        
        # Padrão para identificar IDs numéricos
        id_numerico_pattern = re.compile(r'^[0-9]{7}$')
        
        for colecao in colecoes:
            if colecao in ["metadados", "estatisticas", "numeros_view"] or colecao.startswith("system."):
                colecoes_sistema.append(colecao)
            elif uuid_pattern.match(colecao):
                colecoes_uuid.append(colecao)
            elif id_numerico_pattern.match(colecao):
                colecoes_numericas.append(colecao)
            else:
                # Outras coleções que não se encaixam nos padrões
                colecoes_sistema.append(colecao)
        
        print(f"Coleções com IDs numéricos: {len(colecoes_numericas)}")
        print(f"Coleções com UUIDs: {len(colecoes_uuid)}")
        print(f"Outras coleções (sistema): {len(colecoes_sistema)}")
        
        if not colecoes_uuid:
            print("Nenhuma coleção UUID para padronizar!")
            return
        
        # Confirmar com o usuário
        confirmacao = input("\nATENÇÃO: Esta operação irá excluir coleções UUID após migrar seus dados. Deseja continuar? (s/n): ")
        if confirmacao.lower() not in ["s", "sim", "y", "yes"]:
            print("Operação cancelada pelo usuário.")
            return
        
        # Criar mapeamento entre nomes de roletas e IDs
        mapeamento_nomes = {}
        mapeamento_uuid_para_numerico = {}
        
        print("\n== CRIANDO MAPEAMENTO DE ROLETAS ==")
        
        # Obter mapeamento de nomes para IDs numéricos
        for colecao in colecoes_numericas:
            # Buscar metadados para esta coleção
            meta = db_roletas.metadados.find_one({"colecao": colecao})
            if meta and "roleta_nome" in meta:
                mapeamento_nomes[meta["roleta_nome"]] = colecao
                print(f"Roleta '{meta['roleta_nome']}' mapeada para ID numérico: {colecao}")
        
        # Mapear UUIDs para IDs numéricos baseado no nome da roleta
        for colecao in colecoes_uuid:
            # Buscar metadados para esta coleção
            meta = db_roletas.metadados.find_one({"colecao": colecao})
            if meta and "roleta_nome" in meta:
                nome_roleta = meta["roleta_nome"]
                if nome_roleta in mapeamento_nomes:
                    id_numerico = mapeamento_nomes[nome_roleta]
                    mapeamento_uuid_para_numerico[colecao] = id_numerico
                    print(f"UUID {colecao} mapeado para ID numérico {id_numerico} (Roleta: {nome_roleta})")
        
        # Processar migrações
        print("\n== INICIANDO MIGRAÇÃO DE DADOS ==")
        migrados = 0
        erros = 0
        
        for uuid, id_numerico in mapeamento_uuid_para_numerico.items():
            try:
                print(f"Migrando: {uuid} -> {id_numerico}")
                
                # Contar documentos
                total_docs = db_roletas[uuid].count_documents({})
                print(f"  Total de documentos: {total_docs}")
                
                if total_docs > 0:
                    # Obter documentos da coleção UUID
                    documentos = list(db_roletas[uuid].find({}))
                    
                    # Inserir em lote na coleção ID numérico
                    if documentos:
                        resultado = db_roletas[id_numerico].insert_many(documentos)
                        print(f"  ✓ {len(resultado.inserted_ids)} documentos inseridos")
                
                # Excluir coleção UUID
                db_roletas[uuid].drop()
                print(f"  ✓ Coleção UUID excluída")
                
                # Atualizar metadados
                db_roletas.metadados.delete_many({"colecao": uuid})
                print(f"  ✓ Metadados atualizados")
                
                migrados += 1
                
            except Exception as e:
                print(f"  ✗ Erro ao migrar coleção {uuid}: {str(e)}")
                erros += 1
        
        # Reconstruir view
        if "numeros_view" in colecoes:
            try:
                print("\n== ATUALIZANDO VIEW ==")
                # Remover view existente
                db_roletas.command("drop", "numeros_view")
                
                # Obter coleções atuais (apenas numéricas)
                colecoes_atuais = [col for col in db_roletas.list_collection_names() 
                                 if col not in ["metadados", "estatisticas", "numeros_view"] 
                                 and not col.startswith("system.")
                                 and id_numerico_pattern.match(col)]
                
                if colecoes_atuais:
                    # Criar nova view
                    primeira_colecao = colecoes_atuais[0]
                    colecoes_restantes = colecoes_atuais[1:]
                    
                    pipeline = []
                    for colecao in colecoes_restantes:
                        pipeline.append({"$unionWith": colecao})
                    
                    # Criar view
                    db_roletas.command(
                        "create",
                        "numeros_view",
                        viewOn=primeira_colecao,
                        pipeline=pipeline
                    )
                    print(f"✓ View 'numeros_view' recriada com {len(colecoes_atuais)} coleções!")
                else:
                    print("✗ Nenhuma coleção numérica encontrada para criar a view!")
            except Exception as e:
                print(f"✗ Erro ao atualizar view: {str(e)}")
        
        # Resumo final
        print("\n=== RESUMO DA PADRONIZAÇÃO ===")
        print(f"Coleções UUID encontradas: {len(colecoes_uuid)}")
        print(f"Coleções UUID mapeadas: {len(mapeamento_uuid_para_numerico)}")
        print(f"Migrações bem-sucedidas: {migrados}")
        print(f"Migrações com erro: {erros}")
        
        # Fechar conexão
        client.close()
        print("\nConexão com MongoDB Atlas fechada.")
        
    except Exception as e:
        print(f"Erro durante a padronização: {str(e)}")
    
    print("\n=== PADRONIZAÇÃO CONCLUÍDA ===")

if __name__ == "__main__":
    padronizar_ids()
    input("\nPressione ENTER para sair...") 