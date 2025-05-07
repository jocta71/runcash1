#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Implementação de fonte de dados MongoDB para o sistema
"""

import logging
import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
import os
import pymongo

# Importações locais
from scraper_core import DataSourceInterface, determinar_cor_numero
from mongo_config import (
    conectar_mongodb, inicializar_colecoes, 
    roleta_para_documento, numero_para_documento
)
from analytics import calcular_estatisticas_diarias, detectar_sequencias
from config import logger

class MongoDataSource(DataSourceInterface):
    """Implementação de fonte de dados usando MongoDB"""
    
    def __init__(self):
        """Inicializa a fonte de dados MongoDB"""
        # Silenciar pymongo
        logging.getLogger("pymongo").setLevel(logging.CRITICAL)
        
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/runcash')
        
        # Usar ROLETAS_MONGODB_DB_NAME se disponível, caso contrário usar MONGODB_DB_NAME
        db_name = os.environ.get('ROLETAS_MONGODB_DB_NAME') or os.environ.get('MONGODB_DB_NAME', 'runcash')
        logger.info(f"Usando banco de dados: {db_name}")
        
        try:
            # Inicializar com recursos atualizados
            self.recursos = inicializar_colecoes()
            self.client = self.recursos["client"]
            self.db = self.recursos["db"]
            self.colecoes_por_roleta = self.recursos.get("colecoes_por_roleta", {})
            
            # Agora o dicionário colecoes está vazio e não deve ser usado
            logger.info("✅ Fonte de dados inicializada com sucesso")
        except Exception as e:
            logger.error(f"Erro ao inicializar fonte de dados MongoDB: {str(e)}")
            raise
    
    def garantir_roleta_existe(self, roleta_id: str, roleta_nome: str) -> str:
        """
        Verifica se a roleta existe, e a insere caso não exista
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            
        Returns:
            str: ID da roleta no MongoDB
        """
        try:
            # Verificar/criar coleção específica para esta roleta
            if roleta_id not in self.colecoes_por_roleta:
                # Criar coleção específica
                from mongo_config import criar_colecao_roleta
                colecao = criar_colecao_roleta(self.db, roleta_id)
                self.colecoes_por_roleta[roleta_id] = colecao
                
                # Atualizar metadados
                if "metadados" in self.db.list_collection_names():
                    self.db.metadados.update_one(
                        {"roleta_id": roleta_id},
                        {"$set": {
                            "roleta_id": roleta_id,
                            "roleta_nome": roleta_nome,
                            "colecao": roleta_id,
                            "ativa": True,
                            "atualizado_em": datetime.now()
                        }},
                        upsert=True
                    )
                
                logger.info(f"Coleção específica para roleta {roleta_nome} (ID: {roleta_id}) criada")
            
            logger.info(f"Garantida coleção específica para roleta {roleta_nome} (ID: {roleta_id})")
            return roleta_id
        except Exception as e:
            logger.error(f"Erro ao garantir existência da roleta {roleta_nome}: {str(e)}")
            return roleta_id
    
    def obter_roletas(self) -> List[Dict[str, Any]]:
        """
        Obtém todas as roletas
        
        Returns:
            List[Dict[str, Any]]: Lista de roletas
        """
        try:
            # Obter todas as roletas dos metadados
            roletas = list(self.db.metadados.find({"ativa": True}))
            
            # Formatar para o padrão esperado
            resultado = []
            for roleta in roletas:
                resultado.append({
                    "id": roleta.get("roleta_id"),
                    "nome": roleta.get("roleta_nome"),
                    "ativa": roleta.get("ativa", True)
                })
            
            return resultado
        except Exception as e:
            logger.error(f"Erro ao obter roletas: {str(e)}")
            return []
    
    def obter_ultimos_numeros(self, roleta_id: str, limite: int = 10) -> List[int]:
        """
        Obtém os últimos números para uma roleta específica
        
        Args:
            roleta_id (str): ID da roleta
            limite (int, optional): Limite de números. Defaults to 10.
            
        Returns:
            List[int]: Lista dos últimos números
        """
        try:
            print(f"[DATA] Buscando números para roleta ID: {roleta_id}")
            
            # Verificar se a roleta tem uma coleção específica
            if roleta_id in self.colecoes_por_roleta:
                # Usar a coleção específica da roleta
                colecao = self.colecoes_por_roleta[roleta_id]
                
                # Consultar os últimos números da roleta
                numeros_docs = list(colecao
                    .find({})
                    .sort("timestamp", -1)
                    .limit(limite))
                
                # Extrair apenas os números
                numeros = [doc['numero'] for doc in numeros_docs]
                print(f"[DATA] Encontrados {len(numeros)} números para roleta ID: {roleta_id}")
                return numeros
            else:
                logger.warning(f"Roleta ID {roleta_id} não tem coleção específica, retornando lista vazia")
                return []
        except Exception as e:
            logger.error(f"Erro ao obter últimos números para roleta {roleta_id}: {str(e)}")
            return []
    
    def obter_cor_numero(self, numero: int) -> str:
        """
        Obtém a cor de um número
        
        Args:
            numero (int): Número da roleta
            
        Returns:
            str: Cor do número (verde, vermelho ou preto)
        """
        return determinar_cor_numero(numero)
    
    def obter_timestamp_numero(self, roleta_id: str, numero: int, indice: int) -> str:
        """
        Obtém o timestamp de um número específico
        
        Args:
            roleta_id (str): ID da roleta
            numero (int): Número da roleta
            indice (int): Índice do número na lista
            
        Returns:
            str: Timestamp em formato ISO
        """
        try:
            print(f"[DATA] Buscando timestamp para roleta ID: {roleta_id}, número: {numero}")
            
            # Verificar se a roleta tem uma coleção específica
            if roleta_id in self.colecoes_por_roleta:
                # Usar a coleção específica da roleta
                colecao = self.colecoes_por_roleta[roleta_id]
                
                # Tentar obter o timestamp do número
                numero_doc = colecao.find_one(
                    {"numero": numero},
                    sort=[("timestamp", -1)],
                    skip=indice
                )
                
                if numero_doc and 'timestamp' in numero_doc:
                    # Converter para string ISO
                    timestamp = numero_doc['timestamp'].isoformat()
                    print(f"[DATA] Timestamp encontrado: {timestamp}")
                    return timestamp
            else:
                logger.warning(f"[DATA] Roleta ID {roleta_id} não tem coleção específica, usando timestamp atual")
            
            # Fallback: usar timestamp atual
            print(f"[DATA] Nenhum timestamp encontrado, usando timestamp atual")
            return datetime.now().isoformat()
        except Exception as e:
            logger.error(f"Erro ao obter timestamp para número {numero} da roleta {roleta_id}: {str(e)}")
            return datetime.now().isoformat()
    
    def inserir_numero(self, roleta_id: str, roleta_nome: str, numero: int, 
                      cor: str = None, timestamp: str = None) -> bool:
        """
        Insere um novo número para uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            numero (int): Número sorteado
            cor (str, optional): Cor do número. Defaults to None.
            timestamp (str, optional): Timestamp do evento. Defaults to None.
            
        Returns:
            bool: True se inserido com sucesso, False caso contrário
        """
        try:
            # Verificar se a roleta já tem uma coleção específica
            if roleta_id not in self.colecoes_por_roleta:
                # Criar coleção específica para esta roleta
                from mongo_config import criar_colecao_roleta
                colecao = criar_colecao_roleta(self.db, roleta_id)
                self.colecoes_por_roleta[roleta_id] = colecao
                
                # Atualizar metadados
                if "metadados" in self.db.list_collection_names():
                    self.db.metadados.update_one(
                        {"roleta_id": roleta_id},
                        {"$set": {
                            "roleta_id": roleta_id,
                            "roleta_nome": roleta_nome,
                            "colecao": roleta_id,
                            "ativa": True,
                            "atualizado_em": datetime.now()
                        }},
                        upsert=True
                    )
            
            # Usar a coleção específica da roleta
            colecao = self.colecoes_por_roleta[roleta_id]
            logger.info(f"[ROLETA_DB] Usando coleção específica para roleta {roleta_nome} (ID: {roleta_id})")
            
            # Criar documento
            documento = numero_para_documento(
                roleta_id=roleta_id,
                roleta_nome=roleta_nome,
                numero=numero,
                cor=cor,
                timestamp=timestamp
            )
            
            # Inserir no MongoDB
            result = colecao.insert_one(documento)
            
            if result.inserted_id:
                logger.info(f"Número {numero} inserido para roleta {roleta_nome} (DB ID: {roleta_id})")
                
                # Atualizar estatísticas (em thread separada para não bloquear)
                try:
                    import threading
                    threading.Thread(
                        target=self.atualizar_estatisticas_e_sequencias,
                        args=(roleta_id, roleta_nome),
                        daemon=True
                    ).start()
                except Exception as e:
                    logger.error(f"Erro ao iniciar thread de atualização de estatísticas: {str(e)}")
                
                return True
            
            return False
        except Exception as e:
            logger.error(f"Erro ao inserir número {numero} para roleta {roleta_nome}: {str(e)}")
            return False
    
    def atualizar_estatisticas_e_sequencias(self, roleta_id: str, roleta_nome: str) -> None:
        """
        Atualiza estatísticas e sequências para uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
        """
        try:
            # Para o modelo otimizado, estatísticas são calculadas sob demanda
            # Aqui podemos adicionar lógica para atualizar cache ou armazenar resumos
            logger.debug(f"Estatísticas para roleta {roleta_nome} serão calculadas sob demanda")
        except Exception as e:
            logger.error(f"Erro ao atualizar estatísticas para roleta {roleta_nome}: {str(e)}")
    
    def obter_estatisticas_diarias(self, roleta_id: str, data: datetime = None) -> Dict[str, Any]:
        """
        Obtém estatísticas diárias para uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            data (datetime, optional): Data para obter estatísticas. Defaults to None (hoje).
            
        Returns:
            Dict[str, Any]: Estatísticas diárias
        """
        try:
            # Calcular estatísticas diretamente da coleção específica da roleta
            if roleta_id in self.colecoes_por_roleta:
                return calcular_estatisticas_diarias(roleta_id, data)
            else:
                logger.warning(f"Roleta ID {roleta_id} não tem coleção específica, retornando estatísticas vazias")
                return {
                    "roleta_id": roleta_id,
                    "data": data.strftime("%Y-%m-%d") if data else datetime.now().strftime("%Y-%m-%d"),
                    "total_numeros": 0,
                    "numeros_vermelhos": 0,
                    "numeros_pretos": 0,
                    "zeros": 0,
                    "numeros_pares": 0,
                    "numeros_impares": 0,
                    "numero_mais_frequente": 0,
                    "frequencia_maxima": 0
                }
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas diárias para roleta {roleta_id}: {str(e)}")
            return None
    
    def obter_sequencias(self, roleta_id: str, tipo: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Obtém as sequências detectadas para uma roleta
        
        Args:
            roleta_id: ID da roleta
            tipo: Tipo de sequência (opcional, se None retorna todas)
            
        Returns:
            Lista de sequências
        """
        try:
            # Calcular sequências diretamente da coleção específica da roleta
            if roleta_id in self.colecoes_por_roleta:
                return detectar_sequencias(roleta_id, tipo)
            else:
                logger.warning(f"Roleta ID {roleta_id} não tem coleção específica, retornando sequências vazias")
                return []
        except Exception as e:
            logger.error(f"Erro ao obter sequências para roleta {roleta_id}: {str(e)}")
            return []
    
    def atualizar_dados_estrategia(
        self, 
        roleta_id: str, 
        roleta_nome: str, 
        estado: str, 
        numero_gatilho: int, 
        numero_gatilho_anterior: int, 
        terminais_gatilho: List[int], 
        terminais_gatilho_anterior: List[int], 
        vitorias: int, 
        derrotas: int, 
        ultimo_numero: int
    ) -> bool:
        """
        Atualiza os dados da estratégia para uma roleta
        
        Args:
            roleta_id: ID da roleta
            roleta_nome: Nome da roleta
            estado: Estado atual da estratégia
            numero_gatilho: Número que ativou a estratégia
            numero_gatilho_anterior: Número que ativou a estratégia anteriormente
            terminais_gatilho: Terminais do número gatilho
            terminais_gatilho_anterior: Terminais do número gatilho anterior
            vitorias: Número de vitórias
            derrotas: Número de derrotas
            ultimo_numero: Último número sorteado
            
        Returns:
            bool: True se atualizado com sucesso, False caso contrário
        """
        try:
            # Em vez de usar uma coleção específica para estratégias, vamos
            # armazenar na coleção de metadados que já temos
            self.db.metadados.update_one(
                {"roleta_id": roleta_id},
                {"$set": {
                    "estrategia": {
                        "estado": estado,
                        "numero_gatilho": numero_gatilho,
                        "numero_gatilho_anterior": numero_gatilho_anterior,
                        "terminais_gatilho": terminais_gatilho,
                        "terminais_gatilho_anterior": terminais_gatilho_anterior,
                        "vitorias": vitorias,
                        "derrotas": derrotas,
                        "ultimo_numero": ultimo_numero,
                        "atualizado_em": datetime.now()
                    }
                }}
            )
            
            logger.info(f"Dados de estratégia atualizados para roleta {roleta_nome}")
            return True
        except Exception as e:
            logger.error(f"Erro ao atualizar dados de estratégia para roleta {roleta_nome}: {str(e)}")
            return False
    
    def fechar(self):
        """Fecha conexões com o MongoDB"""
        try:
            if hasattr(self, 'client') and self.client:
                self.client.close()
                logger.info("Conexão MongoDB fechada")
        except Exception as e:
            logger.error(f"Erro ao fechar conexão MongoDB: {str(e)}") 