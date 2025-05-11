#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
SCRAPER RunCash - Versão MongoDB
Extrai números de roletas em tempo real
"""

import os
import json
import time
import random
import logging
import requests
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Union
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError
from bson import ObjectId

import logging
# Configurar o logger
logger = logging.getLogger('runcash')

# Verificação e setup de diretórios
diretorio_atual = os.getcwd()
print(f"\n\n********************************************************************************")
print(f"* MÓDULO SCRAPER_MONGODB SENDO CARREGADO (VERSÃO COM API 888CASINO)")
print(f"* Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"* Diretório atual: {diretorio_atual}")
print(f"* Python versão: {os.sys.version}")
print(f"********************************************************************************\n")

# Imports internos
try:
    from config import CASINO_URL, roleta_permitida_por_id, MAX_CICLOS, MAX_ERROS_CONSECUTIVOS
    from roletas_permitidas import ALLOWED_ROULETTES
except ImportError as e:
    print(f"Erro ao importar configurações: {e}")
    # Definições padrão em caso de falha na importação
    CASINO_URL = "https://spectate-web.888casino.com/SpectateWebApp2022/common/configuration-files/LobbyV2/configuraciones.lobbyv2.spectate.json"
    MAX_CICLOS = 100
    MAX_ERROS_CONSECUTIVOS = 5
    ALLOWED_ROULETTES = [
        "2010016",  # Immersive Roulette
        "2380335",  # Brazilian Mega Roulette
        "2010065",  # Bucharest Auto-Roulette
        "2010096",  # Speed Auto Roulette
        "2010017",  # Auto-Roulette
        "2010098"   # Auto-Roulette VIP
    ]
    
    def roleta_permitida_por_id(roleta_id):
        return roleta_id in ALLOWED_ROULETTES

# Importação de APIs específicas
try:
    from api_888casino import API888Casino
    print("API 888Casino inicializada")
except Exception as e:
    print(f"Erro ao inicializar API 888Casino: {e}")
    raise

# Configura o logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [SCRAPER_API] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('runcash')
logger.setLevel(logging.INFO)

# Variáveis de controle
ultima_atividade = time.time()
erros_consecutivos = 0

# Variáveis para evitar duplicações
ultimo_numero_por_roleta = {}
ultimo_timestamp_por_roleta = {}
assinaturas_roletas = {}
historico_numeros_por_roleta = {}  # {id_roleta: [(numero, timestamp), ...]}
max_historico_por_roleta = 24      # Quantidade de números a manter no histórico
sequencias_por_roleta = {}  # {id_roleta: [num1, num2, num3, num4, num5]}

# Classe principal da API
class Casino888API:
    """API para capturar dados de roletas do 888Casino"""
    
    def __init__(self):
        # URL da API
        self.api_url = "https://cgp.safe-iplay.com/cgpapi/liveFeed/GetLiveTables"
        
        # Headers padrão
        self.headers = {
            'sec-ch-ua-platform': '"Windows"',
            'referer': 'https://es.888casino.com/live-casino/#filters=live-roulette',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
            'content-type': 'application/x-www-form-urlencoded',
            'sec-ch-ua-mobile': '?0',
            'accept': '*/*',
            'origin': 'https://es.888casino.com'
        }
        
        # Configurações padrão para o payload
        self.client_properties = {
            "version": "CGP-58-82-88-SPA-4.2354.7,0,4.2354.7-NC1",
            "brandName": "888Casino.com",
            "subBrandId": 82,
            "brandId": 58,
            "productPackageId": 88,
            "screenWidth": 1280,
            "screenHeight": 800,
            "language": "spa",
            "operatingSystem": "windows"
        }
        
        print("API 888Casino inicializada")

    def get_roulette_tables(self, regulation_id=2):
        """Obtém as mesas de roleta para um determinado regulation_id"""
        try:
            # Gerar UUID para o clientRequestId
            client_request_id = str(uuid.uuid4())
            
            # Codificar os client_properties para URL
            client_properties_encoded = quote(json.dumps(self.client_properties))
            
            # Montar o payload
            payload = f"regulationID={regulation_id}&lang=spa&clientRequestId={client_request_id}&clientProperties={client_properties_encoded}&CGP_DomainOrigin=https%3A%2F%2Fes.888casino.com&CGP_State=live-casino%2F%23filters%3Dlive-roulette&CGP_Skin=888casino&CGP_SkinOverride=es&CGP_Country=USA&CGP_UseCountryAsState=false"
            
            # Fazer a requisição
            response = requests.post(self.api_url, headers=self.headers, data=payload, timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                
                if 'LiveTables' in result:
                    return result['LiveTables']
                else:
                    print(f"API não retornou 'LiveTables' para regulation_id={regulation_id}")
            else:
                print(f"Erro na requisição à API: {response.status_code}")
            
            return {}
            
        except Exception as e:
            print(f"Erro ao acessar API do 888Casino: {str(e)}")
            return {}
    
    def get_all_roulette_tables(self):
        """Obtém todas as mesas de roleta de todos os regulation_ids conhecidos"""
        regulation_ids = [2, 1, 15, 16]  # IDs conhecidos
        all_tables = {}
        
        for regulation_id in regulation_ids:
            try:
                print(f"Buscando mesas para regulation_id={regulation_id}")
                tables = self.get_roulette_tables(regulation_id)
                
                # Processar e filtrar as mesas
                for table_id, table_info in tables.items():
                    # Verificar se já temos esta mesa
                    if table_id in all_tables:
                        continue
                    
                    # Extrair informações da mesa
                    table_name = table_info.get('Name', '')
                    last_numbers = table_info.get('RouletteLast5Numbers', [])
                    game_type = table_info.get('GameType', '')
                    
                    # Verificar se é uma roleta
                    is_roulette = False
                    
                    # Método 1: Tem números
                    if last_numbers is not None and len(last_numbers) > 0:
                        is_roulette = True
                    # Método 2: Nome contém "Ruleta" ou "Roulette"
                    elif 'Roulette' in table_name or 'Ruleta' in table_name:
                        is_roulette = True
                    # Método 3: GameType contém "roulette" ou "ruleta"
                    elif game_type and ('roulette' in game_type.lower() or 'ruleta' in game_type.lower()):
                        is_roulette = True
                    
                    # Se for roleta, adicionar à lista
                    if is_roulette:
                        all_tables[table_id] = {
                            'id': table_info.get('GameID', table_id),
                            'name': table_name,
                            'dealer': table_info.get('Dealer', 'Auto'),
                            'is_open': table_info.get('IsOpen', False),
                            'last_numbers': last_numbers,
                            'game_type': game_type
                        }
                
                print(f"Encontradas {len(all_tables)} mesas de roleta até o momento")
                
            except Exception as e:
                print(f"Erro ao processar regulation_id={regulation_id}: {str(e)}")
        
        return all_tables

# Instância global da API
casino_api = Casino888API()

# Funções principais
def cor_numero(num):
    """Determina a cor de um número na roleta"""
    if num == 0:
        return 'verde'
    
    vermelhos = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    return 'vermelho' if num in vermelhos else 'preto'

def novo_numero(db, id_roleta, roleta_nome, numero, numero_hook=None):
    """Registra um novo número"""
    try:
        if isinstance(numero, str):
            num_int = int(re.sub(r'[^\d]', '', numero))
        else:
            num_int = int(numero)
        
        if not (0 <= num_int <= 36):
            return False
        
        cor = cor_numero(num_int)
        ts = datetime.now().isoformat()
        
        # Interação com o banco de dados
        if hasattr(db, 'garantir_roleta_existe'):
            db.garantir_roleta_existe(id_roleta, roleta_nome)
        if hasattr(db, 'inserir_numero'):
            db.inserir_numero(id_roleta, roleta_nome, num_int, cor, ts)
        
        # Log
        print(f"{roleta_nome}:{num_int}:{cor}")
        
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
                print(f"Erro ao executar hook: {str(e)}")
        
        return True
    except Exception as e:
        print(f"Erro ao processar novo número: {str(e)}")
        return False

def processar_numeros(db, id_roleta, roleta_nome, numeros_novos, numero_hook=None):
    """Processa números com validação rigorosa para evitar duplicações"""
    global ultimo_numero_por_roleta, ultimo_timestamp_por_roleta, assinaturas_roletas
    global historico_numeros_por_roleta, sequencias_por_roleta
    
    if not numeros_novos or len(numeros_novos) == 0:
        return False
    
    # Obter números recentes para validação
    existentes = []
    try:
        if hasattr(db, 'obter_numeros_recentes'):
            nums = db.obter_numeros_recentes(id_roleta, limite=10)
            existentes = [n.get('numero') for n in nums]
    except Exception as e:
        print(f"Erro ao obter números recentes: {str(e)}")
    
    # Tempo mínimo entre atualizações
    min_tempo_entre_atualizacoes = 5
    tempo_atual = time.time()
    
    # Inicializar estruturas de dados para esta roleta
    if id_roleta not in historico_numeros_por_roleta:
        historico_numeros_por_roleta[id_roleta] = []
    
    if id_roleta not in sequencias_por_roleta:
        sequencias_por_roleta[id_roleta] = []
    
    # Processamento de cada número novo
    ok = False
    for num_str in numeros_novos:
        try:
            # Validar formato do número
            if isinstance(num_str, list):
                if num_str and len(num_str) > 0:
                    num_str = num_str[0]
                else:
                    continue
            
            # Converter para inteiro
            if isinstance(num_str, str):
                n = int(re.sub(r'[^\d]', '', num_str))
            else:
                n = int(num_str)
            
            # Verificar intervalo válido
            if not 0 <= n <= 36:
                continue
            
            # Verificação de duplicação por assinatura
            timestamp_arredondado = int(tempo_atual / 3) * 3
            assinatura_atual = f"{id_roleta}_{n}_{timestamp_arredondado}"
            
            if assinatura_atual in assinaturas_roletas:
                ultimo_uso = assinaturas_roletas[assinatura_atual]
                if tempo_atual - ultimo_uso < min_tempo_entre_atualizacoes:
                    continue
            
            # Verificação de duplicação por número recente
            ultimo_numero = ultimo_numero_por_roleta.get(id_roleta)
            ultimo_timestamp = ultimo_timestamp_por_roleta.get(id_roleta, 0)
            
            if (ultimo_numero == n and 
                (tempo_atual - ultimo_timestamp) < min_tempo_entre_atualizacoes):
                continue
            
            # Verificação de duplicação por sequência
            sequencia_atual = sequencias_por_roleta.get(id_roleta, [])
            
            if sequencia_atual and n == sequencia_atual[0]:
                continue
            
            # Se passou por todas as validações, registrar o número
            if novo_numero(db, id_roleta, roleta_nome, n, numero_hook):
                # Atualizar controles locais
                ultimo_numero_por_roleta[id_roleta] = n
                ultimo_timestamp_por_roleta[id_roleta] = tempo_atual
                assinaturas_roletas[assinatura_atual] = tempo_atual
                
                # Atualizar histórico
                historico_numeros_por_roleta[id_roleta].append((n, tempo_atual))
                if len(historico_numeros_por_roleta[id_roleta]) > max_historico_por_roleta:
                    historico_numeros_por_roleta[id_roleta] = historico_numeros_por_roleta[id_roleta][-max_historico_por_roleta:]
                
                # Atualizar sequência
                sequencias_por_roleta[id_roleta] = [n] + sequencia_atual
                if len(sequencias_por_roleta[id_roleta]) > 5:
                    sequencias_por_roleta[id_roleta] = sequencias_por_roleta[id_roleta][:5]
                
                ok = True
            
        except Exception as e:
            print(f"Erro ao processar número para {roleta_nome}: {str(e)}")
    
    return ok

def scrape_roletas_api(db, numero_hook=None):
    """Função principal de scraping usando a API"""
    global ultima_atividade, erros_consecutivos
    
    print("[API] Iniciando scraping via API 888Casino")
        
        ciclo = 1
        erros = 0
        max_erros = 3
    
    # Roletas permitidas
    ids_permitidos = os.environ.get('ALLOWED_ROULETTES', '').split(',')
    if ids_permitidos and ids_permitidos[0].strip():
        print(f"[API] Monitorando roletas específicas: {','.join([i[:5] for i in ids_permitidos if i.strip()])}")
    
    # Intervalo entre consultas
    intervalo_consulta = 5
        
        while ciclo <= MAX_CICLOS or MAX_CICLOS == 0:
            try:
            # Buscar todas as mesas
            tables = casino_api.get_all_roulette_tables()
            print(f"[API] Ciclo {ciclo}: Encontradas {len(tables)} mesas de roleta")
            
            # Contador de atualizações
            roletas_com_numeros = 0
            
            # Processar cada mesa
            for table_id, table_info in tables.items():
                try:
                        # Verificar se a roleta está permitida
                    if ids_permitidos and ids_permitidos[0].strip():
                        if not roleta_permitida_por_id(table_id):
                            continue
                        
                    roleta_nome = table_info['name']
                    last_numbers = table_info.get('last_numbers', [])
                    
                    # Processar números
                    if last_numbers:
                        numero_recente = last_numbers[0] if last_numbers else None
                        
                        if numero_recente:
                            if processar_numeros(db, table_id, roleta_nome, [numero_recente], numero_hook):
                                roletas_com_numeros += 1
                        
                    except Exception as e:
                    print(f"[API] Erro ao processar mesa {table_id}: {str(e)}")
            
            # Atualizar controles
            ultima_atividade = time.time()
            erros_consecutivos = 0
            
            # Log
            print(f"[API] Ciclo {ciclo} completo: {roletas_com_numeros} roletas com novos números")
            
            # Intervalo
            time.sleep(intervalo_consulta)
                ciclo += 1
                
            except Exception as e:
            print(f"[API] Erro no ciclo {ciclo}: {str(e)}")
                erros += 1
                erros_consecutivos += 1
                
            time.sleep(intervalo_consulta * 2)
            
            if erros >= max_erros:
                print(f"[API] Muitos erros consecutivos ({erros}), reiniciando ciclo")
                        erros = 0

# Funções de compatibilidade
def scrape_roletas(db, driver=None, numero_hook=None):
    """Função principal - Agora usa a versão API"""
    print("🚀 Usando scraper com API 888Casino")
    return scrape_roletas_api(db, numero_hook)

def simulate_roulette_data(db):
    """Simulador minimalista para testes"""
    roletas = [
        {"id": "2010154", "nome": "Auto Lightning Roulette"},
        {"id": "2010045", "nome": "Ruleta en Vivo"},
        {"id": "2010168", "nome": "888 Ruleta en Vivo"}
    ]
    
    print(f"Simulando: {','.join([r['nome'] for r in roletas])}")
    
    while True:
        try:
            roleta = random.choice(roletas)
            rid = roleta["id"]
            nome = roleta["nome"]
            
            num = random.randint(0, 36)
            cor = cor_numero(num)
            
            print(f"{nome}:{num}:{cor}")
            
            if hasattr(db, 'garantir_roleta_existe'):
            db.garantir_roleta_existe(rid, nome)
            
            ts = datetime.now().isoformat()
            
            if hasattr(db, 'inserir_numero'):
            db.inserir_numero(rid, nome, num, cor, ts)
            
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
            print(f"Erro no simulador: {str(e)}")
            time.sleep(5)

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