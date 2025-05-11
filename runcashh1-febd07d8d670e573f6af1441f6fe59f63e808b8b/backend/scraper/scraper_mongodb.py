#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scraper roletas MongoDB - Versão API 888Casino
"""

import time
import random
import re
import os
import logging
from datetime import datetime
import threading
import queue
import sys
import tempfile
import traceback
import json
import requests
from urllib.parse import quote

# Logs de inicialização do scraper
print("\n\n" + "*" * 80)
print("* MÓDULO SCRAPER_MONGODB SENDO CARREGADO (VERSÃO COM API 888CASINO)")
print(f"* Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"* Diretório atual: {os.getcwd()}")
print(f"* Python versão: {sys.version}")
print("*" * 80 + "\n")

try:
    from config import CASINO_URL, roleta_permitida_por_id, MAX_CICLOS, MAX_ERROS_CONSECUTIVOS
    from event_manager import event_manager
    MODULOS_CORE_DISPONÍVEIS = True
except ImportError as e:
    print(f"Aviso: {e}")
    print("Executando em modo standalone - sem integração com o resto do sistema")
    MODULOS_CORE_DISPONÍVEIS = False
    # Valores padrão para uso standalone
    CASINO_URL = "https://es.888casino.com/live-casino/#filters=live-roulette"
    MAX_CICLOS = 0  # 0 = infinito
    MAX_ERROS_CONSECUTIVOS = 5
    
    # Mock do event_manager
    class EventManagerMock:
        def __init__(self):
            self.event_queue = queue.Queue()
            self.clients = []
        
        def notify_clients(self, event_data, silent=True):
            print(f"[MOCK] Evento enviado: {event_data['type']} - {event_data.get('roleta_nome', '')}")
    
    event_manager = EventManagerMock()
    
    def roleta_permitida_por_id(id_roleta):
        return True  # Permitir todas as roletas em modo standalone

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
            # Gerar ID único para o clientRequestId
            client_request_id = str(random.randint(10000000, 99999999))
            
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

def novo_numero(db, id_roleta_para_db, roleta_nome, numero, numero_hook=None):
    """Registra um novo número"""
    try:
        # Garantir que id_roleta_para_db seja um ID numérico
        if not isinstance(id_roleta_para_db, str) or not id_roleta_para_db.isdigit():
            logger.warning(f"ID da roleta deve ser numérico: {id_roleta_para_db}. Verificar formato.")
            # Tente converter se possível, ou continue com o valor original
            if isinstance(id_roleta_para_db, str) and '_' in id_roleta_para_db:
                parts = id_roleta_para_db.split('_', 1)
                if len(parts) > 1 and parts[1].isdigit():
                    id_roleta_para_db = parts[1]
                    logger.info(f"ID convertido para formato numérico: {id_roleta_para_db}")
            
        # Converter o número para inteiro
        if isinstance(numero, str):
            num_int = int(re.sub(r'[^\d]', '', numero))
        else:
            num_int = int(numero)
        
        if not (0 <= num_int <= 36):
            return False
        
        cor = cor_numero(num_int)
        ts = datetime.now().isoformat()
        
        # Interação com o banco de dados usando o ID da roleta
        if hasattr(db, 'garantir_roleta_existe'):
            db.garantir_roleta_existe(id_roleta_para_db, roleta_nome)
        if hasattr(db, 'inserir_numero'):
            db.inserir_numero(id_roleta_para_db, roleta_nome, num_int, cor, ts)
        
        # Log
        print(f"{roleta_nome}:{num_int}:{cor} (DB ID: {id_roleta_para_db})")
        
        # Notificação de eventos
        event_data = {
            "type": "new_number",
            "roleta_id": id_roleta_para_db,
            "roleta_nome": roleta_nome, 
            "numero": num_int,
            "timestamp": ts
        }
        if hasattr(event_manager, 'notify_clients'):
            event_manager.notify_clients(event_data, silent=True)
        
        # Hook personalizado
        if numero_hook:
            try:
                numero_hook(id_roleta_para_db, roleta_nome, num_int)
            except Exception as e:
                print(f"Erro ao executar hook: {str(e)}")
        
        return True
    except Exception as e:
        print(f"Erro ao processar novo número para {roleta_nome} (DB ID: {id_roleta_para_db}): {str(e)}")
        return False

def processar_numeros(db, api_table_id, roleta_nome, numeros_novos, numero_hook=None):
    """Processa números com validação para evitar duplicações falsas, mas permitindo números repetidos reais"""
    global ultimo_numero_por_roleta, ultimo_timestamp_por_roleta, assinaturas_roletas
    global historico_numeros_por_roleta, sequencias_por_roleta
    
    if not numeros_novos or len(numeros_novos) == 0:
        return False

    # Derivar o ID numérico puro (ex: "2010165") a partir do api_table_id (ex: "2_2010165")
    # Este db_roulette_id é usado para interações com RoletasDataSource via ScraperAdapter
    db_roulette_id = api_table_id
    if '_' in api_table_id:
        parts = api_table_id.split('_', 1)
        if len(parts) > 1 and parts[1].isdigit():
            db_roulette_id = parts[1]
        else:
            # Se o formato não for o esperado, logar um aviso. 
            # O db_roulette_id pode não ser reconhecido pelo RoletasDataSource.
            logger.warning(f"Formato de api_table_id inesperado: {api_table_id}. Usando como db_roulette_id.")
            db_roulette_id = api_table_id # Mantém o original se não puder extrair parte numérica

    # Verificar se db_roulette_id é numérico
    if not db_roulette_id.isdigit():
        logger.warning(f"ATENÇÃO: ID da roleta não é numérico: {db_roulette_id}. Pode causar criação de coleção UUID.")

    # Obter números recentes para validação (usando db_roulette_id)
    existentes = []
    try:
        if hasattr(db, 'obter_numeros_recentes'):
            nums = db.obter_numeros_recentes(db_roulette_id, limite=10) # Usar db_roulette_id
            existentes = [n.get('numero') for n in nums]
    except Exception as e:
        print(f"Erro ao obter números recentes para roleta {roleta_nome} (DB ID: {db_roulette_id}): {str(e)}")
    
    # Tempo mínimo entre atualizações (reduzido para permitir números repetidos mais rapidamente)
    min_tempo_entre_atualizacoes = 2  # Reduzido de 5 para 2 segundos
    tempo_atual = time.time()
    
    # Inicializar estruturas de dados para esta roleta (usando api_table_id como chave local)
    if api_table_id not in historico_numeros_por_roleta:
        historico_numeros_por_roleta[api_table_id] = []
    
    if api_table_id not in sequencias_por_roleta:
        sequencias_por_roleta[api_table_id] = []
    
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
            
            # Verificação de duplicação por assinatura (assinatura usa api_table_id)
            timestamp_arredondado = int(tempo_atual / 3) * 3
            assinatura_atual = f"{api_table_id}_{n}_{timestamp_arredondado}"
            
            # Verificar se este número já foi processado recentemente (mesmo timestamp)
            if assinatura_atual in assinaturas_roletas:
                ultimo_uso = assinaturas_roletas[assinatura_atual]
                if tempo_atual - ultimo_uso < min_tempo_entre_atualizacoes:
                    print(f"[API] Ignorando duplicação falsa para {roleta_nome}: {n}")
                    continue
            
            # Se passou pelas validações, registrar o número (passando db_roulette_id para novo_numero)
            if novo_numero(db, db_roulette_id, roleta_nome, n, numero_hook):
                # Atualizar controles locais (usando api_table_id como chave)
                ultimo_numero_por_roleta[api_table_id] = n
                ultimo_timestamp_por_roleta[api_table_id] = tempo_atual
                assinaturas_roletas[assinatura_atual] = tempo_atual
                
                # Atualizar histórico
                historico_numeros_por_roleta[api_table_id].append((n, tempo_atual))
                if len(historico_numeros_por_roleta[api_table_id]) > max_historico_por_roleta:
                    historico_numeros_por_roleta[api_table_id] = historico_numeros_por_roleta[api_table_id][-max_historico_por_roleta:]
                
                # Atualizar sequência
                sequencias_por_roleta[api_table_id] = [n] + sequencias_por_roleta.get(api_table_id, [])
                if len(sequencias_por_roleta[api_table_id]) > 5:
                    sequencias_por_roleta[api_table_id] = sequencias_por_roleta[api_table_id][:5]
                
                ok = True
                print(f"[API] Número {n} registrado para {roleta_nome} (API ID: {api_table_id}, DB ID: {db_roulette_id})")
            
        except Exception as e:
            print(f"Erro ao processar número para {roleta_nome} (API ID: {api_table_id}): {str(e)}")
    
    return ok

def scrape_roletas_api(db, numero_hook=None):
    """Função principal de scraping usando a API"""
    global ultima_atividade, erros_consecutivos
    
    print("[API] Iniciando scraping via API 888Casino")
        
    ciclo = 1
    erros = 0
    max_erros = 3
    
    # Roletas permitidas - usar variáveis de ambiente
    allowed_str = os.environ.get('ALLOWED_ROULETTES', '')
    vite_allowed_str = os.environ.get('VITE_ALLOWED_ROULETTES', '')
    
    # Tentar obter de ALLOWED_ROULETTES primeiro
    if allowed_str:
        ids_permitidos = [r.strip() for r in allowed_str.split(',') if r.strip()]
        print(f"[API] Usando variável ALLOWED_ROULETTES: {len(ids_permitidos)} roletas configuradas")
    # Caso contrário, tentar obter de VITE_ALLOWED_ROULETTES
    elif vite_allowed_str:
        ids_permitidos = [r.strip() for r in vite_allowed_str.split(',') if r.strip()]
        print(f"[API] Usando variável VITE_ALLOWED_ROULETTES: {len(ids_permitidos)} roletas configuradas")
    # Se nenhuma variável estiver definida, usar o módulo de configuração
    else:
        # Se não tiver no ambiente, usar a lista fixa do módulo roletas_permitidas
        from roletas_permitidas import ALLOWED_ROULETTES
        ids_permitidos = ALLOWED_ROULETTES
        print(f"[API] Usando lista fixa do módulo roletas_permitidas: {len(ids_permitidos)} roletas configuradas")
    
    # Debug para diagnóstico
    print(f"[API] Lista IDs permitidos: {','.join(ids_permitidos)}")
    print(f"[API] Monitorando APENAS roletas específicas: {len(ids_permitidos)} roletas")
    
    # Rastreamento de dados das mesas para detectar mudanças
    estado_anterior_mesas = {}
    
    # Intervalo entre ciclos (aumentado para evitar processamento excessivo)
    intervalo_minimo = 5  # segundos
    ultimo_ciclo_tempo = 0
    
    while ciclo <= MAX_CICLOS or MAX_CICLOS == 0:
        try:
            tempo_atual = time.time()
            
            # Verificar se passou tempo suficiente desde o último ciclo
            if tempo_atual - ultimo_ciclo_tempo < intervalo_minimo:
                time.sleep(0.5)
                continue
                
            # Registrar tempo deste ciclo
            ultimo_ciclo_tempo = tempo_atual
            
            # Buscar todas as mesas
            tables = casino_api.get_all_roulette_tables()
            print(f"[API] Ciclo {ciclo}: Encontradas {len(tables)} mesas de roleta")
            
            # Contador de atualizações
            roletas_com_numeros = 0
            roletas_permitidas_encontradas = 0
            roletas_ignoradas = 0
            
            # Processar cada mesa
            for table_id, table_info in tables.items():
                try:
                    # Obter o ID numérico da roleta para checagem de permissão.
                    # ids_permitidos deve conter IDs numéricos puros (ex: "2010165")
                    id_numerico_para_verificacao = table_id 
                    if '_' in table_id:
                        partes = table_id.split('_', 1)
                        if len(partes) > 1 and partes[1].isdigit():
                            id_numerico_para_verificacao = partes[1]
                        else:
                            # Se não for numérico após '_', ou não houver parte após '_',
                            # pode ser um formato de ID que não corresponde aos numéricos esperados.
                            logger.debug(f"[API] Formato de table_id '{table_id}' não produziu ID numérico para verificação de permissão.")
                            # Mantém table_id original para a verificação, pode ser filtrado se não estiver em ids_permitidos
                    
                    # Verificação estrita se o ID está na lista de permitidos
                    if id_numerico_para_verificacao not in ids_permitidos:
                        roletas_ignoradas += 1
                        continue
                    
                    # Se chegou aqui, a roleta está na lista de permitidos
                    roletas_permitidas_encontradas += 1
                    
                    roleta_nome = table_info['name']
                    last_numbers = table_info.get('last_numbers', [])
                    
                    # Criar uma assinatura dos dados completos desta mesa para detectar mudanças
                    mesa_atual = {
                        'id': table_id,
                        'nome': roleta_nome,
                        'numeros': last_numbers if last_numbers else [],
                        'ultimos_5_numeros': last_numbers[:5] if last_numbers else []  # Armazenar os últimos 5 números
                    }
                    
                    # Verificar se os dados são idênticos ao ciclo anterior
                    if table_id in estado_anterior_mesas:
                        numeros_anteriores = estado_anterior_mesas[table_id].get('ultimos_5_numeros', [])
                        numeros_atuais = mesa_atual['ultimos_5_numeros']
                        
                        # Se temos 5 números em ambos os casos, fazer comparação completa
                        if len(numeros_anteriores) == 5 and len(numeros_atuais) == 5:
                            # Verificar se são exatamente as mesmas sequências
                            if numeros_anteriores == numeros_atuais:
                                print(f"[API] Mesa {roleta_nome} sem alterações nos últimos 5 números: {numeros_atuais}")
                                continue
                            
                            # Verificar se a sequência mudou corretamente
                            # Os números da posição 1-4 da sequência anterior devem corresponder às posições 0-3 da nova sequência
                            sequencia_valida = True
                            for i in range(4):
                                if numeros_anteriores[i] != numeros_atuais[i+1]:
                                    sequencia_valida = False
                                    break
                            
                            if not sequencia_valida:
                                print(f"[API] Sequência inválida detectada. Anterior: {numeros_anteriores}, Atual: {numeros_atuais}")
                                continue
                    
                    # Atualizar o estado desta mesa para o próximo ciclo
                    estado_anterior_mesas[table_id] = {
                        'ultimos_5_numeros': mesa_atual['ultimos_5_numeros'],
                        'ultima_atualizacao': tempo_atual
                    }
                    
                    print(f"[API] Processando roleta permitida: {roleta_nome} (API ID: {table_id}, Numeric ID for check: {id_numerico_para_verificacao})")
                    print(f"[API] Últimos 5 números: {mesa_atual['ultimos_5_numeros']}")
                    
                    # Processar apenas se tiver números
                    if last_numbers and len(last_numbers) > 0:
                        numero_recente = last_numbers[0]
                        
                        # Verificar no banco se este número já foi registrado para esta roleta
                        # A função processar_numeros agora lida com a obtenção do db_roulette_id correto
                        numeros_banco = []
                        try:
                            if hasattr(db, 'obter_numeros_recentes'):
                                # Para esta verificação rápida, derivamos o db_id aqui também
                                temp_db_id = table_id
                                if '_' in table_id:
                                    parts = table_id.split('_', 1)
                                    if len(parts) > 1 and parts[1].isdigit():
                                        temp_db_id = parts[1]
                                numeros_banco = [n.get('numero') for n in db.obter_numeros_recentes(temp_db_id, limite=5)]
                        except Exception as e:
                            print(f"[API] Erro ao verificar números do banco (pré-processamento): {str(e)}")
                        
                        # Converter para inteiro para comparação
                        if isinstance(numero_recente, str):
                            numero_int = int(re.sub(r'[^\d]', '', numero_recente))
                        else:
                            numero_int = int(numero_recente)
                        
                        # Verificar se o número mais recente já existe no banco
                        if numeros_banco and numero_int == numeros_banco[0]:
                            print(f"[API] Número já registrado no banco: {numero_recente}")
                            continue
                        
                        print(f"[API] Novo número detectado para {roleta_nome}: {numero_recente}")
                        if processar_numeros(db, table_id, roleta_nome, [numero_recente], numero_hook):
                            roletas_com_numeros += 1
                            # O log de sucesso agora está dentro de processar_numeros
                    else:
                        print(f"[API] Mesa {roleta_nome} sem números disponíveis")
                        
                except Exception as e:
                    print(f"[API] Erro ao processar mesa {table_id}: {str(e)}")
            
            # Atualizar controles
            ultima_atividade = time.time()
            erros_consecutivos = 0
            
            # Log
            print(f"[API] Ciclo {ciclo} completo: Encontradas {len(tables)} roletas, {roletas_permitidas_encontradas} permitidas, {roletas_ignoradas} ignoradas, {roletas_com_numeros} com novos números")
            
            # Incrementar ciclo
            ciclo += 1
            
            # Aguardar para o próximo ciclo (tempo baseado na atividade)
            if roletas_com_numeros > 0:
                # Se houve novos números, verificar mais rapidamente
                time.sleep(intervalo_minimo / 2)
            else:
                # Caso contrário, aguardar o intervalo completo
                time.sleep(intervalo_minimo)
            
        except Exception as e:
            print(f"[API] Erro no ciclo {ciclo}: {str(e)}")
            erros += 1
            erros_consecutivos += 1
            
            # Pausa maior em caso de erro
            time.sleep(intervalo_minimo)
        
        if erros >= max_erros:
            print(f"[API] Muitos erros consecutivos ({erros}), reiniciando ciclo")
            erros = 0

# Funções de compatibilidade
def scrape_roletas(db, driver=None, numero_hook=None):
    """Função principal - Agora usa a versão API"""
    print("🚀 Usando scraper com API 888Casino")
    return scrape_roletas_api(db, numero_hook)

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
__all__ = ['scrape_roletas'] 