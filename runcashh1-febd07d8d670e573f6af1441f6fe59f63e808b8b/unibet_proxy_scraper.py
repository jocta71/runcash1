import asyncio
import json
import logging
import os
from datetime import datetime
from playwright.async_api import async_playwright
import colorama
from colorama import Fore, Back, Style

# Inicializar colorama
colorama.init()

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("unibet_proxy.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Diretório para salvar os dados capturados
DATA_DIR = "dados_unibet_proxy"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# URL da roleta ao vivo do Unibet
TARGET_URL = "https://www.unibet.com/casino/live"

# Contadores
mensagens_capturadas = 0
numeros_capturados = 0

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

def salvar_dados(dados, tipo):
    """Salva os dados capturados em arquivos JSON"""
    global numeros_capturados
    
    timestamp = datetime.now().isoformat()
    arquivo = os.path.join(DATA_DIR, f"{tipo}_{datetime.now().strftime('%Y%m%d')}.json")
    
    registro = {
        "timestamp": timestamp,
        "tipo": tipo,
        "dados": dados
    }
    
    with open(arquivo, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro) + "\n")
    
    numeros_capturados += 1
    if numeros_capturados % 10 == 0:
        logger.info(f"Total de {numeros_capturados} eventos capturados")

async def processar_mensagem(message):
    """Processa as mensagens WebSocket capturadas"""
    global mensagens_capturadas
    
    if not message or message.get("type") != "message":
        return
    
    # Incrementa contador de mensagens
    mensagens_capturadas += 1
    if mensagens_capturadas % 100 == 0:
        logger.info(f"Mensagens processadas: {mensagens_capturadas}")
    
    try:
        # Tenta converter o payload para JSON
        if not message.get("payload"):
            return
        
        payload = json.loads(message["payload"])
        
        # Verifica se é uma mensagem relacionada à roleta
        if "messageType" in payload:
            message_type = payload["messageType"]
            
            # Captura atualizações de números da roleta
            if message_type == "RouletteNumbersUpdated":
                mesa_id = payload.get("uniqueGameId", "desconhecida")
                mesa_nome = mesa_id.split("_")[0] if "_" in mesa_id else mesa_id
                
                numeros = payload.get("tableUpdate", {}).get("results", [])
                
                # Formata os números com cores
                numeros_formatados = [get_cor_numero(num) for num in numeros]
                
                # Exibe informações detalhadas no terminal
                print("\n" + "="*80)
                imprimir_mensagem_terminal("ROLETA", f"{mesa_nome}", destaque=True)
                imprimir_mensagem_terminal("MESA ID", f"{mesa_id}")
                imprimir_mensagem_terminal("NÚMEROS", " ".join(numeros_formatados), destaque=True)
                
                # Se houver mais informações úteis, exibe-as
                if "gameType" in payload:
                    imprimir_mensagem_terminal("TIPO DE JOGO", payload["gameType"])
                    
                if "dealer" in payload:
                    imprimir_mensagem_terminal("DEALER", payload["dealer"])
                    
                print("="*80 + "\n")
                
                # Salva em arquivo
                salvar_dados(payload, "roleta_" + mesa_nome)
            
            # Outros tipos de mensagens interessantes
            elif message_type in ["GameStarted", "GameEnded", "BettingClosed"]:
                mesa_id = payload.get("uniqueGameId", "desconhecida")
                print(f"\n{Fore.MAGENTA}[EVENTO] {message_type} na mesa {mesa_id}{Style.RESET_ALL}")
                salvar_dados(payload, message_type)
            
    except json.JSONDecodeError:
        pass
    except Exception as e:
        logger.error(f"Erro ao processar mensagem: {str(e)}")

async def capturar_websocket():
    """Usa o Playwright para capturar tráfego WebSocket"""
    print(f"\n{Fore.CYAN}[INICIALIZAÇÃO] Iniciando captura de WebSocket com Playwright{Style.RESET_ALL}")
    logger.info("Iniciando captura de WebSocket com Playwright")
    
    async with async_playwright() as p:
        # Inicia o navegador em modo headless
        print(f"{Fore.CYAN}[BROWSER] Iniciando navegador headless Chrome{Style.RESET_ALL}")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        # Configure o logger para o tráfego da rede
        print(f"{Fore.CYAN}[REDE] Configurando captura de tráfego{Style.RESET_ALL}")
        logger.info("Configurando captura de tráfego de rede...")
        
        # Crie uma página e prepare para capturar eventos WebSocket
        page = await context.new_page()
        
        # Configura evento para capturar tráfego WebSocket
        page.on("websocket", lambda ws: print(f"{Fore.GREEN}[WEBSOCKET] Conexão detectada: {ws.url}{Style.RESET_ALL}"))
        
        # Monitorar tráfego CDP
        client = await context.new_cdp_session(page)
        await client.send("Network.enable")
        
        client.on("Network.webSocketFrameReceived", 
                 lambda params: asyncio.create_task(
                     processar_mensagem({
                         "type": "message", 
                         "payload": params.get("response", {}).get("payloadData")
                     })
                 ))
        
        # Navega para o site alvo
        print(f"{Fore.YELLOW}[NAVEGAÇÃO] Acessando {TARGET_URL}{Style.RESET_ALL}")
        logger.info(f"Navegando para: {TARGET_URL}")
        await page.goto(TARGET_URL)
        
        print(f"{Fore.GREEN}[PÁGINA] Site carregado, monitorando WebSockets{Style.RESET_ALL}")
        logger.info("Página carregada, começando a capturar dados...")
        
        # Espera na página para capturar tráfego WebSocket
        try:
            # Tenta encontrar e clicar no botão de roleta ao vivo, se existir
            print(f"{Fore.YELLOW}[NAVEGAÇÃO] Tentando localizar seção de roleta ao vivo...{Style.RESET_ALL}")
            roulette_button = await page.wait_for_selector("text=Roleta ao Vivo", timeout=10000)
            if roulette_button:
                await roulette_button.click()
                print(f"{Fore.GREEN}[NAVEGAÇÃO] Navegou para a seção de roleta ao vivo{Style.RESET_ALL}")
                logger.info("Navegou para a seção de roleta ao vivo")
        except Exception as e:
            print(f"{Fore.YELLOW}[AVISO] Não conseguiu navegar automaticamente para roleta: {e}{Style.RESET_ALL}")
            logger.warning(f"Não conseguiu navegar automaticamente para roleta: {e}")
        
        # Mantém o browser aberto para continuar capturando dados
        try:
            print(f"\n{Fore.GREEN}[CAPTURA] Monitorando comunicações WebSocket por 1 hora{Style.RESET_ALL}")
            print(f"{Fore.GREEN}[CAPTURA] Aguardando dados da roleta...{Style.RESET_ALL}\n")
            # Aguarda indefinidamente (ou até ser interrompido)
            await asyncio.sleep(3600)  # 1 hora
        except asyncio.CancelledError:
            print(f"\n{Fore.YELLOW}[AVISO] Captura interrompida pelo usuário{Style.RESET_ALL}")
            logger.info("Captura interrompida pelo usuário")
        finally:
            await browser.close()
            print(f"\n{Fore.YELLOW}[ENCERRAMENTO] Navegador fechado{Style.RESET_ALL}")
            logger.info("Navegador fechado")

async def main():
    """Função principal"""
    print(f"\n{Fore.CYAN}{'='*30} UNIBET PROXY SCRAPER {'='*30}{Style.RESET_ALL}")
    print(f"{Fore.CYAN}Desenvolvido para capturar dados da roleta do Unibet via navegador{Style.RESET_ALL}")
    print(f"{Fore.CYAN}{'='*80}{Style.RESET_ALL}\n")
    
    logger.info("Iniciando scraper de proxy para Unibet...")
    
    try:
        await capturar_websocket()
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}[AVISO] Scraper interrompido pelo usuário{Style.RESET_ALL}")
        logger.info("Scraper interrompido pelo usuário")
    except Exception as e:
        print(f"\n{Fore.RED}[ERRO CRÍTICO] {str(e)}{Style.RESET_ALL}")
        logger.critical(f"Erro crítico: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main()) 