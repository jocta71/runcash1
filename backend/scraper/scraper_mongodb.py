#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
SCRAPER RunCash - Versão MongoDB
Extrai números de roletas em tempo real
"""

import os
import re
import sys
import json
import time
import random
import logging
import traceback
import requests
import uuid
from datetime import datetime

# Configuração inicial de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [SCRAPER] - %(levelname)s - %(message)s'
)
logger = logging.getLogger('runcash')

# Verificação e setup de diretórios
diretorio_atual = os.getcwd()
print(f"\n\n********************************************************************************")
print(f"* MÓDULO SCRAPER_MONGODB SENDO CARREGADO (VERSÃO COM API 888CASINO)")
print(f"* Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"* Diretório atual: {diretorio_atual}")
print(f"* Python versão: {sys.version}")
print(f"********************************************************************************\n")

# Imports internos
try:
    from config import CASINO_URL, roleta_permitida_por_id, MAX_CICLOS, MAX_ERROS_CONSECUTIVOS
    from roletas_permitidas import ALLOWED_ROULETTES
    from mongo_config import inicializar_colecoes, garantir_roleta_existe, inserir_numero
    from event_manager import event_manager
    MODULOS_CORE_DISPONÍVEIS = True
except ImportError as e:
    print(f"Erro ao importar configurações: {e}")
    # Definições padrão em caso de falha na importação
    CASINO_URL = "https://spectate-web.888casino.com/SpectateWebApp2022/common/configuration-files/LobbyV2/configuraciones.lobbyv2.spectate.json"
    MAX_CICLOS = 100
    MAX_ERROS_CONSECUTIVOS = 5
    MODULOS_CORE_DISPONÍVEIS = False
    
    # Roletas permitidas em modo standalone
    ALLOWED_ROULETTES = [
        "2010016",  # Immersive Roulette
        "2380335",  # Brazilian Mega Roulette
        "2010065",  # Bucharest Auto-Roulette
        "2010096",  # Speed Auto Roulette
        "2010017",  # Auto-Roulette
        "2010098"   # Auto-Roulette VIP
    ]
    
    # Função fallback para verificar roletas permitidas
    def roleta_permitida_por_id(roleta_id):
        """Verifica se uma roleta está permitida por ID"""
        if not roleta_id:
            return False
        
        # Limpar o ID (remover prefixos ou sufixos)
        if isinstance(roleta_id, str) and '_' in roleta_id:
            roleta_id = roleta_id.split('_')[0]
        
        # Verificar na lista de permitidas
        return str(roleta_id) in ALLOWED_ROULETTES
    
    # Classe mock para event_manager
    class EventManagerMock:
        def notify_clients(self, event_data, silent=True):
            print(f"[MOCK] Evento enviado: {event_data['type']} - {event_data.get('roleta_nome', '')}")
    
    event_manager = EventManagerMock()

# Verificar configuração de roletas permitidas
print(f"[DEBUG] Roletas permitidas configuradas: {ALLOWED_ROULETTES}")

# Importação da API específica para 888Casino
try:
    from api_888casino import API888Casino
    print("API 888Casino inicializada")
except ImportError:
    # Implementação básica da API se o módulo externo não estiver disponível
    class API888Casino:
        def __init__(self):
            self.api_url = "https://cgp.safe-iplay.com/cgpapi/liveFeed/GetLiveTables"
            self.headers = {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'content-type': 'application/x-www-form-urlencoded',
                'accept': '*/*',
                'origin': 'https://es.888casino.com'
            }
            print("API 888Casino (versão interna) inicializada")
        
        def get_tables(self, regulation_id=2):
            try:
                response = requests.post(
                    self.api_url,
                    headers=self.headers,
                    data=f"regulationID={regulation_id}&clientRequestId={uuid.uuid4()}",
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get('LiveTables', {})
                else:
                    logger.error(f"Erro na API: {response.status_code}")
                    return {}
            except Exception as e:
                logger.error(f"Erro ao acessar API: {e}")
                return {}

# Variáveis globais de controle
ultima_atividade = time.time()
erros_consecutivos = 0
ultimo_numero_por_roleta = {}
ultimo_timestamp_por_roleta = {}
historico_numeros_por_roleta = {}
max_historico_por_roleta = 24

# Classe principal para API 888Casino
class Casino888API:
    """API para capturar dados de roletas do 888Casino"""
    
    def __init__(self):
        # Inicializar API 888Casino
        self.api = API888Casino()
        
    def get_roulette_tables(self, regulation_id=2):
        """Obtém mesas de roleta para um regulation_id específico"""
        try:
            tables = self.api.get_tables(regulation_id)
            logger.info(f"Obtidas {len(tables)} mesas para regulation_id={regulation_id}")
            return tables
        except Exception as e:
            logger.error(f"Erro ao obter mesas: {e}")
            return {}
    
    def get_all_roulette_tables(self):
        """Obtém todas as mesas de roleta de todos os regulation_ids conhecidos"""
        regulation_ids = [2, 1, 15, 16]  # IDs conhecidos
        all_tables = {}
        
        for regulation_id in regulation_ids:
            try:
                logger.info(f"Buscando mesas para regulation_id={regulation_id}")
                tables = self.get_roulette_tables(regulation_id)
                
                # Processar e filtrar as mesas
                for table_id, table_info in tables.items():
                    # Verificar se já temos esta mesa
                    if table_id in all_tables:
                        continue
                    
                    # Extrair informações da mesa
                    table_name = table_info.get('Name', '')
                    last_numbers = table_info.get('RouletteLast5Numbers', [])
                    
                    # Verificar se é uma roleta (tem números ou nome contém "Ruleta"/"Roulette")
                    is_roulette = False
                    if last_numbers and len(last_numbers) > 0:
                        is_roulette = True
                    elif 'Roulette' in table_name or 'Ruleta' in table_name:
                        is_roulette = True
                    
                    # Se for roleta, adicionar à lista
                    if is_roulette:
                        all_tables[table_id] = {
                            'id': table_info.get('GameID', table_id),
                            'name': table_name,
                            'dealer': table_info.get('Dealer', 'Auto'),
                            'is_open': table_info.get('IsOpen', False),
                            'last_numbers': last_numbers
                        }
                
                logger.info(f"Encontradas {len(all_tables)} mesas de roleta até o momento")
                
            except Exception as e:
                logger.error(f"Erro ao processar regulation_id={regulation_id}: {e}")
        
        return all_tables

# Instância global da API
casino_api = Casino888API()

# Funções auxiliares
def cor_numero(num):
    """Determina a cor de um número na roleta"""
    if num == 0:
        return 'verde'
    
    vermelhos = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    return 'vermelho' if num in vermelhos else 'preto'

def novo_numero(db, id_roleta, roleta_nome, numero, numero_hook=None):
    """Registra um novo número"""
    try:
        # Converter para int se for string
        if isinstance(numero, str):
            num_int = int(re.sub(r'[^\d]', '', numero))
        else:
            num_int = int(numero)
        
        # Validar intervalo
        if not (0 <= num_int <= 36):
            return False
        
        # Determinar cor
        cor = cor_numero(num_int)
        ts = datetime.now().isoformat()
        
        # Garantir que a roleta existe
        if hasattr(db, 'garantir_roleta_existe'):
            db.garantir_roleta_existe(id_roleta, roleta_nome)
        elif MODULOS_CORE_DISPONÍVEIS:
            garantir_roleta_existe(db, id_roleta, roleta_nome)
            
        # Inserir número
        if hasattr(db, 'inserir_numero'):
            db.inserir_numero(id_roleta, roleta_nome, num_int, cor, ts)
        elif MODULOS_CORE_DISPONÍVEIS:
            inserir_numero(db, id_roleta, roleta_nome, num_int, cor, ts)
        
        # Log
        logger.info(f"{roleta_nome}: {num_int} ({cor})")
        
        # Notificação de eventos
        event_data = {
            "type": "new_number",
            "roleta_id": id_roleta,
            "roleta_nome": roleta_nome, 
            "numero": num_int,
            "timestamp": ts
        }
        
        if hasattr(event_manager, 'notify_clients'):
            event_manager.notify_clients(event_data, silent=True)
        
        # Hook personalizado
        if numero_hook:
            try:
                numero_hook(id_roleta, roleta_nome, num_int)
            except Exception as e:
                logger.error(f"Erro ao executar hook: {e}")
        
        return True
    except Exception as e:
        logger.error(f"Erro ao processar novo número: {e}")
        return False

def processar_numeros(db, id_roleta, roleta_nome, numeros_novos, numero_hook=None):
    """Processa números evitando duplicações"""
    global ultimo_numero_por_roleta, ultimo_timestamp_por_roleta, historico_numeros_por_roleta
    
    if not numeros_novos or len(numeros_novos) == 0:
        return False
    
    # Tempo mínimo entre atualizações
    min_tempo_entre_atualizacoes = 5
    tempo_atual = time.time()
    
    # Inicializar histórico se necessário
    if id_roleta not in historico_numeros_por_roleta:
        historico_numeros_por_roleta[id_roleta] = []
    
    # Processar cada número
    ok = False
    for num_str in numeros_novos:
        try:
            # Validar formato
            if isinstance(num_str, list) and num_str:
                num_str = num_str[0]
            
            # Converter para inteiro
            if isinstance(num_str, str):
                n = int(re.sub(r'[^\d]', '', num_str))
            else:
                n = int(num_str)
            
            # Verificar intervalo válido
            if not (0 <= n <= 36):
                continue
            
            # Verificar duplicação com último número
            ultimo_numero = ultimo_numero_por_roleta.get(id_roleta)
            ultimo_timestamp = ultimo_timestamp_por_roleta.get(id_roleta, 0)
            
            if (ultimo_numero == n and 
                (tempo_atual - ultimo_timestamp) < min_tempo_entre_atualizacoes):
                continue
            
            # Se passou por todas as validações, registrar o número
            if novo_numero(db, id_roleta, roleta_nome, n, numero_hook):
                ultimo_numero_por_roleta[id_roleta] = n
                ultimo_timestamp_por_roleta[id_roleta] = tempo_atual
                
                # Atualizar histórico
                historico_numeros_por_roleta[id_roleta].append((n, tempo_atual))
                if len(historico_numeros_por_roleta[id_roleta]) > max_historico_por_roleta:
                    historico_numeros_por_roleta[id_roleta] = historico_numeros_por_roleta[id_roleta][-max_historico_por_roleta:]
                
                ok = True
            
        except Exception as e:
            logger.error(f"Erro ao processar número para {roleta_nome}: {e}")
    
    return ok

def scrape_roletas_api(db, numero_hook=None):
    """Função principal de scraping usando a API"""
    global ultima_atividade, erros_consecutivos
    
    logger.info("Iniciando scraping via API 888Casino")
    
    ciclo = 1
    erros = 0
    max_erros = 3
    
    # Intervalo entre consultas
    intervalo_consulta = 10  # segundos
    
    try:
        while ciclo <= MAX_CICLOS or MAX_CICLOS == 0:
            try:
                # Buscar todas as mesas
                tables = casino_api.get_all_roulette_tables()
                logger.info(f"Ciclo {ciclo}: Encontradas {len(tables)} mesas de roleta")
                
                # Contador de atualizações
                roletas_com_numeros = 0
                
                # Processar cada mesa
                for table_id, table_info in tables.items():
                    try:
                        # Verificar se a roleta está permitida
                        if not roleta_permitida_por_id(table_id):
                            continue
                        
                        # Extrair dados
                        roleta_nome = table_info.get('name', f'Roleta_{table_id}')
                        last_numbers = table_info.get('last_numbers', [])
                        
                        # Processar números
                        if last_numbers and len(last_numbers) > 0:
                            if processar_numeros(db, table_id, roleta_nome, last_numbers, numero_hook):
                                roletas_com_numeros += 1
                    
                    except Exception as e:
                        logger.error(f"Erro ao processar roleta {table_id}: {str(e)}")
                
                # Resumo do ciclo
                logger.info(f"Ciclo {ciclo}: Processadas {roletas_com_numeros} roletas com novos números")
                
                # Atualizar controle de erros/atividade
                ultima_atividade = time.time()
                erros_consecutivos = 0
                
                # Aguardar para o próximo ciclo
                time.sleep(intervalo_consulta)
                ciclo += 1
                
            except Exception as e:
                logger.error(f"Erro no ciclo de scraping: {str(e)}")
                erros += 1
                erros_consecutivos += 1
                
                if erros >= max_erros or erros_consecutivos >= MAX_ERROS_CONSECUTIVOS:
                    logger.error(f"Encerrando scraping após {erros} erros consecutivos")
                    break
                
                # Aguardar um pouco mais em caso de erro
                time.sleep(intervalo_consulta * 2)
                
    except KeyboardInterrupt:
        logger.info("Scraping interrompido pelo usuário")
    
    logger.info("Scraping via API finalizado")

# Funções de compatibilidade
def scrape_roletas(db, driver=None, numero_hook=None):
    """Função principal - Agora usa a versão API"""
    logger.info("🚀 Usando scraper com API 888Casino")
    return scrape_roletas_api(db, numero_hook)

def simulate_roulette_data(db):
    """Simulador minimalista para testes"""
    roletas = [
        {"id": "2010016", "nome": "Immersive Roulette"},
        {"id": "2380335", "nome": "Brazilian Mega Roulette"},
        {"id": "2010065", "nome": "Bucharest Auto-Roulette"}
    ]
    
    logger.info(f"Simulando roletas: {','.join([r['nome'] for r in roletas])}")
    
    try:
        while True:
            try:
                roleta = random.choice(roletas)
                rid = roleta["id"]
                nome = roleta["nome"]
                
                num = random.randint(0, 36)
                cor = cor_numero(num)
                
                logger.info(f"Simulação: {nome} - {num} ({cor})")
                
                # Garantir que a roleta existe
                if hasattr(db, 'garantir_roleta_existe'):
                    db.garantir_roleta_existe(rid, nome)
                elif MODULOS_CORE_DISPONÍVEIS:
                    garantir_roleta_existe(db, rid, nome)
                
                ts = datetime.now().isoformat()
                
                # Inserir número
                if hasattr(db, 'inserir_numero'):
                    db.inserir_numero(rid, nome, num, cor, ts)
                elif MODULOS_CORE_DISPONÍVEIS:
                    inserir_numero(db, rid, nome, num, cor, ts)
                
                # Notificação de eventos
                event_data = {
                    "type": "new_number",
                    "roleta_id": rid,
                    "roleta_nome": nome,
                    "numero": num,
                    "timestamp": ts,
                    "simulado": True
                }
                
                if hasattr(event_manager, 'notify_clients'):
                    event_manager.notify_clients(event_data, silent=True)
                
                time.sleep(random.randint(1, 3))
                
            except Exception as e:
                logger.error(f"Erro no simulador: {str(e)}")
                time.sleep(5)
    except KeyboardInterrupt:
        logger.info("Simulação interrompida pelo usuário")

# Testes básicos
if __name__ == "__main__":
    print("\nTeste básico da API 888Casino...")
    try:
        # Testar API
        tables = casino_api.get_roulette_tables(2)
        print(f"Encontradas {len(tables)} mesas para regulation_id=2")
        
        # Mostrar primeiras 3 mesas (exemplo)
        for i, (table_id, table_info) in enumerate(list(tables.items())[:3]):
            print(f"\nMesa #{i+1}: {table_info.get('Name', 'Unknown')}")
            print(f"  ID: {table_id}")
            print(f"  Dealer: {table_info.get('Dealer', 'Auto')}")
            print(f"  Últimos números: {table_info.get('RouletteLast5Numbers', [])}")
    
    except Exception as e:
        print(f"ERRO no teste: {str(e)}")
        traceback.print_exc()

# Exports
__all__ = ['scrape_roletas', 'simulate_roulette_data'] 