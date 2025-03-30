#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para executar o scraper em modo real com integração de análise de estratégia
"""

import sys
import time
import logging
import json
import requests
import traceback
from datetime import datetime

# Configurar logging para mostrar mais informações
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # Ensure logs go to stdout for Railway
    ]
)
logger = logging.getLogger(__name__)

# Imports locais - reorganizados para evitar importação circular
try:
    from data_source_mongo import MongoDataSource
    from strategy_analyzer import StrategyAnalyzer
    from strategy_helper import atualizar_estrategia
    # Import scraper_mongodb later to avoid circular imports
    logger.info("✅ Módulos básicos importados com sucesso")
except Exception as e:
    logger.error(f"❌ Erro ao importar módulos básicos: {str(e)}")
    traceback.print_exc()
    sys.exit(1)

# Dicionário global para armazenar instâncias de analisadores de estratégia
_strategy_analyzers = {}

# Configuração do WebSocket - ajustar conforme necessário
# Esta URL deve apontar para o servidor WebSocket que você implantou
WEBSOCKET_SERVER_URL = "http://localhost:5000/emit-event"  # URL local com protocolo http://

# Log da configuração
logger.info(f"🔌 WebSocket configurado para: {WEBSOCKET_SERVER_URL}")

def notify_websocket(event_type, data):
    """
    Envia um evento para o servidor WebSocket
    """
    try:
        payload = {
            "event": event_type,
            "data": data
        }
        
        logger.info(f"\n[WebSocket] Enviando evento {event_type}:")
        logger.info(json.dumps(data, indent=2, ensure_ascii=False))
        
        response = requests.post(WEBSOCKET_SERVER_URL, json=payload)
        
        if response.status_code == 200:
            logger.info(f"[WebSocket] ✅ Evento {event_type} enviado com sucesso")
        else:
            logger.error(f"[WebSocket] ❌ Falha ao enviar evento: {response.status_code} - {response.text}")
    
    except Exception as e:
        logger.error(f"[WebSocket] ❌ Erro ao notificar WebSocket: {str(e)}")
        traceback.print_exc()

def get_analyzer(roleta_id, roleta_nome):
    """
    Obtém ou cria uma instância do analisador de estratégia para uma roleta
    """
    global _strategy_analyzers
    
    # Criar chave global única para esta roleta
    key = f"{roleta_id}:{roleta_nome}"
    
    # Se já existe um analisador para esta roleta, retorná-lo
    if key in _strategy_analyzers:
        return _strategy_analyzers[key]
    
    # Caso contrário, criar uma nova instância
    try:
        logger.info(f"\n[Estratégia] 🎲 Criando novo analisador para roleta: {roleta_nome}")
        analyzer = StrategyAnalyzer(table_name=roleta_nome)
        _strategy_analyzers[key] = analyzer
        return analyzer
    except Exception as e:
        logger.error(f"[Estratégia] ❌ Erro ao criar analisador: {str(e)}")
        return None

def generate_display_suggestion(estado, terminais):
    """
    Gera uma sugestão de exibição baseada no estado da estratégia
    """
    if estado == "NEUTRAL":
        return "AGUARDANDO GATILHO"
    elif estado == "TRIGGER" and terminais:
        return f"APOSTAR EM: {','.join(map(str, terminais))}"
    elif estado == "POST_GALE_NEUTRAL" and terminais:
        return f"GALE EM: {','.join(map(str, terminais))}"
    elif estado == "MORTO":
        return "AGUARDANDO PRÓXIMO CICLO"
    
    return ""

def process_new_number(db, roleta_id, roleta_nome, numero):
    """
    Processa um novo número com o analisador de estratégia e atualiza no MongoDB
    """
    logger.info(f"\n{'='*50}")
    logger.info(f"🎲 NOVO NÚMERO DETECTADO")
    logger.info(f"📍 Roleta: {roleta_nome}")
    logger.info(f"🔢 Número: {numero}")
    logger.info(f"{'='*50}")
    
    try:
        # Obter o analisador para esta roleta
        analyzer = get_analyzer(roleta_id, roleta_nome)
        
        if not analyzer:
            logger.error(f"❌ Não foi possível obter analisador para roleta {roleta_nome}")
            return None
        
        # Adicionar o novo número
        analyzer.add_number(numero)
        
        # Obter o status atual da estratégia
        data = analyzer.get_data()
        estrategia = data.get("estrategia", {})
        
        # Atualizar no MongoDB
        logger.info(f"\n[MongoDB] 💾 Atualizando estratégia para roleta {roleta_nome}")
        
        atualizar_estrategia(
            roleta_id=roleta_id,
            roleta_nome=roleta_nome,
            estado=estrategia.get("estado", "NEUTRAL"),
            numero_gatilho=estrategia.get("numero_gatilho", -1),
            terminais_gatilho=estrategia.get("terminais_gatilho", []),
            vitorias=estrategia.get("vitorias", 0),
            derrotas=estrategia.get("derrotas", 0)
        )
        
        # Notificar o WebSocket sobre o novo número
        event_data = {
            "roleta_id": roleta_id,
            "roleta_nome": roleta_nome,
            "numero": numero,
            "timestamp": datetime.now().isoformat()
        }
        notify_websocket("new_number", event_data)
        
        # Notificar o WebSocket sobre a atualização da estratégia
        strategy_data = {
            "roleta_id": roleta_id,
            "roleta_nome": roleta_nome,
            "estado": estrategia.get("estado", "NEUTRAL"),
            "numero_gatilho": estrategia.get("numero_gatilho", -1),
            "terminais_gatilho": estrategia.get("terminais_gatilho", []),
            "vitorias": estrategia.get("vitorias", 0),
            "derrotas": estrategia.get("derrotas", 0),
            "display_suggestion": generate_display_suggestion(
                estrategia.get("estado", "NEUTRAL"),
                estrategia.get("terminais_gatilho", [])
            ),
            "timestamp": datetime.now().isoformat()
        }
        notify_websocket("strategy_update", strategy_data)
        
        # Mostrar resumo da estratégia
        logger.info(f"\n[Estratégia] 📊 Status Atual:")
        logger.info(f"Estado: {estrategia.get('estado', 'NEUTRAL')}")
        logger.info(f"Vitórias: {estrategia.get('vitorias', 0)}")
        logger.info(f"Derrotas: {estrategia.get('derrotas', 0)}")
        if estrategia.get('terminais_gatilho'):
            logger.info(f"Terminais: {estrategia.get('terminais_gatilho', [])}")
        logger.info(f"{'='*50}\n")
        
        return estrategia
    
    except Exception as e:
        logger.error(f"❌ Erro ao processar número {numero} para roleta {roleta_nome}: {str(e)}")
        traceback.print_exc()
        return None

def main():
    """
    Função principal para executar o scraper em modo real
    """
    logger.info("\n🚀 Iniciando scraper REAL com integração de análise de estratégia...")
    
    try:
        # Inicializar fonte de dados MongoDB
        logger.info("Conectando ao MongoDB...")
        db = MongoDataSource()
        logger.info("✅ Conexão ao MongoDB estabelecida com sucesso")
        
        # Importar scraper_mongodb aqui para evitar importação circular
        try:
            from scraper_mongodb import scrape_roletas
            logger.info("✅ Módulo scraper_mongodb importado com sucesso")
        except Exception as e:
            logger.error(f"❌ Erro ao importar scraper_mongodb: {str(e)}")
            traceback.print_exc()
            return 1
        
        # Hook para processar números da roleta
        def numero_hook(roleta_id, roleta_nome, numero):
            """
            Hook chamado quando um novo número é detectado pelo scraper
            """
            # Processar o número com o analisador de estratégia
            logger.info(f"📍 Processando número {numero} para roleta {roleta_nome}")
            status = process_new_number(db, roleta_id, roleta_nome, numero)
            
            if not status:
                logger.error(f"❌ Falha ao processar número {numero} para estratégia")
        
        logger.info("\n🎰 Executando em modo REAL - Acessando site da casa de apostas")
        
        # Executar o scraper real com o hook
        scrape_roletas(db, numero_hook=numero_hook)
        
        return 0
        
    except Exception as e:
        logger.error(f"❌ Erro ao executar scraper: {str(e)}")
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    try:
        logger.info("🏁 Iniciando script run_real_scraper.py")
        sys.exit(main())
    except Exception as e:
        logger.critical(f"💥 Erro crítico não tratado: {str(e)}")
        traceback.print_exc()
        sys.exit(1)