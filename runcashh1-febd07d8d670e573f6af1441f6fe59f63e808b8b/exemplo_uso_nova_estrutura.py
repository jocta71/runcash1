#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Exemplo de uso da nova estrutura de coleções separadas por roleta no MongoDB
"""

import os
import sys
from datetime import datetime
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("exemplo_nova_estrutura.log")
    ]
)
logger = logging.getLogger("ExemploNovaEstrutura")

# Importar a nova implementação
try:
    from data_source_mongo_updated import MongoDataSource
    logger.info("Usando nova implementação com coleções separadas")
except ImportError:
    logger.error("Não foi possível importar a nova implementação. Verifique os arquivos.")
    sys.exit(1)

def demonstrar_uso():
    """Demonstra o uso da nova estrutura de coleções separadas"""
    logger.info("Iniciando demonstração da nova estrutura de coleções...")
    
    # Inicializar fonte de dados com coleções separadas
    data_source = MongoDataSource(usar_colecoes_separadas=True)
    
    # Demonstrar operações básicas
    try:
        # 1. Listar roletas existentes
        roletas = data_source.obter_roletas()
        logger.info(f"Encontradas {len(roletas)} roletas")
        
        for i, roleta in enumerate(roletas):
            logger.info(f"Roleta {i+1}: {roleta.get('nome')} (ID: {roleta.get('id')})")
        
        if not roletas:
            logger.warning("Nenhuma roleta encontrada. Criando uma de exemplo...")
            # Criar uma roleta de exemplo
            roleta_id = "2380033"
            roleta_nome = "Roleta de Exemplo"
            data_source.garantir_roleta_existe(roleta_id, roleta_nome)
            logger.info(f"Roleta de exemplo criada: {roleta_nome} (ID: {roleta_id})")
            
            # Adicionar novamente à lista
            roletas = data_source.obter_roletas()
        
        # Selecionar a primeira roleta para demonstração
        roleta = roletas[0]
        roleta_id = roleta.get('id')
        roleta_nome = roleta.get('nome')
        
        logger.info(f"Usando roleta para demonstração: {roleta_nome} (ID: {roleta_id})")
        
        # 2. Inserir alguns números de exemplo
        logger.info("Inserindo números de exemplo...")
        
        # Inserir 5 números de teste
        for numero in [10, 25, 0, 36, 15]:
            # Determinar cor (simplificado)
            if numero == 0:
                cor = "verde"
            elif numero % 2 == 0:
                cor = "preto"
            else:
                cor = "vermelho"
                
            # Inserir número
            resultado = data_source.inserir_numero(
                roleta_id=roleta_id,
                roleta_nome=roleta_nome,
                numero=numero,
                cor=cor,
                timestamp=datetime.now()
            )
            
            if resultado:
                logger.info(f"Número {numero} ({cor}) inserido com sucesso na coleção específica da roleta {roleta_nome}")
            else:
                logger.error(f"Erro ao inserir número {numero}")
        
        # 3. Obter números inseridos
        logger.info("Obtendo números inseridos...")
        numeros = data_source.obter_numeros(roleta_id, limite=10)
        
        logger.info(f"Obtidos {len(numeros)} números para a roleta {roleta_nome}")
        for i, num in enumerate(numeros):
            logger.info(f"  Número {i+1}: {num.get('numero')} ({num.get('cor')})")
        
        # 4. Mostrar detalhes da estrutura
        logger.info("\nDetalhes da nova estrutura:")
        for collection_name in data_source.colecoes_por_roleta:
            logger.info(f"Coleção específica: roleta_numeros_{collection_name}")
        
        # 5. Finalizar
        logger.info("\nDemonstração concluída com sucesso!")
        logger.info("A nova estrutura está funcionando corretamente com coleções separadas por roleta.")
        
    except Exception as e:
        logger.error(f"Erro durante a demonstração: {str(e)}")
    finally:
        # Fechar conexão
        data_source.fechar()

if __name__ == "__main__":
    demonstrar_uso()
    print("\nDemonstração concluída! Verifique o arquivo de log para detalhes.")
    input("Pressione Enter para sair...") 