#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Implementação de fonte de dados MongoDB para o sistema
Versão aprimorada com suporte a coleções separadas por roleta
"""

import logging
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import os
import pymongo
import threading

# Importações locais
from scraper_core import DataSourceInterface, determinar_cor_numero
from mongo_config_updated import (
    conectar_mongodb, inicializar_colecoes, 
    roleta_para_documento, numero_para_documento,
    garantir_colecao_roleta
)
from analytics import calcular_estatisticas_diarias, detectar_sequencias

# Configurar logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("MongoDataSource")

class MongoDataSource(DataSourceInterface):
    """Implementação de fonte de dados usando MongoDB com suporte a coleções por roleta"""
    
    def __init__(self, usar_colecoes_separadas=True):
        """
        Inicializa a fonte de dados MongoDB
        
        Args:
            usar_colecoes_separadas (bool): Se True, usa coleções separadas por roleta
        """
        # Silenciar pymongo
        logging.getLogger("pymongo").setLevel(logging.CRITICAL)
        
        try:
            # Conectar ao MongoDB e inicializar coleções
            self.recursos = inicializar_colecoes(usar_colecoes_separadas)
            self.client = self.recursos["client"]
            self.db = self.recursos["db"]
            self.colecoes = self.recursos["colecoes"]
            self.colecoes_por_roleta = self.recursos["colecoes_por_roleta"]
            self.config = self.recursos["config"]
            
            logger.info("Fonte de dados MongoDB inicializada com sucesso")
            
            # Sincronizar roletas existentes com coleções
            if usar_colecoes_separadas:
                self._sincronizar_colecoes_roletas()
        except Exception as e:
            logger.error(f"Erro ao inicializar fonte de dados MongoDB: {str(e)}")
            raise
    
    def _sincronizar_colecoes_roletas(self):
        """Sincroniza roletas existentes com suas respectivas coleções"""
        try:
            # Obter todas as roletas
            roletas = list(self.colecoes['roletas'].find({"ativa": True}))
            
            for roleta in roletas:
                roleta_id = str(roleta.get("_id"))
                roleta_nome = roleta.get("nome")
                
                # Garantir que exista uma coleção para essa roleta
                garantir_colecao_roleta(self.db, roleta_id, roleta_nome)
                
                # Adicionar ao dicionário de coleções por roleta
                nome_colecao = f"roleta_numeros_{roleta_id}"
                self.colecoes_por_roleta[roleta_id] = self.db[nome_colecao]
                
            logger.info(f"Sincronização de coleções concluída: {len(self.colecoes_por_roleta)} roletas sincronizadas")
        except Exception as e:
            logger.error(f"Erro ao sincronizar coleções de roletas: {str(e)}")
    
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
            # Gerar UUID determinístico
            roleta_id_hash = hashlib.md5(str(roleta_id).encode()).hexdigest()
            roleta_uuid = str(uuid.UUID(roleta_id_hash))
            
            # Verificar se a roleta já existe
            if not self.colecoes['roletas'].find_one({"_id": roleta_uuid}):
                # Criar documento e inserir
                documento = roleta_para_documento(roleta_uuid, roleta_nome)
                self.colecoes['roletas'].insert_one(documento)
                logger.info(f"Roleta {roleta_nome} (ID: {roleta_uuid}) criada no MongoDB")
                
                # Se estiver usando coleções separadas, criar a coleção para essa roleta
                if self.config["usa_colecoes_separadas"]:
                    colecao = garantir_colecao_roleta(self.db, roleta_uuid, roleta_nome)
                    self.colecoes_por_roleta[roleta_uuid] = colecao
            
            return roleta_uuid
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
            # Obter todas as roletas ativas
            roletas = list(self.colecoes['roletas'].find({"ativa": True}))
            
            # Converter _id para string (já que é ObjectId no MongoDB)
            for roleta in roletas:
                roleta['id'] = str(roleta.pop('_id'))
            
            return roletas
        except Exception as e:
            logger.error(f"Erro ao obter roletas: {str(e)}")
            return []
    
    def obter_roleta(self, roleta_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtém informações de uma roleta específica
        
        Args:
            roleta_id (str): ID da roleta
            
        Returns:
            Optional[Dict[str, Any]]: Informações da roleta ou None se não encontrada
        """
        try:
            # Obter a roleta
            roleta = self.colecoes['roletas'].find_one({"_id": roleta_id})
            
            if not roleta:
                return None
            
            # Converter _id para string
            roleta['id'] = str(roleta.pop('_id'))
            
            return roleta
        except Exception as e:
            logger.error(f"Erro ao obter roleta {roleta_id}: {str(e)}")
            return None
    
    def obter_numeros(self, roleta_id: str, limite: int = 100, 
                      data_inicio: datetime = None, data_fim: datetime = None) -> List[Dict[str, Any]]:
        """
        Obtém os últimos números de uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            limite (int, optional): Limite de registros. Defaults to 100.
            data_inicio (datetime, optional): Data inicial. Defaults to None.
            data_fim (datetime, optional): Data final. Defaults to None.
            
        Returns:
            List[Dict[str, Any]]: Lista de números
        """
        try:
            # Construir filtro
            filtro = {"roleta_id": roleta_id}
            
            if data_inicio and data_fim:
                filtro["timestamp"] = {"$gte": data_inicio, "$lte": data_fim}
            elif data_inicio:
                filtro["timestamp"] = {"$gte": data_inicio}
            elif data_fim:
                filtro["timestamp"] = {"$lte": data_fim}
            
            # Escolher coleção baseada na configuração
            if self.config["usa_colecoes_separadas"] and roleta_id in self.colecoes_por_roleta:
                # Usar coleção específica para esta roleta
                # Não precisa incluir roleta_id no filtro pois a coleção já é específica
                if "roleta_id" in filtro:
                    del filtro["roleta_id"]
                    
                colecao = self.colecoes_por_roleta[roleta_id]
                logger.info(f"Usando coleção dedicada para roleta {roleta_id}")
            else:
                # Usar coleção unificada
                colecao = self.colecoes['roleta_numeros']
                logger.info(f"Usando coleção unificada para roleta {roleta_id}")
            
            # Executar consulta
            numeros = list(colecao.find(filtro)
                            .sort("timestamp", pymongo.DESCENDING)
                            .limit(limite))
            
            # Converter _id para string
            for num in numeros:
                if '_id' in num:
                    num['id'] = str(num.pop('_id'))
            
            return numeros
        except Exception as e:
            logger.error(f"Erro ao obter números da roleta {roleta_id}: {str(e)}")
            return []
    
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
            # Criar documento
            documento = numero_para_documento(
                roleta_id=roleta_id,
                roleta_nome=roleta_nome,
                numero=numero,
                cor=cor,
                timestamp=timestamp
            )
            
            # Inserir no MongoDB - escolher coleção baseada na configuração
            if self.config["usa_colecoes_separadas"]:
                # Garantir que existe uma coleção para essa roleta
                if roleta_id not in self.colecoes_por_roleta:
                    colecao = garantir_colecao_roleta(self.db, roleta_id, roleta_nome)
                    self.colecoes_por_roleta[roleta_id] = colecao
                
                # Usar coleção específica
                result = self.colecoes_por_roleta[roleta_id].insert_one(documento)
                logger.info(f"Número {numero} inserido em coleção dedicada para roleta {roleta_nome}")
            else:
                # Usar coleção única
                result = self.colecoes['roleta_numeros'].insert_one(documento)
                logger.info(f"Número {numero} inserido em coleção unificada para roleta {roleta_nome}")
            
            if result.inserted_id:
                # Atualizar estatísticas (em thread separada para não bloquear)
                try:
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
    
    def atualizar_estatisticas_e_sequencias(self, roleta_id: str, roleta_nome: str) -> bool:
        """
        Atualiza estatísticas e sequências para uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            
        Returns:
            bool: True se atualizado com sucesso, False caso contrário
        """
        try:
            # Obter números dos últimos 7 dias
            data_inicio = datetime.now() - timedelta(days=7)
            
            # Escolher coleção baseada na configuração
            if self.config["usa_colecoes_separadas"] and roleta_id in self.colecoes_por_roleta:
                numeros = list(self.colecoes_por_roleta[roleta_id]
                                .find({"timestamp": {"$gte": data_inicio}})
                                .sort("timestamp", pymongo.ASCENDING))
            else:
                numeros = list(self.colecoes['roleta_numeros']
                                .find({"roleta_id": roleta_id, "timestamp": {"$gte": data_inicio}})
                                .sort("timestamp", pymongo.ASCENDING))
            
            if not numeros:
                logger.warning(f"Nenhum número encontrado para roleta {roleta_nome} nos últimos 7 dias")
                return False
            
            # Extrair apenas os números
            apenas_numeros = [n.get('numero') for n in numeros]
            
            # Calcular estatísticas diárias
            data_hoje = datetime.now().date()
            estatisticas = calcular_estatisticas_diarias(apenas_numeros)
            
            try:
                # Atualizar estatísticas na coleção
                self.colecoes['roleta_estatisticas_diarias'].update_one(
                    {"roleta_id": roleta_id, "data": data_hoje},
                    {"$set": {
                        "roleta_nome": roleta_nome,
                        "estatisticas": estatisticas,
                        "ultimo_numero": apenas_numeros[-1] if apenas_numeros else None,
                        "atualizado_em": datetime.now()
                    }},
                    upsert=True
                )
                
                logger.info(f"Estatísticas diárias para roleta {roleta_nome} atualizadas")
            except Exception as e:
                logger.error(f"Erro ao atualizar estatísticas diárias: {str(e)}")
            
            # Detectar sequências
            try:
                sequencias = detectar_sequencias(apenas_numeros)
                
                # Atualizar sequências na coleção
                for tipo_seq, seqs in sequencias.items():
                    for seq in seqs:
                        comp = len(seq)
                        # Só armazenar sequências relevantes (comprimento >= 3)
                        if comp >= 3:
                            self.colecoes['roleta_sequencias'].update_one(
                                {
                                    "roleta_id": roleta_id, 
                                    "tipo": tipo_seq,
                                    "sequencia": seq
                                },
                                {"$set": {
                                    "roleta_nome": roleta_nome,
                                    "comprimento": comp,
                                    "detectado_em": datetime.now()
                                }},
                                upsert=True
                            )
                
                logger.info(f"Sequências para roleta {roleta_nome} atualizadas")
            except Exception as e:
                logger.error(f"Erro ao atualizar sequências: {str(e)}")
            
            return True
        except Exception as e:
            logger.error(f"Erro ao atualizar estatísticas e sequências para roleta {roleta_nome}: {str(e)}")
            return False
    
    def fechar(self):
        """Fecha a conexão com o MongoDB"""
        try:
            if hasattr(self, 'client') and self.client:
                self.client.close()
                logger.info("Conexão com MongoDB fechada")
        except Exception as e:
            logger.error(f"Erro ao fechar conexão com MongoDB: {str(e)}") 