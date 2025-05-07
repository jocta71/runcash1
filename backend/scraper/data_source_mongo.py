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
            self.colecoes = self.recursos["colecoes"]
            self.colecoes_por_roleta = self.recursos.get("colecoes_por_roleta", {})
            self.config = self.recursos.get("config", {"usa_colecoes_separadas": False})
            
            logger.info("Fonte de dados MongoDB inicializada com sucesso")
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
            # Gerar UUID determinístico
            roleta_id_hash = hashlib.md5(str(roleta_id).encode()).hexdigest()
            roleta_uuid = str(uuid.UUID(roleta_id_hash))
            
            # Verificar se a roleta já existe
            if not self.colecoes['roletas'].find_one({"_id": roleta_uuid}):
                # Criar documento e inserir
                documento = roleta_para_documento(roleta_uuid, roleta_nome)
                self.colecoes['roletas'].insert_one(documento)
                logger.info(f"Roleta {roleta_nome} (ID: {roleta_uuid}) criada no MongoDB")
            
            # Se estiver usando coleções específicas, verificar se a roleta tem coleção
            if self.config.get("usa_colecoes_separadas", False):
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
                    
                logger.info(f"Garantida coleção específica para roleta {roleta_nome} (ID: {roleta_id})")
            
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
                roleta['id'] = roleta.pop('_id')
            
            return roletas
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
            
            # Determinar qual coleção usar
            if self.config.get("usa_colecoes_separadas", False):
                # Verificar se a roleta tem uma coleção específica
                if roleta_id in self.colecoes_por_roleta:
                    # Usar a coleção específica da roleta
                    colecao = self.colecoes_por_roleta[roleta_id]
                    
                    # Consultar os últimos números da roleta (sem filtro de roleta_id, pois a coleção já é específica)
                    numeros_docs = list(colecao
                        .find({})
                        .sort("timestamp", -1)
                        .limit(limite))
                else:
                    print(f"[DATA] Roleta ID {roleta_id} não tem coleção específica, usando vazio")
                    return []
            else:
                # Usar a coleção comum
                # Consultar os últimos números da roleta
                numeros_docs = list(self.colecoes['roleta_numeros']
                    .find({"roleta_id": roleta_id})
                    .sort("timestamp", -1)
                    .limit(limite))
            
            # Extrair apenas os números
            numeros = [doc['numero'] for doc in numeros_docs]
            print(f"[DATA] Encontrados {len(numeros)} números para roleta ID: {roleta_id}")
            return numeros
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
            
            # Determinar qual coleção usar
            if self.config.get("usa_colecoes_separadas", False):
                # Verificar se a roleta tem uma coleção específica
                if roleta_id in self.colecoes_por_roleta:
                    # Usar a coleção específica da roleta
                    colecao = self.colecoes_por_roleta[roleta_id]
                    
                    # Tentar obter o timestamp do número (sem filtro de roleta_id)
                    numero_doc = colecao.find_one(
                        {"numero": numero},
                        sort=[("timestamp", -1)],
                        skip=indice
                    )
                else:
                    print(f"[DATA] Roleta ID {roleta_id} não tem coleção específica, usando timestamp atual")
                    return datetime.now().isoformat()
            else:
                # Usar a coleção comum
                # Tentar obter o timestamp do número
                numero_doc = self.colecoes['roleta_numeros'].find_one(
                    {"roleta_id": roleta_id, "numero": numero},
                    sort=[("timestamp", -1)],
                    skip=indice
                )
            
            if numero_doc and 'timestamp' in numero_doc:
                # Converter para string ISO
                timestamp = numero_doc['timestamp'].isoformat()
                print(f"[DATA] Timestamp encontrado: {timestamp}")
                return timestamp
            
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
            # Determinar qual coleção usar
            if self.config.get("usa_colecoes_separadas", False):
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
            else:
                # Usar a coleção comum
                colecao = self.colecoes['roleta_numeros']
            
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
                if self.config.get("usa_colecoes_separadas", False):
                    logger.info(f"Número {numero} inserido para roleta {roleta_nome} (DB ID: {roleta_id})")
                else:
                    logger.info(f"Número {numero} inserido para roleta {roleta_nome}")
                
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
            # Calcular estatísticas diárias para a data atual
            calcular_estatisticas_diarias(roleta_id)
            
            # Detectar sequências
            detectar_sequencias(roleta_id)
            
            logger.debug(f"Estatísticas e sequências atualizadas para roleta {roleta_nome}")
        except Exception as e:
            logger.error(f"Erro ao atualizar estatísticas e sequências para roleta {roleta_nome}: {str(e)}")
    
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
            # Gerar UUID determinístico se necessário
            if len(roleta_id) != 36:  # Não é um UUID
                roleta_id_hash = hashlib.md5(str(roleta_id).encode()).hexdigest()
                roleta_id = str(uuid.UUID(roleta_id_hash))
            
            # Usar data atual se não especificada
            if data is None:
                data = datetime.now()
            
            # Formatar data como string YYYY-MM-DD
            data_str = data.strftime("%Y-%m-%d")
            
            # Consultar estatísticas no MongoDB
            estatisticas = self.colecoes['roleta_estatisticas_diarias'].find_one({
                "roleta_id": roleta_id,
                "data": data_str
            })
            
            if not estatisticas:
                # Se não existirem estatísticas, calculá-las
                return calcular_estatisticas_diarias(roleta_id, data)
            
            # Remover _id do documento
            if '_id' in estatisticas:
                del estatisticas['_id']
            
            return estatisticas
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
            colecao_sequencias = self.db[self.colecoes['sequencias']]
            filtro = {'roleta_id': roleta_id}
            
            if tipo:
                filtro['tipo'] = tipo
                
            sequencias = list(colecao_sequencias.find(
                filtro,
                {'_id': 0}
            ).sort('timestamp', pymongo.DESCENDING).limit(100))
            
            return sequencias
        except Exception as e:
            logger.error(f"Erro ao obter sequências: {str(e)}")
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
        Atualiza os dados da estratégia para uma roleta no MongoDB
        
        Args:
            roleta_id: ID da roleta
            roleta_nome: Nome da roleta
            estado: Estado atual da estratégia (NEUTRAL, TRIGGER, etc.)
            numero_gatilho: Número gatilho atual
            numero_gatilho_anterior: Número gatilho anterior
            terminais_gatilho: Lista dos terminais do número gatilho
            terminais_gatilho_anterior: Lista dos terminais do número gatilho anterior
            vitorias: Número de vitórias
            derrotas: Número de derrotas
            ultimo_numero: Último número processado
            
        Returns:
            bool: True se atualizado com sucesso, False caso contrário
        """
        try:
            # Garantir que roleta_nome seja string
            roleta_nome_str = str(roleta_nome) if roleta_nome is not None else "Roleta Desconhecida"
            
            # Gerar uma sugestão de display com base no estado da estratégia
            sugestao_display = ""
            if estado == "NEUTRAL":
                sugestao_display = "AGUARDANDO GATILHO"
            elif estado == "TRIGGER" and terminais_gatilho:
                sugestao_display = f"APOSTAR EM: {','.join(map(str, terminais_gatilho))}"
            elif estado == "POST_GALE_NEUTRAL" and terminais_gatilho_anterior:
                sugestao_display = f"GALE EM: {','.join(map(str, terminais_gatilho_anterior))}"
            elif estado == "MORTO":
                sugestao_display = "AGUARDANDO PRÓXIMO CICLO"
            
            # Dados a serem armazenados
            dados_estrategia = {
                'estado_estrategia': estado,
                'numero_gatilho': numero_gatilho,
                'numero_gatilho_anterior': numero_gatilho_anterior,
                'terminais_gatilho': terminais_gatilho,
                'terminais_gatilho_anterior': terminais_gatilho_anterior,
                'vitorias': vitorias,
                'derrotas': derrotas,
                'sugestao_display': sugestao_display,
                'ultimo_numero': ultimo_numero,
                'updated_at': datetime.now().isoformat(),
                'nome': roleta_nome_str,  # Garantir que o campo nome esteja presente
                'roleta_nome': roleta_nome_str  # Manter compatibilidade com ambos os campos
            }
            
            # Atualizar a coleção de roletas
            colecao_roletas = self.db[self.colecoes['roletas']]
            resultado = colecao_roletas.update_one(
                {'_id': roleta_id},
                {'$set': dados_estrategia},
                upsert=True
            )
            
            # Também salvar o histórico de análise da estratégia para análise posterior
            try:
                colecao_estrategia = self.db['estrategia_historico']
                dados_historico = dados_estrategia.copy()
                dados_historico['roleta_id'] = roleta_id
                dados_historico['roleta_nome'] = roleta_nome_str
                dados_historico['timestamp'] = datetime.now().isoformat()
                colecao_estrategia.insert_one(dados_historico)
                logger.info(f"Histórico de estratégia salvo para roleta {roleta_nome_str}")
            except Exception as e:
                logger.error(f"Erro ao salvar histórico de estratégia: {str(e)}")
            
            return resultado.acknowledged
        
        except Exception as e:
            logger.error(f"Erro ao atualizar dados de estratégia: {str(e)}")
            return False
    
    def fechar(self):
        """Fecha a conexão com o banco de dados"""
        try:
            if hasattr(self, 'client') and self.client:
                self.client.close()
                logger.info("Conexão com MongoDB fechada")
        except Exception as e:
            logger.error(f"Erro ao fechar conexão com MongoDB: {str(e)}") 