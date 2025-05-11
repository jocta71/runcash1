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
        # Usar a variável de ambiente para o nome do banco de dados
        self.DB_ROLETAS = os.environ.get('ROLETAS_MONGODB_DB_NAME', 'roletas_db')
        
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
            
            # Acessar banco de dados
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
            logger.warning(f"Banco de dados '{self.DB_ROLETAS}' não encontrado! Execute o script criar_banco_roletas.py primeiro.")
            # Não levanta exceção, continua com fluxo alternativo
        else:
            logger.info(f"Banco de dados '{self.DB_ROLETAS}' encontrado e pronto para uso.")
    
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
        try:
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
        Insere um novo número para uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            numero (int): Número sorteado (0-36)
            cor (str, optional): Cor do número (verde, vermelho, preto). Defaults to None.
            timestamp (str, optional): Timestamp ISO do evento. Defaults to None.
            
        Returns:
            bool: True se inserido com sucesso, False caso contrário
        """
        try:
            # Validar número
            if not isinstance(numero, int):
                try:
                    numero = int(numero)
                except (ValueError, TypeError):
                    logger.error(f"Número inválido: {numero}")
                    return False
            
            # Validar intervalo
            if not (0 <= numero <= 36):
                logger.error(f"Número fora do intervalo válido (0-36): {numero}")
                return False
            
            # Determinar cor se não fornecida
            if cor is None:
                if numero == 0:
                    cor = "verde"
                elif numero in [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]:
                    cor = "vermelho"
                else:
                    cor = "preto"
            
            # Converter timestamp para datetime se for string
            if timestamp is None:
                timestamp_dt = datetime.now()
            elif isinstance(timestamp, str):
                try:
                    timestamp_dt = datetime.fromisoformat(timestamp)
                except ValueError:
                    logger.error(f"Formato de timestamp inválido: {timestamp}")
                    timestamp_dt = datetime.now()
            else:
                timestamp_dt = timestamp
            
            # Garantir que a roleta exista
            self.garantir_roleta_existe(roleta_id, roleta_nome)
            
            # Obter informações da roleta
            info_roleta = self.mapeamento_roletas.get(roleta_id)
            
            if not info_roleta or not info_roleta.get("colecao"):
                logger.error(f"Informações da roleta não encontradas para ID: {roleta_id}")
                return False
            
            colecao_nome = info_roleta.get("colecao")
            
            # Criar documento
            documento = {
                "numero": numero,
                "cor": cor,
                "timestamp": timestamp_dt,
                "criado_em": datetime.now()
            }
            
            # Inserir na coleção da roleta
            resultado = self.db_roletas[colecao_nome].insert_one(documento)
            
            # Verificar se inseriu com sucesso
            if resultado and resultado.inserted_id:
                logger.info(f"Número {numero} inserido para roleta {roleta_nome} (ID: {roleta_id})")
                return True
            else:
                logger.error(f"Falha ao inserir número para roleta {roleta_nome}")
                return False
                
        except Exception as e:
            logger.error(f"Erro ao inserir número para roleta {roleta_nome}: {str(e)}")
            return False
    
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
        Atualiza estatísticas para uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            
        Returns:
            bool: True se atualizado com sucesso, False caso contrário
        """
        try:
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
                # Adicionar metadados
                estatisticas["roleta_id"] = roleta_id
                estatisticas["roleta_nome"] = roleta_nome
                estatisticas["atualizado_em"] = datetime.now()
                
                # Atualizar documento
                self.db_roletas.estatisticas.update_one(
                    {"roleta_id": roleta_id},
                    {"$set": estatisticas},
                    upsert=True
                )
                
                logger.info(f"Estatísticas atualizadas para roleta {roleta_nome}")
                return True
            else:
                logger.warning(f"Coleção de estatísticas não encontrada no banco {self.DB_ROLETAS}")
                return False
            
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
        print("Inicializando fonte de dados para roletas...")
        ds = RoletasDataSource()
        
        print("\nRoletas disponíveis:")
        roletas = ds.obter_roletas()
        print(f"Total de roletas: {len(roletas)}")
        
        for i, roleta in enumerate(roletas[:5]):  # Mostrar apenas 5 para não sobrecarregar
            print(f"  {i+1}. {roleta['nome']} (ID: {roleta['id']})")
        
    except Exception as e:
        print(f"Erro: {str(e)}")
    
    input("\nPressione ENTER para sair...") 