#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Implementação de fonte de dados MongoDB otimizada que usa o banco roletas_db
com coleções separadas para cada roleta.
"""

import os
import sys
import logging
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pymongo
import threading
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("roletas_db.log")
    ]
)
logger = logging.getLogger("RoletasDB")

class RoletasDataSource:
    """Implementação otimizada de fonte de dados para roletas usando coleções separadas"""
    
    def __init__(self):
        """Inicializa a fonte de dados para o banco roletas_db"""
        # Silenciar pymongo
        logging.getLogger("pymongo").setLevel(logging.WARNING)
        
        # Configurações
        self.MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash')
        self.DB_ORIGINAL = "runcash"     # Banco original para compatibilidade
        self.DB_ROLETAS = "roletas_db"   # Banco otimizado para roletas
        
        logger.info(f"RoletasDataSource: Tentando conectar a {self.MONGODB_URI}")
        logger.info(f"RoletasDataSource: Banco de dados principal configurado para operações de roleta: '{self.DB_ROLETAS}'")
        logger.info(f"RoletasDataSource: Banco de dados original para compatibilidade: '{self.DB_ORIGINAL}'")

        try:
            # Conectar ao MongoDB Atlas
            logger.info(f"Conectando ao MongoDB Atlas...")
            self.client = pymongo.MongoClient(
                self.MONGODB_URI, 
                serverSelectionTimeoutMS=5000
            )
            
            # Verificar conexão
            self.client.server_info()
            logger.info("Conectado ao MongoDB Atlas com sucesso!")
            
            # Acessar bancos de dados
            self.db_original = self.client[self.DB_ORIGINAL]
            self.db_roletas = self.client[self.DB_ROLETAS]
            
            # Verificar se o banco de roletas existe
            self._verificar_banco_roletas()
            
            # Mapear coleções para roletas
            self.mapeamento_roletas = self._mapear_colecoes_roletas()
            
            logger.info(f"Fonte de dados RoletasDB inicializada com sucesso!")
            
        except Exception as e:
            logger.error(f"Erro ao inicializar fonte de dados: {str(e)}")
            raise
    
    def _verificar_banco_roletas(self):
        """Verifica se o banco de dados de roletas existe e está configurado corretamente"""
        dbs = self.client.list_database_names()
        
        if self.DB_ROLETAS not in dbs:
            logger.error(f"RoletasDataSource CRÍTICO: Banco de dados '{self.DB_ROLETAS}' NÃO encontrado! As operações principais de roleta falharão ou usarão um contexto inesperado. Execute o script de criação do banco primeiro.")
            # Considerar levantar uma exceção aqui se o banco é estritamente necessário para operar
            # raise Exception(f"Banco de dados {self.DB_ROLETAS} não encontrado.")
        else:
            logger.info(f"RoletasDataSource: Banco de dados '{self.DB_ROLETAS}' confirmado e pronto para uso.")
    
    def _mapear_colecoes_roletas(self) -> Dict[str, Dict[str, Any]]:
        """
        Cria um mapeamento entre IDs de roletas e suas respectivas coleções
        
        Returns:
            Dict[str, Dict[str, Any]]: Mapeamento de roletas para coleções
        """
        mapeamento = {}
        
        # Verificar se coleção de metadados existe
        if "metadados" in self.db_roletas.list_collection_names():
            # Obter todos os metadados
            for meta in self.db_roletas.metadados.find({}):
                roleta_id = meta.get("roleta_id")
                if roleta_id:
                    mapeamento[roleta_id] = {
                        "colecao": meta.get("colecao"),
                        "roleta_nome": meta.get("roleta_nome"),
                        "ativa": meta.get("ativa", True)
                    }
        
        # Se não encontrou na coleção de metadados, tentar buscar pelas próprias coleções
        if not mapeamento:
            for colecao in self.db_roletas.list_collection_names():
                # Verificar se a coleção é uma roleta (ignorar metadados, views, etc)
                if colecao not in ["metadados", "estatisticas", "numeros_view"] and not colecao.startswith("system."):
                    # Verificar se a coleção tem o formato antigo (roleta_ID) ou novo (ID)
                    if colecao.startswith("roleta_"):
                        # Formato antigo: roleta_ID
                        partes = colecao.split("_")
                        if len(partes) > 1:
                            roleta_id = partes[1]
                            mapeamento[roleta_id] = {
                                "colecao": colecao,
                                "roleta_nome": f"Roleta {roleta_id}",
                                "ativa": True
                            }
                    else:
                        # Formato novo: apenas ID
                        roleta_id = colecao
                        mapeamento[roleta_id] = {
                            "colecao": colecao,
                            "roleta_nome": f"Roleta {roleta_id}",
                            "ativa": True
                        }
        
        logger.info(f"Mapeamento de roletas: {len(mapeamento)} roletas encontradas")
        return mapeamento
    
    def garantir_roleta_existe(self, roleta_id: str, roleta_nome: str) -> str:
        """
        Verifica se a roleta existe, e a insere/atualiza se necessário
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            
        Returns:
            str: ID da roleta no MongoDB
        """
        logger.debug(f"RoletasDataSource: Garantindo roleta {roleta_id} ({roleta_nome}) no banco '{self.DB_ROLETAS}'")
        try:
            # Gerar UUID determinístico
            roleta_id_hash = hashlib.md5(str(roleta_id).encode()).hexdigest()
            roleta_uuid = str(uuid.UUID(roleta_id_hash))
            
            # Verificar no mapeamento
            if roleta_id not in self.mapeamento_roletas:
                logger.info(f"Roleta {roleta_nome} (ID: {roleta_id}) não encontrada no mapeamento. Criando...")
                
                # Nome da coleção (agora usa apenas o ID)
                colecao_nome = roleta_id
                
                # Verificar se a coleção já existe
                if colecao_nome not in self.db_roletas.list_collection_names():
                    # Criar coleção
                    self.db_roletas.create_collection(colecao_nome)
                    
                    # Criar índices
                    self.db_roletas[colecao_nome].create_index([("timestamp", pymongo.DESCENDING)])
                    self.db_roletas[colecao_nome].create_index([("numero", pymongo.ASCENDING)])
                    self.db_roletas[colecao_nome].create_index([("cor", pymongo.ASCENDING)])
                    
                    logger.info(f"Coleção '{colecao_nome}' criada com índices")
                
                # Adicionar ao mapeamento
                self.mapeamento_roletas[roleta_id] = {
                    "colecao": colecao_nome,
                    "roleta_nome": roleta_nome,
                    "ativa": True
                }
                
                # Atualizar metadados
                if "metadados" in self.db_roletas.list_collection_names():
                    self.db_roletas.metadados.update_one(
                        {"roleta_id": roleta_id},
                        {"$set": {
                            "roleta_id": roleta_id,
                            "roleta_nome": roleta_nome,
                            "colecao": colecao_nome,
                            "ativa": True,
                            "atualizado_em": datetime.now()
                        }},
                        upsert=True
                    )
            
            # Garantir compatibilidade com banco original também
            self._garantir_roleta_existe_original(roleta_uuid, roleta_nome)
            
            return roleta_id
        except Exception as e:
            logger.error(f"Erro ao garantir existência da roleta {roleta_nome}: {str(e)}")
            return roleta_id
    
    def _garantir_roleta_existe_original(self, roleta_id: str, roleta_nome: str) -> None:
        """
        Garante que a roleta exista no banco original para compatibilidade
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
        """
        try:
            # Verificar se a roleta já existe no banco original
            if "roletas" in self.db_original.list_collection_names():
                if not self.db_original.roletas.find_one({"_id": roleta_id}):
                    # Criar documento e inserir
                    documento = {
                        "_id": roleta_id,
                        "nome": roleta_nome,
                        "ativa": True,
                        "criado_em": datetime.now(),
                        "atualizado_em": datetime.now()
                    }
                    self.db_original.roletas.insert_one(documento)
                    logger.info(f"Roleta {roleta_nome} (ID: {roleta_id}) criada no banco original para compatibilidade")
        except Exception as e:
            logger.warning(f"Erro ao garantir roleta no banco original: {str(e)}")
    
    def obter_roletas(self) -> List[Dict[str, Any]]:
        """
        Obtém todas as roletas
        
        Returns:
            List[Dict[str, Any]]: Lista de roletas
        """
        try:
            roletas = []
            
            # Buscar da coleção de metadados
            if "metadados" in self.db_roletas.list_collection_names():
                for meta in self.db_roletas.metadados.find({"ativa": True}):
                    roletas.append({
                        "id": meta.get("roleta_id"),
                        "nome": meta.get("roleta_nome"),
                        "colecao": meta.get("colecao")
                    })
            
            # Se não encontrou, usar o mapeamento
            if not roletas:
                for roleta_id, info in self.mapeamento_roletas.items():
                    if info.get("ativa", True):
                        roletas.append({
                            "id": roleta_id,
                            "nome": info.get("roleta_nome"),
                            "colecao": info.get("colecao")
                        })
            
            return roletas
        except Exception as e:
            logger.error(f"Erro ao obter roletas: {str(e)}")
            return []
    
    def inserir_numero(self, roleta_id: str, roleta_nome: str, numero: int, 
                      cor: str = None, timestamp: str = None) -> bool:
        """
        Insere um novo número na coleção apropriada no banco de roletas.
        
        Args:
            roleta_id (str): ID da roleta (deve ser o ID numérico puro)
            roleta_nome (str): Nome da roleta
            numero (int): Número sorteado
            cor (str, optional): Cor do número. Defaults to None.
            timestamp (str, optional): Timestamp do evento. Defaults to None.
            
        Returns:
            bool: True se inserido com sucesso, False caso contrário
        """
        logger.debug(f"RoletasDataSource: Tentando inserir número {numero} para roleta {roleta_id} ({roleta_nome}) no banco '{self.DB_ROLETAS}'")
        
        try:
            # Garantir que roleta existe
            self.garantir_roleta_existe(roleta_id, roleta_nome)
            
            # Obter informações da coleção
            info_roleta = self.mapeamento_roletas.get(roleta_id)
            
            if not info_roleta or not info_roleta.get("colecao"):
                logger.error(f"Coleção não encontrada para roleta {roleta_nome} (ID: {roleta_id})")
                return False
            
            colecao_nome = info_roleta.get("colecao")
            
            # Determinar cor se não fornecida
            if not cor:
                if numero == 0:
                    cor = "verde"
                elif numero % 2 == 0:
                    cor = "preto"
                else:
                    cor = "vermelho"
            
            # Processar timestamp
            if timestamp is None or not timestamp:
                ts = datetime.now()
            else:
                # Tentar converter de string para datetime
                try:
                    if isinstance(timestamp, str):
                        ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    else:
                        ts = timestamp
                except:
                    ts = datetime.now()
            
            # Criar documento
            documento = {
                "numero": numero,
                "cor": cor,
                "timestamp": ts,
                "criado_em": datetime.now()
            }
            
            # Inserir na coleção específica
            result = self.db_roletas[colecao_nome].insert_one(documento)
            
            if result.inserted_id:
                logger.info(f"Número {numero} inserido para roleta {roleta_nome} na coleção {colecao_nome}")
                
                # Atualizar estatísticas (em thread separada para não bloquear)
                try:
                    threading.Thread(
                        target=self.atualizar_estatisticas,
                        args=(roleta_id, roleta_nome),
                        daemon=True
                    ).start()
                except Exception as e:
                    logger.error(f"Erro ao iniciar thread de atualização de estatísticas: {str(e)}")
                
                # Se tiver banco original, inserir lá também para compatibilidade
                self._inserir_numero_original(roleta_id, roleta_nome, numero, cor, ts)
                
                return True
            
            return False
        except Exception as e:
            logger.error(f"Erro ao inserir número {numero} para roleta {roleta_nome}: {str(e)}")
            return False
    
    def _inserir_numero_original(self, roleta_id: str, roleta_nome: str, numero: int, 
                               cor: str, timestamp: datetime) -> None:
        """
        Insere um número no banco original para compatibilidade
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            numero (int): Número sorteado
            cor (str): Cor do número
            timestamp (datetime): Timestamp do evento
        """
        try:
            if "roleta_numeros" in self.db_original.list_collection_names():
                # Criar documento
                documento = {
                    "roleta_id": roleta_id,
                    "roleta_nome": roleta_nome,
                    "numero": numero,
                    "cor": cor,
                    "timestamp": timestamp,
                    "criado_em": datetime.now()
                }
                
                # Inserir no banco original
                self.db_original.roleta_numeros.insert_one(documento)
                logger.info(f"Número {numero} inserido no banco original para compatibilidade")
        except Exception as e:
            logger.warning(f"Erro ao inserir número no banco original: {str(e)}")
    
    def obter_numeros(self, roleta_id: str, limite: int = 100, 
                      data_inicio: datetime = None, data_fim: datetime = None) -> List[Dict[str, Any]]:
        """
        Obtém os últimos números de uma roleta específica do banco de roletas.
        
        Args:
            roleta_id (str): ID da roleta (deve ser o ID numérico puro)
            limite (int, optional): Limite de registros. Defaults to 100.
            data_inicio (datetime, optional): Data inicial. Defaults to None.
            data_fim (datetime, optional): Data final. Defaults to None.
            
        Returns:
            List[Dict[str, Any]]: Lista de números
        """
        logger.debug(f"RoletasDataSource: Obtendo números para roleta {roleta_id} do banco '{self.DB_ROLETAS}', limite {limite}")
        
        try:
            # Obter informações da coleção
            info_roleta = self.mapeamento_roletas.get(roleta_id)
            
            if not info_roleta or not info_roleta.get("colecao"):
                logger.error(f"Coleção não encontrada para roleta ID: {roleta_id}")
                return []
            
            colecao_nome = info_roleta.get("colecao")
            roleta_nome = info_roleta.get("roleta_nome")
            
            # Construir filtro
            filtro = {}
            
            if data_inicio and data_fim:
                filtro["timestamp"] = {"$gte": data_inicio, "$lte": data_fim}
            elif data_inicio:
                filtro["timestamp"] = {"$gte": data_inicio}
            elif data_fim:
                filtro["timestamp"] = {"$lte": data_fim}
            
            # Executar consulta na coleção específica
            numeros = list(self.db_roletas[colecao_nome]
                           .find(filtro)
                           .sort("timestamp", pymongo.DESCENDING)
                           .limit(limite))
            
            # Adicionar roleta_id e roleta_nome aos documentos
            for num in numeros:
                # Converter _id para string
                if '_id' in num:
                    num['id'] = str(num.pop('_id'))
                
                # Adicionar campos da roleta
                num['roleta_id'] = roleta_id
                num['roleta_nome'] = roleta_nome
            
            return numeros
        except Exception as e:
            logger.error(f"Erro ao obter números da roleta {roleta_id}: {str(e)}")
            return []
    
    def atualizar_estatisticas(self, roleta_id: str, roleta_nome: str) -> bool:
        """
        Atualiza estatísticas para uma roleta no banco de roletas.
        
        Args:
            roleta_id (str): ID da roleta (deve ser o ID numérico puro)
            roleta_nome (str): Nome da roleta
            
        Returns:
            bool: True se atualizado com sucesso, False caso contrário
        """
        logger.debug(f"RoletasDataSource: Atualizando estatísticas para roleta {roleta_id} ({roleta_nome}) no banco '{self.DB_ROLETAS}'")
        try:
            # Obter informações da coleção
            info_roleta = self.mapeamento_roletas.get(roleta_id)
            
            if not info_roleta or not info_roleta.get("colecao"):
                logger.error(f"Coleção não encontrada para roleta {roleta_nome} (ID: {roleta_id})")
                return False
            
            colecao_nome = info_roleta.get("colecao")
            
            # Obter números dos últimos 7 dias
            data_inicio = datetime.now() - timedelta(days=7)
            
            # Buscar números na coleção específica
            numeros = list(self.db_roletas[colecao_nome]
                          .find({"timestamp": {"$gte": data_inicio}})
                          .sort("timestamp", pymongo.ASCENDING))
            
            if not numeros:
                logger.warning(f"Nenhum número encontrado para roleta {roleta_nome} nos últimos 7 dias")
                return False
            
            # Extrair apenas os números
            apenas_numeros = [n.get('numero') for n in numeros]
            
            # Cálculos estatísticos básicos
            estatisticas = self._calcular_estatisticas(apenas_numeros)
            
            # Se tiver coleção de estatísticas no banco de roletas, atualizar
            if "estatisticas" in self.db_roletas.list_collection_names():
                # Usar datetime.datetime em vez de datetime.date para evitar erro de codificação
                data_hoje = datetime.now()
                
                self.db_roletas.estatisticas.update_one(
                    {"roleta_id": roleta_id, "data": data_hoje.strftime("%Y-%m-%d")},
                    {"$set": {
                        "roleta_nome": roleta_nome,
                        "estatisticas": estatisticas,
                        "ultimo_numero": apenas_numeros[-1] if apenas_numeros else None,
                        "atualizado_em": datetime.now()
                    }},
                    upsert=True
                )
                
                logger.info(f"Estatísticas para roleta {roleta_nome} atualizadas no banco de roletas")
            
            # Atualizar também no banco original para compatibilidade
            if "roleta_estatisticas_diarias" in self.db_original.list_collection_names():
                # Usar datetime.datetime em vez de datetime.date para evitar erro de codificação
                data_hoje = datetime.now()
                
                self.db_original.roleta_estatisticas_diarias.update_one(
                    {"roleta_id": roleta_id, "data": data_hoje.strftime("%Y-%m-%d")},
                    {"$set": {
                        "roleta_nome": roleta_nome,
                        "estatisticas": estatisticas,
                        "ultimo_numero": apenas_numeros[-1] if apenas_numeros else None,
                        "atualizado_em": datetime.now()
                    }},
                    upsert=True
                )
                
                logger.info(f"Estatísticas para roleta {roleta_nome} atualizadas no banco original")
            
            return True
        except Exception as e:
            logger.error(f"Erro ao atualizar estatísticas para roleta {roleta_nome}: {str(e)}")
            return False
    
    def _calcular_estatisticas(self, numeros: List[int]) -> Dict[str, Any]:
        """
        Calcula estatísticas básicas a partir de uma lista de números
        
        Args:
            numeros (List[int]): Lista de números
            
        Returns:
            Dict[str, Any]: Estatísticas calculadas
        """
        if not numeros:
            return {}
        
        # Contagem por número
        contagem = {}
        for n in range(37):  # 0-36
            contagem[str(n)] = numeros.count(n)
        
        # Contagem por cor
        pretos = sum(1 for n in numeros if n % 2 == 0 and n != 0)
        vermelhos = sum(1 for n in numeros if n % 2 != 0)
        verdes = sum(1 for n in numeros if n == 0)
        
        # Contagem por dúzia
        duzia1 = sum(1 for n in numeros if 1 <= n <= 12)
        duzia2 = sum(1 for n in numeros if 13 <= n <= 24)
        duzia3 = sum(1 for n in numeros if 25 <= n <= 36)
        
        # Contagem por coluna
        coluna1 = sum(1 for n in numeros if n > 0 and n % 3 == 1)
        coluna2 = sum(1 for n in numeros if n > 0 and n % 3 == 2)
        coluna3 = sum(1 for n in numeros if n > 0 and n % 3 == 0)
        
        # Números quentes (mais frequentes)
        numeros_quentes = sorted(
            [(int(n), c) for n, c in contagem.items()], 
            key=lambda x: x[1], 
            reverse=True
        )[:5]
        
        # Números frios (menos frequentes)
        numeros_frios = sorted(
            [(int(n), c) for n, c in contagem.items() if int(n) <= 36], 
            key=lambda x: x[1]
        )[:5]
        
        return {
            "total": len(numeros),
            "contagem": contagem,
            "cores": {
                "preto": pretos,
                "vermelho": vermelhos,
                "verde": verdes
            },
            "duzias": {
                "primeira": duzia1,
                "segunda": duzia2,
                "terceira": duzia3
            },
            "colunas": {
                "primeira": coluna1,
                "segunda": coluna2,
                "terceira": coluna3
            },
            "quentes": numeros_quentes,
            "frios": numeros_frios
        }
    
    def fechar(self):
        """Fecha a conexão com o MongoDB"""
        try:
            if hasattr(self, 'client') and self.client:
                self.client.close()
                logger.info("Conexão com MongoDB Atlas fechada")
        except Exception as e:
            logger.error(f"Erro ao fechar conexão com MongoDB: {str(e)}")

# Exemplo de uso
if __name__ == "__main__":
    try:
        # Inicializar fonte de dados
        data_source = RoletasDataSource()
        
        # Lista de roletas
        roletas = data_source.obter_roletas()
        print(f"Roletas encontradas: {len(roletas)}")
        
        for i, roleta in enumerate(roletas[:5]):  # Mostrar apenas 5 para não sobrecarregar
            print(f"  {i+1}. {roleta.get('nome')} (ID: {roleta.get('id')})")
        
        # Fechar conexão
        data_source.fechar()
        
    except Exception as e:
        print(f"Erro: {str(e)}")
        
    input("\nPressione ENTER para sair...") 