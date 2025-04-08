#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scraper usando Playwright para interceptar a API GetLiveTables
"""

import json
import asyncio
from playwright.async_api import async_playwright
import time
from datetime import datetime

# URL do cassino
CASINO_URL = "https://es.888casino.com/"
TARGET_API = "GetLiveTables"

async def monitor_api():
    """Usa Playwright para monitorar a API GetLiveTables e capturar os dados exatos"""
    print(f"\n{'='*80}")
    print(f" MONITORAMENTO DA API GetLiveTables ".center(80, "="))
    print(f" Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "="))
    print(f"{'='*80}\n")
    
    async with async_playwright() as p:
        # Navegador visível para depuração
        browser = await p.chromium.launch(headless=False)
        
        # Contexto com viewport maior e User-Agent realista
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
        )
        
        # Criar nova página
        page = await context.new_page()
        
        # Armazenar detalhes da requisição e resposta
        api_request_details = None
        api_response_data = None
        
        # Interceptar requisições para a API
        async def handle_request(request):
            nonlocal api_request_details
            
            if TARGET_API in request.url:
                print(f"[CAPTURADO] Requisição para {request.url}")
                
                # Capturar detalhes completos
                try:
                    post_data = request.post_data
                    headers = request.headers
                    
                    api_request_details = {
                        'url': request.url,
                        'method': request.method,
                        'headers': dict(headers),
                        'post_data': post_data
                    }
                    
                    print(f"[INFO] Dados POST capturados: {post_data}")
                except Exception as e:
                    print(f"[ERRO] Falha ao capturar dados da requisição: {str(e)}")
        
        # Interceptar respostas da API
        async def handle_response(response):
            nonlocal api_response_data
            
            if TARGET_API in response.url:
                print(f"[CAPTURADO] Resposta de {response.url} (Status: {response.status})")
                
                # Capturar os dados da resposta
                if response.status == 200:
                    try:
                        data = await response.json()
                        api_response_data = data
                        
                        # Verificar dados de roleta
                        if 'LiveTables' in data:
                            roulette_tables = []
                            
                            for table_id, table_info in data['LiveTables'].items():
                                if 'Name' in table_info and 'Roulette' in table_info.get('Name', ''):
                                    table_data = {
                                        'id': table_info.get('GameID', 'N/A'),
                                        'name': table_info.get('Name', 'N/A'),
                                        'last_numbers': table_info.get('RouletteLastNumbers', [])
                                    }
                                    roulette_tables.append(table_data)
                            
                            if roulette_tables:
                                print(f"[INFO] Encontradas {len(roulette_tables)} mesas de roleta")
                                
                                # Mostrar alguns exemplos
                                for i, table in enumerate(roulette_tables[:3]):  # Mostrar até 3 mesas
                                    print(f"\n- Mesa: {table['name']}")
                                    print(f"  ID: {table['id']}")
                                    print(f"  Últimos números: {', '.join(table['last_numbers']) if table['last_numbers'] else 'Nenhum'}")
                                
                                if len(roulette_tables) > 3:
                                    print(f"... e mais {len(roulette_tables) - 3} mesas")
                    except Exception as e:
                        print(f"[ERRO] Falha ao processar resposta: {str(e)}")
        
        # Registrar os manipuladores
        page.on('request', handle_request)
        page.on('response', handle_response)
        
        # Navegar para o site
        print(f"[INFO] Navegando para {CASINO_URL}")
        try:
            await page.goto(CASINO_URL)
            print("[INFO] Página carregada. Aguardando 60 segundos para capturar requisições...")
            
            # Clicar em links relevantes para acionar a API
            try:
                print("[INFO] Procurando links para o casino ao vivo...")
                links = await page.get_by_role('link').filter(has_text=re.compile(r'live|casino|roulette', re.IGNORECASE)).all()
                
                if links:
                    for i, link in enumerate(links[:2]):  # Tentar os primeiros 2 links
                        try:
                            print(f"[INFO] Clicando no link {i+1}...")
                            await link.click()
                            await page.wait_for_load_state('networkidle')
                            await asyncio.sleep(15)  # Esperar requisições após o clique
                            
                            if api_response_data:
                                print("[INFO] Dados capturados! Interrompendo navegação.")
                                break
                        except Exception as e:
                            print(f"[AVISO] Erro ao clicar no link {i+1}: {str(e)}")
            except Exception as e:
                print(f"[AVISO] Erro ao buscar links: {str(e)}")
                
            # Esperar um tempo para que requisições ocorram
            for i in range(60):
                if api_response_data:
                    print("[INFO] Dados capturados com sucesso!")
                    break
                await asyncio.sleep(1)
                if i % 10 == 0:
                    print(f"[INFO] Ainda aguardando... ({i}/60s)")
        
        except Exception as e:
            print(f"[ERRO] Falha na navegação: {str(e)}")
        
        # Salvar os dados capturados
        if api_request_details:
            print("\n[INFO] Detalhes da requisição capturados:")
            print(f"URL: {api_request_details['url']}")
            print(f"Método: {api_request_details['method']}")
            print(f"Dados POST: {api_request_details['post_data']}")
            
            # Salvar em arquivo
            with open('api_request_details.json', 'w') as f:
                json.dump(api_request_details, f, indent=2)
            print("[INFO] Detalhes da requisição salvos em api_request_details.json")
        
        if api_response_data:
            # Salvar dados da resposta
            with open('api_response_data.json', 'w') as f:
                json.dump(api_response_data, f, indent=2)
            print("[INFO] Dados da resposta salvos em api_response_data.json")
        
        # Fechar navegador
        await browser.close()
        print("[INFO] Navegador fechado")

if __name__ == "__main__":
    import re  # Importar regex aqui para evitar erro
    
    # Executar o monitoramento
    asyncio.run(monitor_api()) 