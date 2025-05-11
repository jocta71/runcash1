import websocket
import json
import time
import logging
import os
import threading
import uuid
import base64
import random
import requests
from datetime import datetime
import colorama
from colorama import Fore, Back, Style
from tabulate import tabulate

# Inicializar colorama
colorama.init()

# Configuração de logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("unibet_stomp.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# URL do WebSocket do Unibet
WS_URL = "wss://www.unibet.com/livecasinoservice-rest-api/livecasino-websocket"

# Constantes STOMP
STOMP_VERSIONS = ["v10.stomp", "v11.stomp", "v12.stomp"]
STOMP_CONNECT_FRAME = """CONNECT
accept-version:1.0,1.1,1.2
heart-beat:10000,10000

\x00"""

# Formato de subscrição conforme visto nos logs do cliente
STOMP_SUBSCRIBE_FRAME = """SUBSCRIBE
id:{subscription_id}
uniqueGameIds:{mesa_id}
brand:unibet
jurisdiction:MT
locale:en_GB
deviceGroup:desktop
destination:/user/queue/subscriptions/{subscription_id}/gameEvents

\x00"""

# Brand da página (parâmetro obrigatório)
BRAND = "unibet"
# Jurisdição (parâmetro obrigatório) - Malta
JURISDICTION = "MT"
# Localização (parâmetro obrigatório) - Inglês Reino Unido
LOCALE = "en_GB"
# Grupo de dispositivo
DEVICE_GROUP = "desktop"

# Arquivo com a lista de mesas
GAME_LIST_FILE = "gamelist.json"

# Diretório para salvar os dados capturados
DATA_DIR = "dados_unibet_stomp"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Variáveis globais
ws_instance = None
ping_thread = None
keep_running = True
cookies = {}
cookie_jar = None
session_id = None
subscriptions = {}  # Armazena IDs de subscrição ativos

# Armazenamento global de dados de mesas
tabela_mesas = {}
info_mesas = {}  # Informações detalhadas das mesas do JSON

# Cores para diferentes números na roleta
def get_cor_numero(numero):
    if numero == "0":
        return Back.GREEN + Fore.WHITE + numero + Style.RESET_ALL
    
    # Números vermelhos na roleta europeia
    numeros_vermelhos = ["1", "3", "5", "7", "9", "12", "14", "16", "18", "19", "21", "23", "25", "27", "30", "32", "34", "36"]
    if numero in numeros_vermelhos:
        return Back.RED + Fore.WHITE + numero + Style.RESET_ALL
    else:
        return Back.BLACK + Fore.WHITE + numero + Style.RESET_ALL

def carregar_lista_mesas():
    """Carrega a lista de mesas de roleta do arquivo JSON"""
    global MESAS_ROLETA, info_mesas
    
    try:
        if os.path.exists(GAME_LIST_FILE):
            with open(GAME_LIST_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            MESAS_ROLETA = []
            info_mesas = {}
            
            # Extrai todas as mesas de roleta, independente de estarem abertas ou não
            for game in data.get("gameList", []):
                if "liveCasino" in game and game["liveCasino"].get("gameType") == "roulette":
                    game_id = game["gameId"]
                    # Adiciona todas as mesas de roleta, não apenas as abertas
                    MESAS_ROLETA.append(game_id)
                    
                    # Identifica o fornecedor pela string no ID
                    fornecedor = "evolution" if "@evolution" in game_id else "pragmatic" if "@pragmatic" in game_id else "stakelogic" if "@stakelogic" in game_id else "outro"
                    
                    # Armazena informações detalhadas da mesa
                    info_mesas[game_id] = {
                        "nome": game["liveCasino"].get("gameName", ""),
                        "imagem": game["liveCasino"].get("tableImage", ""),
                        "aberta": game["liveCasino"].get("open", False),
                        "dealer": game["liveCasino"].get("dealer", {}).get("name", "Auto"),
                        "jogadores": game["liveCasino"].get("players", 0),
                        "min_aposta": game["liveCasino"].get("betLimit", {}).get("min", 0),
                        "max_aposta": game["liveCasino"].get("betLimit", {}).get("max", 0),
                        "moeda": game["liveCasino"].get("betLimit", {}).get("symbol", "€"),
                        "fornecedor": fornecedor
                    }
            
            print(f"{Fore.GREEN}[INFO] Carregadas {len(MESAS_ROLETA)} mesas de roleta do arquivo JSON{Style.RESET_ALL}")
            
            # Mostrar quantas mesas por fornecedor
            fornecedores = {}
            for mesa_id in MESAS_ROLETA:
                fornecedor = info_mesas[mesa_id]['fornecedor']
                fornecedores[fornecedor] = fornecedores.get(fornecedor, 0) + 1
            
            for fornecedor, contagem in fornecedores.items():
                print(f"{Fore.CYAN}[INFO] Fornecedor {fornecedor}: {contagem} mesas{Style.RESET_ALL}")
                
            return True
        else:
            # Lista padrão de mesas caso o arquivo não exista
            MESAS_ROLETA = [
                # Evolution
                "roulette_TABLE-LightningTable01@evolution",
                "roulette_TABLE-XxxtremeLigh0001@evolution",
                "roulette_TABLE-7x0b1tgh7agmf6hv@evolution",
                "roulette_TABLE-48z5pjps3ntvqc1b@evolution",
                "roulette_TABLE-vctlz20yfnmp1ylr@evolution",
                "roulette_TABLE-InstantRo0000001@evolution",
                "roulette_TABLE-pphrgptjgstmjhmg@evolution",
                "reddoorroulette_TABLE-RedDoorRoulette1@evolution",
                
                # Pragmatic
                "226a7@pragmatic",
                "205a11@pragmatic",
                "210a57@pragmatic",
                "225a7@pragmatic",
                "227@pragmatic",
                "230@pragmatic",
                "206@pragmatic",
                "203@pragmatic",
                "204@pragmatic",
                "240@pragmatic",
                "270@pragmatic"
            ]
            print(f"{Fore.YELLOW}[AVISO] Arquivo {GAME_LIST_FILE} não encontrado. Usando lista padrão de mesas.{Style.RESET_ALL}")
            return False
    except Exception as e:
        logger.error(f"Erro ao carregar lista de mesas: {str(e)}")
        print(f"{Fore.RED}[ERRO] Falha ao carregar lista de mesas: {str(e)}{Style.RESET_ALL}")
        
        # Lista padrão de mesas em caso de erro
        MESAS_ROLETA = [
            "roulette_TABLE-LightningTable01@evolution",
            "227@pragmatic"
        ]
        return False

def formatar_data_hora():
    return datetime.now().strftime("%H:%M:%S")

def imprimir_mensagem_terminal(tipo, mensagem, destaque=False):
    prefixo = f"[{formatar_data_hora()}]"
    
    if destaque:
        print(f"{Fore.YELLOW}{prefixo} {Fore.CYAN}{tipo}: {Fore.WHITE}{mensagem}{Style.RESET_ALL}")
    else:
        print(f"{Fore.BLUE}{prefixo} {Fore.GREEN}{tipo}: {Fore.WHITE}{mensagem}{Style.RESET_ALL}")

def obter_cookies():
    """Obtém cookies de autenticação simulando uma visita ao site"""
    global cookies, cookie_jar
    
    print(f"{Fore.CYAN}[AUTH] Obtendo cookies de autenticação...{Style.RESET_ALL}")
    
    # Cria uma sessão para manter cookies
    session = requests.Session()
    
    # Headers que simulam um navegador real
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Cache-Control": "no-cache"
    }
    
    try:
        # Visita a página principal
        response = session.get("https://www.unibet.com/", headers=headers, timeout=15)
        
        # Visita a página do casino para garantir todos os cookies
        response = session.get("https://www.unibet.com/casino/live", headers=headers, timeout=15)
        
        # Guarda os cookies
        cookies = session.cookies.get_dict()
        cookie_jar = session.cookies
        
        # Monta a string de cookies para o header
        cookie_str = "; ".join([f"{k}={v}" for k, v in cookies.items()])
        
        print(f"{Fore.GREEN}[AUTH] Cookies obtidos com sucesso{Style.RESET_ALL}")
        logger.info(f"Cookies obtidos: {cookie_str[:100]}...")
        
        return cookie_str
    except Exception as e:
        logger.error(f"Erro ao obter cookies: {str(e)}")
        print(f"{Fore.RED}[ERRO] Falha ao obter cookies: {str(e)}{Style.RESET_ALL}")
        return ""

def salvar_dados(dados, tipo, nome_mesa):
    """Salva os dados capturados em um arquivo JSON"""
    timestamp = datetime.now().isoformat()
    arquivo = os.path.join(DATA_DIR, f"{nome_mesa}_{datetime.now().strftime('%Y%m%d')}.json")
    
    registro = {
        "timestamp": timestamp,
        "mesa": nome_mesa,
        "tipo": tipo,
        "dados": dados
    }
    
    with open(arquivo, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro) + "\n")

def enviar_frame_stomp(ws, frame):
    """Envia um frame STOMP para o servidor"""
    # Substitui o caractere nulo por sua representação de string para o log
    frame_log = frame.replace(chr(0), '\\x00')
    logger.debug(f"Enviando frame STOMP: {frame_log}")
    ws.send(frame, websocket.ABNF.OPCODE_TEXT)

def enviar_heartbeat(ws):
    """Envia um heartbeat STOMP"""
    ws.send(chr(10), websocket.ABNF.OPCODE_TEXT)  # ASCII newline char (10) como heartbeat

def stomp_connect(ws):
    """Estabelece uma conexão STOMP"""
    print(f"{Fore.CYAN}[STOMP] Conectando com protocolo STOMP...{Style.RESET_ALL}")
    
    # Adicionando os parâmetros brand, jurisdiction e locale ao frame CONNECT
    connect_frame = STOMP_CONNECT_FRAME.replace("\n\n\x00", f"\nbrand:{BRAND}\njurisdiction:{JURISDICTION}\nlocale:{LOCALE}\ndeviceGroup:{DEVICE_GROUP}\n\n\x00")
    enviar_frame_stomp(ws, connect_frame)

def stomp_subscribe(ws, mesa_id):
    """Subscreve em uma mesa específica usando o formato correto do Unibet"""
    global subscriptions
    
    # Gera um ID de subscrição único
    subscription_id = str(uuid.uuid4())[:36]
    
    # Formata o frame de subscrição
    frame = STOMP_SUBSCRIBE_FRAME.format(
        subscription_id=subscription_id,
        mesa_id=mesa_id
    )
    
    # Armazena o ID de subscrição mapeado para a mesa
    subscriptions[subscription_id] = mesa_id
    
    # Obtém o nome da mesa do dicionário de informações, se disponível
    nome_mesa = info_mesas.get(mesa_id, {}).get("nome", mesa_id)
    print(f"{Fore.CYAN}[STOMP] Subscrevendo em mesa: {nome_mesa} (ID: {subscription_id[:8]}...){Style.RESET_ALL}")
    enviar_frame_stomp(ws, frame)
    
    # Logo após a subscrição, envia uma mensagem de "SEND" para iniciar a transmissão
    # Este passo pode ser necessário, pois o Unibet pode precisar de uma solicitação para
    # começar a enviar dados para essa subscrição
    send_frame = f"""SEND
destination:/app/game/{mesa_id}/join
content-type:application/json;charset=utf-8
brand:{BRAND}
jurisdiction:{JURISDICTION}
locale:{LOCALE}
deviceGroup:{DEVICE_GROUP}

{{"clientId":"cliente_{uuid.uuid4().hex[:8]}","brand":"{BRAND}","jurisdiction":"{JURISDICTION}","locale":"{LOCALE}","deviceGroup":"{DEVICE_GROUP}"}}
\x00"""
    
    # Envia o frame após pequena pausa
    time.sleep(0.1)
    enviar_frame_stomp(ws, send_frame)
    
    return subscription_id

def imprimir_tabela_roletas():
    """Imprime uma tabela formatada com os dados de todas as mesas de roleta"""
    global tabela_mesas
    
    # Verifica se há dados para exibir
    if not tabela_mesas:
        print(f"{Fore.YELLOW}[INFO] Nenhum dado de mesa disponível ainda{Style.RESET_ALL}")
        return
    
    try:
        # Prepara os dados para tabulate
        headers = ["Mesa", "Dealer", "Último", "Histórico (10)", "Jogadores", "Limites", "Status"]
        
        # Agrupa as mesas por fornecedor
        fornecedores = {}
        for mesa_id, dados in tabela_mesas.items():
            fornecedor = dados.get('fornecedor', 'desconhecido')
            if fornecedor not in fornecedores:
                fornecedores[fornecedor] = []
            fornecedores[fornecedor].append(mesa_id)
        
        print("\n" + "="*120)
        print(f"{Fore.CYAN}MONITORAMENTO DE ROLETAS UNIBET - {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}{Style.RESET_ALL}")
        
        # Total de mesas
        total_mesas = len(tabela_mesas)
        print(f"{Fore.CYAN}Total de {total_mesas} mesas monitoradas{Style.RESET_ALL}")
        
        # Para cada fornecedor, imprime um bloco de mesas
        for fornecedor in sorted(fornecedores.keys()):
            mesas_ids = sorted(fornecedores[fornecedor])
            
            if not mesas_ids:
                continue
                
            # Exibe o cabeçalho do fornecedor
            print(f"\n{Fore.YELLOW}== {fornecedor.upper()} ({len(mesas_ids)} mesas) =={Style.RESET_ALL}")
            
            table_data = []
            for mesa_id in mesas_ids:
                try:
                    dados = tabela_mesas[mesa_id]
                    info = info_mesas.get(mesa_id, {})
                    
                    # Obtém os dados formatados - garantindo que tudo seja string
                    dealer = str(dados.get('dealer', 'Auto'))
                    ultimo = str(dados.get('ultimo', '-'))
                    historico = dados.get('historico', [])
                    jogadores = str(dados.get('jogadores', 0))
                    
                    # Informações adicionais do JSON
                    nome_mesa = str(info.get("nome", "") or mesa_id.split("@")[0])
                    min_aposta = str(info.get("min_aposta", "-"))
                    max_aposta = str(info.get("max_aposta", "-"))
                    moeda = str(info.get("moeda", "€"))
                    
                    # Status da mesa (aberta/fechada)
                    status_texto = "ABERTA" if info.get("aberta", True) else "FECHADA"
                    status = Fore.GREEN + status_texto + Style.RESET_ALL if info.get("aberta", True) else Fore.RED + status_texto + Style.RESET_ALL
                    
                    # Formata os limites
                    limites = f"{moeda}{min_aposta} - {moeda}{max_aposta}"
                    
                    # Formata os números com cores - garantindo que sejam strings
                    historico_formatado = "-"
                    if historico:
                        historico_str = [str(num) for num in historico[:10]]
                        historico_formatado = " ".join([get_cor_numero(num) for num in historico_str])
                        
                    # Nome simplificado da mesa
                    nome_exibicao = str(nome_mesa).replace("roulette_TABLE-", "").replace("_TABLE-", "")
                    
                    # Formata o último número
                    ultimo_formatado = get_cor_numero(ultimo) if ultimo != '-' else '-'
                    
                    # Adiciona à tabela, garantindo que todos os elementos sejam strings
                    table_data.append([
                        nome_exibicao,
                        dealer,
                        ultimo_formatado,
                        historico_formatado,
                        jogadores,
                        limites,
                        status
                    ])
                except Exception as e:
                    logger.error(f"Erro ao formatar dados da mesa {mesa_id}: {str(e)}")
                    # Adiciona uma linha com erro para não interromper a exibição
                    table_data.append([
                        str(mesa_id),
                        "ERRO",
                        "-",
                        f"Falha: {str(e)}",
                        "-",
                        "-",
                        Fore.RED + "ERRO" + Style.RESET_ALL
                    ])
            
            try:
                # Imprime a tabela para este fornecedor
                print(tabulate(table_data, headers=headers, tablefmt="grid"))
            except Exception as e:
                logger.error(f"Erro ao gerar tabela para fornecedor {fornecedor}: {str(e)}")
                print(f"{Fore.RED}[ERRO] Não foi possível exibir tabela para {fornecedor}: {str(e)}{Style.RESET_ALL}")
        
        print("="*120 + "\n")
    except Exception as e:
        logger.error(f"Erro ao imprimir tabela de roletas: {str(e)}")
        print(f"{Fore.RED}[ERRO] Falha ao exibir tabela: {str(e)}{Style.RESET_ALL}")

def heartbeat_thread():
    """Thread para enviar heartbeats periódicos"""
    global ws_instance, keep_running
    
    heartbeat_count = 0
    while keep_running and ws_instance:
        try:
            time.sleep(9)  # Heartbeat a cada 9 segundos (mais rápido que os 10s negociados)
            if ws_instance and ws_instance.sock and ws_instance.sock.connected:
                enviar_heartbeat(ws_instance)
                heartbeat_count += 1
                
                # A cada 30 segundos (aproximadamente), atualiza a tabela
                if heartbeat_count % 3 == 0:
                    imprimir_tabela_roletas()
        except Exception as e:
            logger.error(f"Erro ao enviar heartbeat: {str(e)}")

def processar_frame_stomp(message):
    """Processa um frame STOMP recebido para extrair cabeçalhos e corpo"""
    try:
        # Divide a mensagem em linhas
        lines = message.split('\n')
        
        # A primeira linha é o comando
        command = lines[0]
        
        # Extrai os cabeçalhos
        headers = {}
        i = 1
        while i < len(lines) and lines[i]:
            if ':' in lines[i]:
                key, value = lines[i].split(':', 1)
                headers[key] = value
            i += 1
            
        # O corpo começa após a linha em branco
        body_start = i + 1
        
        # Junta as linhas restantes como corpo, removendo o caractere nulo no final
        if body_start < len(lines):
            body = '\n'.join(lines[body_start:])
            if body.endswith(chr(0)):
                body = body[:-1]
                
            # Tenta converter o corpo para JSON
            try:
                body_json = json.loads(body)
                logger.debug(f"Frame STOMP processado: Comando={command}, Corpo JSON válido, tamanho={len(body)}")
                return command, headers, body_json
            except json.JSONDecodeError as e:
                logger.warning(f"Falha ao decodificar JSON: {str(e)}, tentando processar conteúdo como string")
                # Corpo não é JSON válido - pode ser array JSON com [ ] ou outra estrutura
                if body.startswith('[') and body.endswith(']'):
                    try:
                        body_json = json.loads(body)
                        logger.debug(f"Frame STOMP processado: Comando={command}, Corpo Array JSON válido")
                        return command, headers, body_json
                    except:
                        # Se falhar, retorna como string
                        return command, headers, body
                else:
                    return command, headers, body
        
        logger.debug(f"Frame STOMP processado: Comando={command}, Sem corpo")
        return command, headers, None
    except Exception as e:
        logger.error(f"Erro ao processar frame STOMP: {str(e)}")
        logger.error(f"Conteúdo da mensagem: {message[:100]}...")
        return None, None, None

def on_message(ws, message):
    """Callback para quando uma mensagem é recebida"""
    global ws_instance, session_id, subscriptions, tabela_mesas
    
    # Atualiza a referência global ao websocket
    ws_instance = ws
    
    # Se for mensagem de heartbeat (apenas LF - Line Feed)
    if message == chr(10):
        logger.debug("Recebido heartbeat")
        return
        
    # Exibe a mensagem completa no log, substituindo caracteres nulos
    log_message = message.replace(chr(0), '\\x00')
    logger.debug(f"Mensagem recebida: {log_message}")
    
    # Se começar com CONNECTED, é a resposta da conexão STOMP
    if message.startswith("CONNECTED"):
        comando, headers, _ = processar_frame_stomp(message)
        
        # Verifica se temos user-name (formato do Unibet) ou session-id
        if "user-name" in headers:
            session_id = headers["user-name"]
            print(f"{Fore.GREEN}[STOMP] Conectado com user-name: {session_id}{Style.RESET_ALL}")
            
            # Após conectado, subscreve em todas as mesas de roleta
            print(f"{Fore.CYAN}[STOMP] Iniciando subscrição em {len(MESAS_ROLETA)} mesas...{Style.RESET_ALL}")
            for mesa_id in MESAS_ROLETA:
                stomp_subscribe(ws, mesa_id)
                time.sleep(0.2)  # Pequeno delay entre subscrições
        elif "session-id" in headers:
            session_id = headers["session-id"]
            print(f"{Fore.GREEN}[STOMP] Conectado com session-id: {session_id}{Style.RESET_ALL}")
            
            # Após conectado, subscreve em todas as mesas de roleta
            print(f"{Fore.CYAN}[STOMP] Iniciando subscrição em {len(MESAS_ROLETA)} mesas...{Style.RESET_ALL}")
            for mesa_id in MESAS_ROLETA:
                stomp_subscribe(ws, mesa_id)
                time.sleep(0.2)  # Pequeno delay entre subscrições
        else:
            print(f"{Fore.GREEN}[STOMP] Conectado, mas sem identificador de sessão{Style.RESET_ALL}")
            print(f"{Fore.CYAN}Headers da resposta: {headers}{Style.RESET_ALL}")
            
            # Mesmo sem identificador, tenta subscrever
            print(f"{Fore.CYAN}[STOMP] Iniciando subscrição em {len(MESAS_ROLETA)} mesas...{Style.RESET_ALL}")
            for mesa_id in MESAS_ROLETA:
                stomp_subscribe(ws, mesa_id)
                time.sleep(0.2)  # Pequeno delay entre subscrições
        return
        
    # Se começar com MESSAGE, é uma mensagem STOMP com dados
    if message.startswith("MESSAGE"):
        comando, headers, dados = processar_frame_stomp(message)
        
        # Verificação adicional para array de mensagens
        if isinstance(dados, list):
            # Processa cada item da lista individualmente
            logger.debug(f"Recebido array de mensagens com {len(dados)} itens")
            for item in dados:
                processar_mensagem_individual(headers, item)
            return
            
        # Para mensagens individuais
        if not dados or not isinstance(dados, dict):
            logger.warning(f"Dados inválidos recebidos: {type(dados)}")
            return
            
        processar_mensagem_individual(headers, dados)

def processar_mensagem_individual(headers, dados):
    """Processa uma mensagem individual"""
    global tabela_mesas, subscriptions
    
    if not isinstance(dados, dict) or "uniqueGameId" not in dados:
        logger.warning(f"Mensagem sem uniqueGameId: {str(dados)}")
        return
    
    # Obtém os detalhes da subscrição
    subscription_id = headers.get("subscription", "")
    # Se tivermos o uniqueGameId na mensagem, usamos ele diretamente
    mesa_id = dados.get("uniqueGameId", subscriptions.get(subscription_id, "desconhecida"))
    
    # Atualiza o mapeamento de subscrição se necessário
    if subscription_id and mesa_id != "desconhecida" and subscription_id not in subscriptions:
        logger.info(f"Adicionando mapeamento: {subscription_id} -> {mesa_id}")
        subscriptions[subscription_id] = mesa_id
    
    # Obtém a origem da mesa (Evolution ou Pragmatic)
    fornecedor = "evolution" if "@evolution" in mesa_id else "pragmatic" if "@pragmatic" in mesa_id else "stakelogic" if "@stakelogic" in mesa_id else "outro"
    mesa_nome = mesa_id.split("@")[0] if "@" in mesa_id else mesa_id
    
    # Informações do JSON (se disponíveis)
    info = info_mesas.get(mesa_id, {})
    nome_exibicao = info.get("nome", "") or mesa_nome
    
    # Inicializa a entrada da mesa se não existir
    if mesa_id not in tabela_mesas:
        logger.info(f"Criando nova entrada para mesa: {mesa_id} (Fornecedor: {fornecedor})")
        tabela_mesas[mesa_id] = {
            'fornecedor': fornecedor,
            'nome': nome_exibicao,
            'historico': [],
            'jogadores': info.get("jogadores", 0),
            'ultimo': '-',
            'dealer': info.get("dealer", "Auto")
        }
    
    # Processa os diferentes tipos de mensagem
    message_type = dados.get("messageType", "")
    
    # Mensagem de inicialização
    if message_type == "INIT":
        table_update = dados.get("tableUpdate", {})
        
        # Atualiza informações básicas
        if "results" in table_update:
            tabela_mesas[mesa_id]['historico'] = table_update["results"]
            if table_update["results"]:
                tabela_mesas[mesa_id]['ultimo'] = table_update["results"][0]
                
        # Atualiza dealer
        if "dealer" in table_update and isinstance(table_update["dealer"], dict) and "name" in table_update["dealer"]:
            tabela_mesas[mesa_id]['dealer'] = table_update["dealer"]["name"]
        elif "dealer" in table_update and isinstance(table_update["dealer"], str):
            tabela_mesas[mesa_id]['dealer'] = table_update["dealer"]
            
        # Atualiza jogadores
        if "players" in table_update:
            tabela_mesas[mesa_id]['jogadores'] = table_update["players"]
            
        # Salva dados
        salvar_dados(dados, "init", mesa_nome)
        
        # Para debug, mostra o fornecedor e mesa_id inicializados
        logger.debug(f"Mesa {mesa_id} inicializada, fornecedor: {fornecedor}")
        
        # Atualiza a tabela
        imprimir_tabela_roletas()
        
    elif message_type == "RouletteNumbersUpdated":
        numeros = dados.get("tableUpdate", {}).get("results", [])
        
        if numeros:
            tabela_mesas[mesa_id]['historico'] = numeros
            tabela_mesas[mesa_id]['ultimo'] = numeros[0]
            
            # Lucky numbers para Lightning Roulette
            if "luckyNumbers" in dados.get("tableUpdate", {}):
                lucky_numbers = dados.get("tableUpdate", {}).get("luckyNumbers", [])
                if lucky_numbers:
                    tabela_mesas[mesa_id]['lucky_numbers'] = lucky_numbers
        
        # Salva dados
        salvar_dados(dados, "roleta", mesa_nome)
        
        # Atualiza a tabela
        imprimir_tabela_roletas()
        
    elif message_type == "PlayersUpdated":
        players = dados.get("tableUpdate", {}).get("players", 0)
        tabela_mesas[mesa_id]['jogadores'] = players
        
        # Salva dados
        salvar_dados(dados, "jogadores", mesa_nome)
        
        # Em atualizações de jogadores, não imprimimos a tabela completa para evitar flood
        logger.info(f"Mesa {nome_exibicao}: {players} jogadores ativos")
        
    # Outros tipos de mensagens
    elif message_type:
        # Salva outros tipos de mensagens para análise
        salvar_dados(dados, message_type, mesa_nome)
        logger.info(f"Evento {message_type} na mesa {nome_exibicao}")
    else:
        # Se não tem messageType, tenta extrair informações úteis
        logger.warning(f"Mensagem sem messageType para mesa {nome_exibicao}: {str(dados)[:100]}...")

def on_error(ws, error):
    """Callback para quando ocorre um erro"""
    print(f"\n{Fore.RED}[ERRO] WebSocket: {str(error)}{Style.RESET_ALL}")
    logger.error(f"Erro WebSocket: {str(error)}")

def on_close(ws, close_status_code, close_msg):
    """Callback para quando a conexão é fechada"""
    global ws_instance
    
    # Limpa a referência ao websocket
    ws_instance = None
    
    print(f"\n{Fore.YELLOW}[AVISO] Conexão WebSocket fechada{Style.RESET_ALL}")
    print(f"{Fore.YELLOW}[AVISO] Tentando reconectar em 5 segundos...{Style.RESET_ALL}")
    logger.warning(f"Conexão WebSocket fechada")
    logger.info(f"Código de status: {close_status_code}, Mensagem: {close_msg}")
    
    # Aguarda 5 segundos e tenta reconectar
    time.sleep(5)
    if keep_running:
        connect_websocket()

def on_open(ws):
    """Callback para quando a conexão é estabelecida"""
    global ws_instance, ping_thread
    
    # Armazena a referência ao websocket
    ws_instance = ws
    
    print(f"\n{Fore.GREEN}[CONECTADO] WebSocket estabelecido com sucesso{Style.RESET_ALL}")
    logger.info("Conexão WebSocket estabelecida com sucesso")
    
    # Inicia o thread de heartbeat
    heartbeat = threading.Thread(target=heartbeat_thread)
    heartbeat.daemon = True
    heartbeat.start()
    
    # Inicia a conexão STOMP
    stomp_connect(ws)

def connect_websocket():
    """Estabelece conexão com o WebSocket"""
    print(f"\n{Fore.CYAN}[CONEXÃO] Tentando conectar ao WebSocket: {WS_URL}{Style.RESET_ALL}")
    logger.info(f"Tentando conectar ao WebSocket: {WS_URL}")
    
    # Obtém cookies frescos
    cookie_str = obter_cookies()
    
    # Prepara os headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "Sec-WebSocket-Protocol": ",".join(STOMP_VERSIONS),
        "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits",
        "Origin": "https://www.unibet.com",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7",
        "Cache-Control": "no-cache"
    }
    
    # Adiciona os cookies se disponíveis
    if cookie_str:
        headers["Cookie"] = cookie_str
    
    # Cria a conexão WebSocket
    ws = websocket.WebSocketApp(
        WS_URL,
        header=headers,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Limpa qualquer dados anteriores da tabela para evitar problemas com fornecedores
    tabela_mesas.clear()
    
    # Inicia a conexão em modo de bloqueio
    ws.run_forever(ping_interval=0)  # Desativa o ping interno do websocket, usando heartbeats STOMP

if __name__ == "__main__":
    print(f"\n{Fore.CYAN}{'='*30} UNIBET STOMP SCRAPER {'='*30}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}Desenvolvido para capturar dados da roleta do Unibet em tempo real{Style.RESET_ALL}")
    print(f"{Fore.CYAN}Usando protocolo STOMP para comunicação WebSocket{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'='*80}{Style.RESET_ALL}\n")
    
    # Carrega a lista de mesas do JSON
    carregar_lista_mesas()
    
    # Inicia a conexão
    logger.info("Iniciando scraper STOMP para Unibet...")
    try:
        connect_websocket()
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}[AVISO] Scraper interrompido pelo usuário{Style.RESET_ALL}")
        keep_running = False
        logger.info("Scraper interrompido pelo usuário")
    except Exception as e:
        print(f"\n{Fore.RED}[ERRO CRÍTICO] {str(e)}{Style.RESET_ALL}")
        keep_running = False
        logger.critical(f"Erro crítico: {str(e)}") 