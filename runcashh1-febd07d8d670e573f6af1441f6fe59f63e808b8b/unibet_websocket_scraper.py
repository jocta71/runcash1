import websocket
import json
import time
import logging
import os
import threading
import random
import uuid
from datetime import datetime
import colorama
from colorama import Fore, Back, Style

# Inicializar colorama
colorama.init()

# Configuração de logging
logging.basicConfig(
    level=logging.DEBUG,  # Mudado para DEBUG para ver mais informações
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("unibet_scraper.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# URL do WebSocket do Unibet
WS_URL = "wss://www.unibet.com/livecasinoservice-rest-api/livecasino-websocket"

# Diretório para salvar os dados capturados
DATA_DIR = "dados_unibet"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Contador de mensagens recebidas
mensagens_recebidas = 0
numeros_capturados = 0
ultima_conexao = None
ws_instance = None
ping_thread = None
keep_running = True

# IDs para subscrição de mesas específicas
MESAS_ROLETA = [
    "roulette_TABLE-SpeedAutoRo00001@evolution",
    "roulette_vctlz20yfnmp1ylr",
    "LightningRoulette00001@evolution"
]

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

def formatar_data_hora():
    return datetime.now().strftime("%H:%M:%S")

def imprimir_mensagem_terminal(tipo, mensagem, destaque=False):
    prefixo = f"[{formatar_data_hora()}]"
    
    if destaque:
        print(f"{Fore.YELLOW}{prefixo} {Fore.CYAN}{tipo}: {Fore.WHITE}{mensagem}{Style.RESET_ALL}")
    else:
        print(f"{Fore.BLUE}{prefixo} {Fore.GREEN}{tipo}: {Fore.WHITE}{mensagem}{Style.RESET_ALL}")

def subscrever_mesas(ws):
    """Envia mensagens de subscrição para as mesas de roleta"""
    try:
        # Subscrever todas as mesas disponíveis
        for mesa_id in MESAS_ROLETA:
            cliente_id = f"cliente_{uuid.uuid4().hex[:8]}"
            mensagem_subscription = {
                "messageType": "subscribe",
                "uniqueGameId": mesa_id,
                "clientId": cliente_id,
                "timestamp": int(time.time() * 1000)
            }
            
            ws.send(json.dumps(mensagem_subscription))
            logger.info(f"Enviada subscrição para mesa: {mesa_id}")
            print(f"{Fore.CYAN}[SUBSCRIÇÃO] Registrado para receber dados da mesa: {mesa_id}{Style.RESET_ALL}")
            time.sleep(1)  # Breve pausa entre subscrições
            
        # Enviar também uma subscrição genérica para qualquer jogo
        mensagem_generica = {
            "messageType": "subscribe",
            "gameTypes": ["roulette"],
            "clientId": f"cliente_generico_{uuid.uuid4().hex[:8]}",
            "timestamp": int(time.time() * 1000)
        }
        ws.send(json.dumps(mensagem_generica))
        logger.info("Enviada subscrição genérica para jogos de roleta")
        
    except Exception as e:
        logger.error(f"Erro ao enviar subscrições: {str(e)}")

def enviar_ping():
    """Função para enviar pings periódicos para manter a conexão viva"""
    global ws_instance, keep_running
    
    ping_count = 0
    while keep_running and ws_instance:
        try:
            time.sleep(20)  # Envia ping a cada 20 segundos para evitar o timeout de 30 segundos
            if ws_instance and ws_instance.sock and ws_instance.sock.connected:
                # Alterna entre diferentes tipos de ping para tentar manter a conexão
                if ping_count % 3 == 0:
                    # Ping simples
                    ws_instance.send("ping")
                else:
                    # Ping estruturado como JSON
                    ping_json = {
                        "messageType": "ping",
                        "clientId": f"cliente_{uuid.uuid4().hex[:8]}",
                        "timestamp": int(time.time() * 1000)
                    }
                    ws_instance.send(json.dumps(ping_json))
                
                ping_count += 1
                if ping_count % 5 == 0:  # Log a cada 5 pings (aproximadamente a cada ~100 segundos)
                    print(f"{Fore.BLUE}[PING] Mantendo conexão ativa ({ping_count} pings enviados){Style.RESET_ALL}")
                    
                # A cada 30 pings (aproximadamente 10 minutos), tenta resubscrever
                if ping_count % 30 == 0:
                    print(f"{Fore.YELLOW}[RENOVAÇÃO] Renovando subscrições das mesas...{Style.RESET_ALL}")
                    subscrever_mesas(ws_instance)
                
        except Exception as e:
            logger.error(f"Erro ao enviar ping: {str(e)}")
            # Não interrompe o loop por erros de ping

def salvar_numero(dados, nome_mesa):
    """Salva os números capturados em um arquivo JSON"""
    global numeros_capturados
    
    timestamp = datetime.now().isoformat()
    arquivo = os.path.join(DATA_DIR, f"{nome_mesa}_{datetime.now().strftime('%Y%m%d')}.json")
    
    registro = {
        "timestamp": timestamp,
        "mesa": nome_mesa,
        "dados": dados
    }
    
    with open(arquivo, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro) + "\n")
    
    numeros_capturados += 1

def simular_browser():
    """Gera headers que simulam um navegador real"""
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15"
    ]
    
    return {
        "User-Agent": random.choice(user_agents),
        "Origin": "https://www.unibet.com",
        "Referer": "https://www.unibet.com/casino/live",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits"
    }

def on_message(ws, message):
    """Callback para quando uma mensagem é recebida"""
    global mensagens_recebidas, ws_instance
    
    # Atualiza a referência global ao websocket
    ws_instance = ws
    
    # Se receber um pong do servidor (resposta ao nosso ping)
    if message == "pong":
        logger.debug("Recebido pong do servidor")
        return
    
    # Registra toda mensagem recebida para debug
    logger.debug(f"Mensagem recebida: {message[:200]}...")
    
    mensagens_recebidas += 1
    if mensagens_recebidas % 100 == 0:
        logger.info(f"Recebidas {mensagens_recebidas} mensagens via WebSocket")
    
    try:
        dados = json.loads(message)
        
        # Log para ajudar a debugar o tipo de mensagem
        if "messageType" in dados:
            logger.debug(f"Tipo de mensagem: {dados['messageType']}")
        
        # Verifica se é uma resposta à subscrição
        if "messageType" in dados and dados["messageType"] == "subscriptionResponse":
            status = dados.get("status", "desconhecido")
            mesa_id = dados.get("uniqueGameId", "desconhecida")
            print(f"{Fore.CYAN}[RESPOSTA] Subscrição para mesa {mesa_id}: {status}{Style.RESET_ALL}")
            return
        
        # Verifica se é uma mensagem do tipo RouletteNumbersUpdated
        if "messageType" in dados and dados["messageType"] == "RouletteNumbersUpdated":
            mesa_id = dados.get("uniqueGameId", "desconhecida")
            mesa_nome = mesa_id.split("_")[0] if "_" in mesa_id else mesa_id
            
            numeros = dados.get("tableUpdate", {}).get("results", [])
            
            # Formata os números com cores
            numeros_formatados = [get_cor_numero(num) for num in numeros]
            
            # Exibe informações detalhadas no terminal
            print("\n" + "="*80)
            imprimir_mensagem_terminal("ROLETA", f"{mesa_nome}", destaque=True)
            imprimir_mensagem_terminal("MESA ID", f"{mesa_id}")
            imprimir_mensagem_terminal("NÚMEROS", " ".join(numeros_formatados), destaque=True)
            
            # Se houver mais informações úteis, exibe-as
            if "gameType" in dados:
                imprimir_mensagem_terminal("TIPO DE JOGO", dados["gameType"])
                
            if "dealer" in dados:
                imprimir_mensagem_terminal("DEALER", dados["dealer"])
                
            print("="*80 + "\n")
            
            # Salva em arquivo
            salvar_numero(dados, mesa_nome)
            
        # Exibe outros tipos de mensagens interessantes
        elif "messageType" in dados and dados["messageType"] in ["GameStarted", "GameEnded", "BettingClosed"]:
            mesa_id = dados.get("uniqueGameId", "desconhecida")
            print(f"\n{Fore.MAGENTA}[EVENTO] {dados['messageType']} na mesa {mesa_id}{Style.RESET_ALL}")
            
        # Se receber qualquer outro tipo de mensagem, mostra para debug
        elif "messageType" in dados:
            print(f"{Fore.MAGENTA}[MENSAGEM] Tipo: {dados['messageType']}{Style.RESET_ALL}")
            
    except json.JSONDecodeError:
        # Se não for JSON, pode ser uma resposta de ping ou outro tipo de mensagem de sistema
        logger.debug(f"Mensagem não-JSON recebida: {message[:100]}...")
    except Exception as e:
        logger.error(f"Erro ao processar mensagem: {str(e)}")

def on_error(ws, error):
    """Callback para quando ocorre um erro"""
    print(f"\n{Fore.RED}[ERRO] Conexão WebSocket: {str(error)}{Style.RESET_ALL}")
    logger.error(f"Erro WebSocket: {str(error)}")

def on_close(ws, close_status_code, close_msg):
    """Callback para quando a conexão é fechada"""
    global ultima_conexao, ws_instance
    
    # Limpa a referência ao websocket
    ws_instance = None
    
    duracao = "desconhecida"
    if ultima_conexao:
        duracao = str(datetime.now() - ultima_conexao)
    
    print(f"\n{Fore.YELLOW}[AVISO] Conexão WebSocket fechada (duração: {duracao}){Style.RESET_ALL}")
    print(f"{Fore.YELLOW}[AVISO] Tentando reconectar em 5 segundos...{Style.RESET_ALL}")
    logger.warning(f"Conexão WebSocket fechada (duração: {duracao})")
    logger.info(f"Código de status: {close_status_code}, Mensagem: {close_msg}")
    
    # Aguarda 5 segundos e tenta reconectar
    time.sleep(5)
    if keep_running:
        connect_websocket()

def on_open(ws):
    """Callback para quando a conexão é estabelecida"""
    global ultima_conexao, ws_instance, ping_thread
    
    # Armazena a referência ao websocket
    ws_instance = ws
    ultima_conexao = datetime.now()
    
    print(f"\n{Fore.GREEN}[CONECTADO] WebSocket estabelecido com sucesso{Style.RESET_ALL}")
    logger.info("Conexão WebSocket estabelecida com sucesso")
    
    # Enviar mensagens de subscrição para as mesas
    print(f"{Fore.CYAN}[SUBSCRIÇÃO] Enviando solicitações de subscrição para mesas de roleta...{Style.RESET_ALL}")
    subscrever_mesas(ws)
    
    print(f"{Fore.GREEN}[INFO] Aguardando dados da roleta...{Style.RESET_ALL}\n")
    
    # Inicia o thread de ping se ainda não estiver em execução
    if ping_thread is None or not ping_thread.is_alive():
        ping_thread = threading.Thread(target=enviar_ping)
        ping_thread.daemon = True  # O thread será encerrado quando o programa principal encerrar
        ping_thread.start()
        logger.info("Thread de ping iniciado")
    
    # Envia um ping inicial logo após a conexão
    try:
        ws.send("ping")
        logger.debug("Ping inicial enviado")
    except Exception as e:
        logger.error(f"Erro ao enviar ping inicial: {str(e)}")

def connect_websocket():
    """Estabelece conexão com o WebSocket"""
    print(f"\n{Fore.CYAN}[CONEXÃO] Tentando conectar ao WebSocket: {WS_URL}{Style.RESET_ALL}")
    logger.info(f"Tentando conectar ao WebSocket: {WS_URL}")
    
    # Habilita trace para debug
    websocket.enableTrace(True)
    
    # Headers para simular um navegador real
    headers = simular_browser()
    
    # Cria a conexão WebSocket
    ws = websocket.WebSocketApp(
        WS_URL,
        header=headers,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Inicia a conexão em modo de bloqueio
    ws.run_forever(ping_interval=25, ping_timeout=20)  # Configura o ping interno da biblioteca

if __name__ == "__main__":
    print(f"\n{Fore.CYAN}{'='*30} UNIBET WEBSOCKET SCRAPER {'='*30}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}Desenvolvido para capturar dados da roleta do Unibet em tempo real{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'='*80}{Style.RESET_ALL}\n")
    
    logger.info("Iniciando scraper WebSocket para Unibet...")
    try:
        connect_websocket()
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}[AVISO] Scraper interrompido pelo usuário{Style.RESET_ALL}")
        keep_running = False  # Sinaliza para o thread de ping parar
        logger.info("Scraper interrompido pelo usuário")
    except Exception as e:
        print(f"\n{Fore.RED}[ERRO CRÍTICO] {str(e)}{Style.RESET_ALL}")
        keep_running = False  # Sinaliza para o thread de ping parar
        logger.critical(f"Erro crítico: {str(e)}") 