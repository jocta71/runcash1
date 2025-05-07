#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para adaptar o scraper existente para utilizar o banco de dados
otimizado com coleções separadas para cada roleta.

Este script deve ser importado e usado no código do scraper para substituir
a fonte de dados original.
"""

import os
import sys
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

# Importar a nova fonte de dados
try:
    from data_source_roletas_db import RoletasDataSource
except ImportError:
    # Se o arquivo não foi encontrado no diretório atual, verificar no diretório do script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.append(script_dir)
    try:
        from data_source_roletas_db import RoletasDataSource
    except ImportError:
        raise ImportError("Não foi possível importar RoletasDataSource. Verifique se o arquivo data_source_roletas_db.py está no diretório do script.")

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("scraper_adapter.log")
    ]
)
logger = logging.getLogger("ScraperAdapter")

# Verificar se a variável de ambiente para o banco de dados está definida
if not os.environ.get('ROLETAS_MONGODB_DB_NAME'):
    os.environ['ROLETAS_MONGODB_DB_NAME'] = 'roletas_db'
    logger.info(f"Variável ROLETAS_MONGODB_DB_NAME não encontrada, usando valor padrão: {os.environ['ROLETAS_MONGODB_DB_NAME']}")
else:
    logger.info(f"Usando banco de dados: {os.environ['ROLETAS_MONGODB_DB_NAME']}")

class ScraperAdapter:
    """
    Adaptador para o scraper existente usar o novo banco de dados otimizado.
    Esta classe utiliza a mesma interface que o scraper original espera,
    mas redireciona as operações para o novo banco de dados.
    """
    
    def __init__(self):
        """Inicializa o adaptador e conecta ao banco de dados otimizado"""
        try:
            # Instanciar a nova fonte de dados
            self.data_source = RoletasDataSource()
            logger.info("Adaptador do scraper inicializado com sucesso!")
        except Exception as e:
            logger.error(f"Erro ao inicializar adaptador do scraper: {str(e)}")
            raise
    
    def obter_roletas(self) -> List[Dict[str, Any]]:
        """
        Obtém todas as roletas disponíveis
        
        Returns:
            List[Dict[str, Any]]: Lista de roletas
        """
        roletas = self.data_source.obter_roletas()
        # Garantir que o formato é compatível com o scraper original
        return [{
            "id": r.get("id"),
            "nome": r.get("nome"),
            # Adicionar campos que o scraper original espera
            "ativa": True,
            "tipo": "Roulette" 
        } for r in roletas]
    
    def inserir_numero(self, roleta_id: str, roleta_nome: str, numero: int, 
                      timestamp: Optional[datetime] = None) -> bool:
        """
        Insere um novo número para uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            numero (int): Número sorteado
            timestamp (datetime, optional): Timestamp do evento. Defaults to None.
        
        Returns:
            bool: True se inserido com sucesso, False caso contrário
        """
        # Determinar cor baseado no número
        cor = None
        if numero == 0:
            cor = "verde"
        elif numero % 2 == 0:
            cor = "preto"
        else:
            cor = "vermelho"
        
        return self.data_source.inserir_numero(
            roleta_id=roleta_id,
            roleta_nome=roleta_nome,
            numero=numero,
            cor=cor,
            timestamp=timestamp
        )
    
    def registrar_numero(self, roleta_id: str, roleta_nome: str, numero: int) -> bool:
        """
        Método de compatibilidade para APIs antigas do scraper
        
        Args:
            roleta_id (str): ID da roleta
            roleta_nome (str): Nome da roleta
            numero (int): Número sorteado
        
        Returns:
            bool: True se registrado com sucesso, False caso contrário
        """
        return self.inserir_numero(roleta_id, roleta_nome, numero)
    
    def obter_ultimos_numeros(self, roleta_id: str, limite: int = 20) -> List[Dict[str, Any]]:
        """
        Obtém os últimos números de uma roleta
        
        Args:
            roleta_id (str): ID da roleta
            limite (int, optional): Limite de registros. Defaults to 20.
        
        Returns:
            List[Dict[str, Any]]: Lista dos últimos números
        """
        return self.data_source.obter_numeros(roleta_id, limite)
    
    def fechar(self):
        """Fecha a conexão com o banco de dados"""
        try:
            if hasattr(self, 'data_source'):
                self.data_source.fechar()
                logger.info("Conexão com banco de dados fechada")
        except Exception as e:
            logger.error(f"Erro ao fechar conexão: {str(e)}")

# Exemplo de como usar este adaptador no scraper existente
"""
# No seu código de scraper, faça as seguintes alterações:

# Ao invés de importar sua classe original, importe este adaptador:
from adaptar_scraper_roletas_db import ScraperAdapter

# Ao invés de instanciar sua classe original, instancie o adaptador:
# data_source = SuaClasseOriginal()  # Código antigo
data_source = ScraperAdapter()      # Código novo

# O restante do código permanece o mesmo, pois o adaptador 
# implementa a mesma interface da classe original

# Exemplo de uso:
roletas = data_source.obter_roletas()
for roleta in roletas:
    print(f"Roleta: {roleta['nome']} (ID: {roleta['id']})")

# Ao inserir um número:
data_source.inserir_numero("12345", "Roleta Automática", 15)

# Ao obter os últimos números:
ultimos_numeros = data_source.obter_ultimos_numeros("12345", 20)
for num in ultimos_numeros:
    print(f"Número: {num['numero']} ({num['cor']})")

# Sempre feche a conexão ao final:
data_source.fechar()
"""

# Teste rápido do adaptador
if __name__ == "__main__":
    try:
        print("Inicializando adaptador do scraper...")
        adapter = ScraperAdapter()
        
        print("\nObtendo lista de roletas:")
        roletas = adapter.obter_roletas()
        print(f"Total de roletas: {len(roletas)}")
        
        for i, roleta in enumerate(roletas[:3]):  # Mostrar apenas 3 para não sobrecarregar
            print(f"  {i+1}. {roleta['nome']} (ID: {roleta['id']})")
            
            if i == 0:  # Testar apenas com a primeira roleta
                # Inserir número de teste
                roleta_id = roleta['id']
                roleta_nome = roleta['nome']
                
                print(f"\nInserindo número de teste para {roleta_nome}...")
                resultado = adapter.inserir_numero(roleta_id, roleta_nome, 17)
                print(f"Resultado da inserção: {'Sucesso' if resultado else 'Falha'}")
                
                print(f"\nObtendo últimos 5 números para {roleta_nome}:")
                numeros = adapter.obter_ultimos_numeros(roleta_id, 5)
                
                for j, num in enumerate(numeros):
                    print(f"  {j+1}. Número: {num['numero']} ({num['cor']}) - {num['timestamp'].strftime('%d/%m/%Y %H:%M:%S')}")
        
        print("\nTestando método de compatibilidade 'registrar_numero'...")
        if roletas:
            roleta_id = roletas[0]['id']
            roleta_nome = roletas[0]['nome']
            resultado = adapter.registrar_numero(roleta_id, roleta_nome, 25)
            print(f"Resultado do registro: {'Sucesso' if resultado else 'Falha'}")
        
        # Fechar conexão
        adapter.fechar()
        print("\nTeste concluído com sucesso!")
        
    except Exception as e:
        print(f"Erro durante teste: {str(e)}")
        
    input("\nPressione ENTER para sair...") 