#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Teste de captura direta da API GetLiveTables usando requests
"""

import requests
import json
from datetime import datetime

# URLs e headers - ajuste conforme observado no DevTools
API_URL = "https://livecasinoapi.888casino.com/config/LiveTables"  # Este é um exemplo, ajuste conforme necessário
 
def capture_direct():
    """Tenta acessar diretamente a API GetLiveTables"""
    print(f"\n{'='*80}")
    print(f" TESTE DE ACESSO DIRETO À API GetLiveTables ".center(80, "="))
    print(f" Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "="))
    print(f"{'='*80}\n")
    
    # Headers simulando um navegador - estes devem ser ajustados com base na observação real
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://es.888casino.com/',
        'Origin': 'https://es.888casino.com',
        'Connection': 'keep-alive',
    }
    
    try:
        print(f"[INFO] Tentando acessar: {API_URL}")
        response = requests.get(API_URL, headers=headers, timeout=10)
        
        if response.status_code == 200:
            print(f"[SUCESSO] API respondeu com status 200")
            try:
                data = response.json()
                
                # Extrair dados relevantes
                if 'LiveTables' in data:
                    print("\n[RESULTADO] Roletas encontradas:")
                    
                    for table_id, table_info in data['LiveTables'].items():
                        if 'Name' in table_info and 'Roulette' in table_info['Name']:
                            game_id = table_info.get('GameID', 'N/A')
                            table_name = table_info.get('Name', 'N/A')
                            last_numbers = table_info.get('RouletteLastNumbers', [])
                            
                            print(f"\n- ID: {game_id}")
                            print(f"  Mesa: {table_name}")
                            print(f"  Últimos números: {', '.join(last_numbers) if last_numbers else 'Nenhum número disponível'}")
                else:
                    print("[AVISO] Formato de resposta inesperado. Resposta completa:")
                    print(json.dumps(data, indent=2))
            
            except ValueError:
                print("[ERRO] Resposta não é um JSON válido:")
                print(response.text[:200] + "..." if len(response.text) > 200 else response.text)
        else:
            print(f"[ERRO] Falha na requisição. Status: {response.status_code}")
            print(f"Resposta: {response.text[:200]}..." if len(response.text) > 200 else response.text)
    
    except requests.exceptions.RequestException as e:
        print(f"[ERRO] Exceção ao fazer requisição: {str(e)}")

if __name__ == "__main__":
    # Executar o teste
    capture_direct() 