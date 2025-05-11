#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para migrar a estrutura do MongoDB de uma única coleção 'roleta_numeros'
para uma coleção separada por roleta (roleta_numeros_ID)
"""

import os
import sys
import logging
import pymongo
from datetime import datetime, timedelta
from tqdm import tqdm
import time

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("mongo_migration.log")
    ]
)
logger = logging.getLogger("Migração MongoDB")

# Configurações do MongoDB
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/runcash')
MONGODB_DB_NAME = os.environ.get('MONGODB_DB_NAME', 'runcash')

def conectar_mongodb():
    """
    Estabelece conexão com MongoDB
    
    Returns:
        Tuple[MongoClient, Database]: Cliente MongoDB e objeto de banco de dados
    """
    try:
        # Conectar ao MongoDB
        client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        db = client[MONGODB_DB_NAME]
        
        # Verificar conexão
        db.command('ping')
        logger.info(f"Conexão MongoDB estabelecida com sucesso: {MONGODB_URI}")
        
        return client, db
    except Exception as e:
        logger.error(f"Erro ao conectar ao MongoDB: {str(e)}")
        sys.exit(1)

def criar_nova_estrutura(db):
    """
    Cria a nova estrutura de coleções separadas por roleta
    
    Args:
        db: Conexão com o banco de dados MongoDB
    """
    logger.info("Criando nova estrutura de coleções...")
    
    # Obter todas as roletas
    roletas = list(db.roletas.find({}))
    logger.info(f"Encontradas {len(roletas)} roletas")
    
    # Criar uma coleção para cada roleta
    for roleta in roletas:
        roleta_id = str(roleta.get("_id"))
        roleta_nome = roleta.get("nome")
        
        # Nome da nova coleção
        nome_colecao = f"roleta_numeros_{roleta_id}"
        
        # Verificar se a coleção já existe
        if nome_colecao in db.list_collection_names():
            logger.info(f"Coleção '{nome_colecao}' já existe. Pulando...")
            continue
        
        # Criar nova coleção
        db.create_collection(nome_colecao)
        logger.info(f"Coleção '{nome_colecao}' criada para roleta '{roleta_nome}'")
        
        # Criar índices
        db[nome_colecao].create_index([('timestamp', pymongo.DESCENDING)])
        db[nome_colecao].create_index([('numero', pymongo.ASCENDING)])
        db[nome_colecao].create_index([('cor', pymongo.ASCENDING)])
        logger.info(f"Índices criados para coleção '{nome_colecao}'")

def migrar_dados(db, batch_size=1000, force_migration=False):
    """
    Migra os dados da coleção 'roleta_numeros' para as coleções específicas por roleta
    
    Args:
        db: Conexão com o banco de dados MongoDB
        batch_size: Tamanho do lote para processamento
        force_migration: Força a migração mesmo se as coleções já tiverem dados
    """
    logger.info("Iniciando migração de dados...")
    
    # Verificar se a coleção original existe
    if 'roleta_numeros' not in db.list_collection_names():
        logger.error("Coleção 'roleta_numeros' não encontrada. Não há dados para migrar.")
        return
    
    # Obter a contagem total de documentos para a barra de progresso
    total_docs = db.roleta_numeros.count_documents({})
    logger.info(f"Total de documentos para migrar: {total_docs}")
    
    if total_docs == 0:
        logger.warning("Nenhum documento encontrado na coleção 'roleta_numeros'")
        return
    
    # Obter todas as roletas
    roletas = list(db.roletas.find({}))
    roletas_dict = {str(roleta.get("_id")): roleta.get("nome") for roleta in roletas}
    
    # Inicializar contadores
    migrados = 0
    erros = 0
    roletas_processadas = set()
    
    # Usar tqdm para mostrar progresso
    with tqdm(total=total_docs, desc="Migrando documentos") as pbar:
        # Processar em lotes para evitar sobrecarga de memória
        cursor = db.roleta_numeros.find({}).sort("timestamp", pymongo.ASCENDING)
        
        batch = []
        roleta_batches = {}
        
        for doc in cursor:
            roleta_id = doc.get("roleta_id")
            
            # Verificar se a roleta existe no nosso dicionário
            if roleta_id not in roletas_dict:
                logger.warning(f"Roleta ID '{roleta_id}' não encontrada no banco de dados")
                erros += 1
                pbar.update(1)
                continue
            
            # Nome da coleção de destino
            nome_colecao = f"roleta_numeros_{roleta_id}"
            
            # Verificar se já processamos esta roleta
            if roleta_id not in roletas_processadas:
                # Verificar se devemos pular esta roleta
                if not force_migration and db[nome_colecao].count_documents({}) > 0:
                    logger.info(f"Coleção '{nome_colecao}' já contém dados. Pulando... (use --force para forçar)")
                    roletas_processadas.add(roleta_id)
                    pbar.update(1)
                    continue
                
                roletas_processadas.add(roleta_id)
                
            # Inicializar lote para esta roleta se necessário
            if nome_colecao not in roleta_batches:
                roleta_batches[nome_colecao] = []
                
            # Remover campos desnecessários
            if "_id" in doc:
                del doc["_id"]  # Deixar o MongoDB gerar um novo ID
            
            # Adicionar ao lote da roleta
            roleta_batches[nome_colecao].append(doc)
            
            # Processar lote quando atingir o tamanho máximo
            if len(roleta_batches[nome_colecao]) >= batch_size:
                try:
                    result = db[nome_colecao].insert_many(roleta_batches[nome_colecao])
                    migrados += len(result.inserted_ids)
                    roleta_batches[nome_colecao] = []
                except Exception as e:
                    logger.error(f"Erro ao inserir lote na coleção '{nome_colecao}': {str(e)}")
                    erros += len(roleta_batches[nome_colecao])
                    roleta_batches[nome_colecao] = []
            
            # Atualizar barra de progresso
            pbar.update(1)
        
        # Processar lotes restantes
        for nome_colecao, batch in roleta_batches.items():
            if batch:
                try:
                    result = db[nome_colecao].insert_many(batch)
                    migrados += len(result.inserted_ids)
                except Exception as e:
                    logger.error(f"Erro ao inserir lote final na coleção '{nome_colecao}': {str(e)}")
                    erros += len(batch)
    
    logger.info(f"Migração concluída: {migrados} documentos migrados, {erros} erros")

def criar_view_unificada(db):
    """
    Cria uma view que unifica todas as coleções de roletas
    
    Args:
        db: Conexão com o banco de dados MongoDB
    """
    logger.info("Criando view unificada...")
    
    # Obter todas as coleções de roletas
    colecoes_roletas = [col for col in db.list_collection_names() if col.startswith("roleta_numeros_")]
    
    if not colecoes_roletas:
        logger.warning("Nenhuma coleção de roleta encontrada para criar view")
        return
    
    # Remover view existente se existir
    if "roleta_numeros_view" in db.list_collection_names():
        db.command("drop", "roleta_numeros_view")
        logger.info("View existente removida")
    
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
    
    logger.info(f"View unificada 'roleta_numeros_view' criada com {len(colecoes_roletas)} coleções")

def verificar_migracao(db):
    """
    Verifica se a migração foi bem-sucedida comparando contagens
    
    Args:
        db: Conexão com o banco de dados MongoDB
    """
    logger.info("Verificando migração...")
    
    # Contagem na coleção original
    count_original = db.roleta_numeros.count_documents({})
    
    # Contar documentos nas novas coleções
    colecoes_roletas = [col for col in db.list_collection_names() if col.startswith("roleta_numeros_")]
    count_migrado = 0
    
    for col in colecoes_roletas:
        count_col = db[col].count_documents({})
        logger.info(f"Coleção '{col}': {count_col} documentos")
        count_migrado += count_col
    
    # Contar na view unificada
    if "roleta_numeros_view" in db.list_collection_names():
        count_view = db.roleta_numeros_view.count_documents({})
        logger.info(f"View unificada: {count_view} documentos")
        
        if count_view != count_migrado:
            logger.warning(f"Discrepância: {count_migrado} nas coleções vs {count_view} na view")
    
    logger.info(f"Totais: {count_original} na coleção original, {count_migrado} nas novas coleções")
    
    if count_original == count_migrado:
        logger.info("✅ Migração completa e verificada!")
    else:
        diferenca = abs(count_original - count_migrado)
        percentual = (diferenca / count_original) * 100 if count_original > 0 else 0
        
        if percentual < 0.1:
            logger.info(f"✓ Migração concluída com pequena diferença ({diferenca} documentos, {percentual:.2f}%)")
        else:
            logger.warning(f"⚠️ Diferença significativa: {diferenca} documentos ({percentual:.2f}%)")

def main():
    """Função principal para migração"""
    # Banner
    print("\n===================================================")
    print("  MIGRAÇÃO DE COLEÇÕES MongoDB - RunCash")
    print("  Migração para coleções separadas por roleta")
    print("===================================================\n")
    
    # Verificar argumentos
    force_migration = "--force" in sys.argv
    if force_migration:
        print("⚠️ Modo force ativado: irá substituir dados existentes nas coleções de destino\n")
    
    try:
        # Conectar ao MongoDB
        client, db = conectar_mongodb()
        
        # Executar etapas da migração
        criar_nova_estrutura(db)
        migrar_dados(db, force_migration=force_migration)
        criar_view_unificada(db)
        verificar_migracao(db)
        
        # Perguntar se deseja manter a coleção original
        if input("\nDeseja manter a coleção original 'roleta_numeros'? (S/n): ").lower() != 'n':
            logger.info("Mantendo coleção original 'roleta_numeros'")
        else:
            # Perguntar novamente para confirmar
            if input("⚠️ Tem certeza que deseja EXCLUIR a coleção original? Esta ação não pode ser desfeita! (digite 'excluir' para confirmar): ").lower() == 'excluir':
                db.drop_collection('roleta_numeros')
                logger.info("Coleção original 'roleta_numeros' excluída")
            else:
                logger.info("Operação de exclusão cancelada. Mantendo coleção original.")
        
        logger.info("Migração concluída com sucesso!")
        print("\n===================================================")
        print("  ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO")
        print("===================================================\n")
        
    except Exception as e:
        logger.error(f"Erro durante a migração: {str(e)}")
        print(f"\n❌ ERRO: {str(e)}")
    finally:
        # Fechar conexão com MongoDB
        if 'client' in locals():
            client.close()
            logger.info("Conexão com MongoDB fechada")

if __name__ == "__main__":
    main() 