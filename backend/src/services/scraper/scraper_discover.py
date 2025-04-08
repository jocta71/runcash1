#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para descobrir a API GetLiveTables monitorando TODAS as requisições
"""

import json
import asyncio
from playwright.async_api import async_playwright
import time
from datetime import datetime
import re

# URL do cassino
CASINO_URL = "https://es.888casino.com/"
API_PATTERN = re.compile(r'live|table|casino|config', re.IGNORECASE)

async def discover_api():
    """Monitora todas as requisições para encontrar a API de dados das mesas"""
    print(f"\n{'='*80}")
    print(f" DESCOBERTA DE APIS DO CASINO ".center(80, "="))
    print(f" Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "="))
    print(f"{'='*80}\n")
    
    async with async_playwright() as p:
        # Configuração avançada do navegador para maior chance de sucesso
        browser = await p.chromium.launch(
            headless=False,  # Visível para depuração
            slow_mo=50       # Mais lento para simular usuário real
        )
        
        # Contexto com viewport maior e User-Agent realista
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # Ativar JavaScript
        page = await context.new_page()
        
        # Coletar todas as requisições relevantes
        api_requests = []
        
        # Capturar todas as requisições
        async def log_request(request):
            if API_PATTERN.search(request.url):
                print(f"[REQUEST] {request.method} {request.url}")
        
        # Capturar todas as respostas
        async def log_response(response):
            if API_PATTERN.search(response.url):
                request = response.request
                status = response.status
                print(f"[RESPONSE] {status} {request.method} {response.url}")
                
                # Se for uma resposta bem-sucedida, tenta processar como JSON
                if status == 200:
                    try:
                        data = await response.json()
                        # Verificar se parece com dados de mesa de jogo
                        is_table_data = False
                        
                        # Verificar vários padrões que podem indicar dados de mesa
                        if isinstance(data, dict):
                            keywords = ['table', 'live', 'game', 'roulette', 'dealer']
                            for key in data.keys():
                                if any(kw.lower() in key.lower() for kw in keywords):
                                    is_table_data = True
                                    break
                            
                            # Verificar valores também
                            if not is_table_data and isinstance(data, dict):
                                json_str = json.dumps(data).lower()
                                if any(kw.lower() in json_str for kw in ['roulette', 'dealer', 'table']):
                                    is_table_data = True
                        
                        if is_table_data:
                            print(f"[POSSÍVEL API DE MESAS ENCONTRADA] {response.url}")
                            api_requests.append({
                                'url': response.url,
                                'method': request.method,
                                'headers': dict(request.headers),
                                'data_sample': json.dumps(data)[:200] + '...' if len(json.dumps(data)) > 200 else json.dumps(data)
                            })
                    except:
                        # Não é JSON ou houve erro ao processar
                        pass
        
        # Registrar os handlers
        page.on('request', log_request)
        page.on('response', log_response)
        
        # Navegar para o cassino
        print(f"[INFO] Navegando para {CASINO_URL}")
        try:
            await page.goto(CASINO_URL, wait_until='networkidle')
            print("[INFO] Página inicial carregada")
            
            # Tentar encontrar e clicar em qualquer link relacionado a casino ao vivo
            live_casino_links = await page.get_by_role('link').filter(has_text=re.compile(r'live|casino|roulette', re.IGNORECASE)).all()
            
            if live_casino_links:
                print(f"[INFO] Encontrado {len(live_casino_links)} links relevantes")
                for i, link in enumerate(live_casino_links[:3]):  # Tentar até 3 links
                    try:
                        print(f"[INFO] Clicando no link {i+1}")
                        await link.click()
                        await page.wait_for_load_state('networkidle')
                        print(f"[INFO] Aguardando após clicar no link {i+1}...")
                        await asyncio.sleep(10)
                    except Exception as e:
                        print(f"[AVISO] Não foi possível clicar no link {i+1}: {str(e)}")
            else:
                print("[INFO] Nenhum link relevante encontrado na página inicial")
                
            # Aguardar mais tempo para capturar requisições adicionais
            print("[INFO] Aguardando 30 segundos para capturar mais requisições...")
            await asyncio.sleep(30)
            
        except Exception as e:
            print(f"[ERRO] Falha ao navegar: {str(e)}")
        
        # Resumo das APIs encontradas
        print("\n" + "="*80)
        print(" RESUMO DAS APIS ENCONTRADAS ".center(80, "="))
        print("="*80)
        
        if api_requests:
            for i, req in enumerate(api_requests):
                print(f"\n[API #{i+1}] {req['method']} {req['url']}")
                print(f"Headers: {json.dumps(req['headers'], indent=2)}")
                print(f"Amostra de dados: {req['data_sample']}")
        else:
            print("\nNenhuma API relevante foi encontrada.")
            
        # Fechar o navegador
        await browser.close()
        print("\n[INFO] Navegador fechado")

if __name__ == "__main__":
    # Executar o script
    asyncio.run(discover_api()) 