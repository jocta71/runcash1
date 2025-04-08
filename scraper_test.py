#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Teste de captura de dados da API GetLiveTables
"""

import json
import asyncio
from playwright.async_api import async_playwright
import time
from datetime import datetime

# URL do cassino - ajuste conforme necessário
CASINO_URL = "https://es.888casino.com/"
TARGET_API = "GetLiveTables"

async def capture_live_tables_data():
    """Captura dados da API GetLiveTables usando Playwright"""
    print(f"\n{'='*80}")
    print(f" TESTE DE CAPTURA DE DADOS DA API GetLiveTables ".center(80, "="))
    print(f" Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "="))
    print(f"{'='*80}\n")
    
    async with async_playwright() as p:
        # Lançar navegador
        print("[INFO] Iniciando navegador...")
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        # Habilitar log de rede para capturar requisições
        page = await context.new_page()
        
        # Lista para armazenar dados capturados
        captured_data = []
        
        # Função para interceptar a resposta da API GetLiveTables
        async def handle_response(response):
            if TARGET_API in response.url:
                try:
                    print(f"[INFO] Detectada resposta da API: {response.url}")
                    data = await response.json()
                    captured_data.append(data)
                    print("[INFO] Dados capturados com sucesso!")
                except Exception as e:
                    print(f"[ERRO] Falha ao processar resposta: {str(e)}")
        
        # Registrar handler para capturar respostas
        page.on("response", handle_response)
        
        # Navegar para a página do cassino
        print(f"[INFO] Navegando para {CASINO_URL}...")
        await page.goto(CASINO_URL)
        print("[INFO] Página carregada")
        
        # Esperar tempo suficiente para as requisições ocorrerem
        print("[INFO] Aguardando carregamento de dados (15s)...")
        await asyncio.sleep(15)  # Ajuste este tempo conforme necessário
        
        # Analisar e extrair dados relevantes
        if captured_data:
            print("\n[RESULTADO] Dados extraídos da API GetLiveTables:")
            for data in captured_data:
                if 'LiveTables' in data:
                    for table_id, table_info in data['LiveTables'].items():
                        if 'Name' in table_info and 'Roulette' in table_info['Name']:
                            game_id = table_info.get('GameID', 'N/A')
                            table_name = table_info.get('Name', 'N/A')
                            last_numbers = table_info.get('RouletteLastNumbers', [])
                            
                            print(f"\n- ID: {game_id}")
                            print(f"  Mesa: {table_name}")
                            print(f"  Últimos números: {', '.join(last_numbers)}")
        else:
            print("[AVISO] Nenhum dado foi capturado. Verifique a URL ou aumente o tempo de espera.")
        
        # Fechar navegador
        await browser.close()
        print("\n[INFO] Navegador fechado")

if __name__ == "__main__":
    # Executar o teste
    asyncio.run(capture_live_tables_data()) 