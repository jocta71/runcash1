#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scraper para capturar dados das roletas usando a API exata
"""

import requests
import json
from datetime import datetime

# Detalhes exatos da API
API_URL = "https://cgp.safe-iplay.com/cgpapi/liveFeed/GetLiveTables"

def scrape_roulette_data():
    """Captura dados das roletas usando a API GetLiveTables"""
    print(f"\n{'='*80}")
    print(f" CAPTURA DE DADOS DAS ROLETAS - 888CASINO ".center(80, "="))
    print(f" Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "="))
    print(f"{'='*80}\n")
    
    # Headers exatos conforme observado no DevTools
    headers = {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://es.888casino.com',
        'referer': 'https://es.888casino.com/',
        'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    }
    
    # O corpo da requisição POST - este é um exemplo, deve ser ajustado conforme necessário
    # Como não temos o corpo exato, este é um placeholder que deve ser observado nas próximas requisições
    data = {
        'clientId': '888casino-spain-prod',
        'deviceType': 'Desktop',
        'locale': 'es-ES',
        'currency': 'EUR',
        'timestamp': int(datetime.now().timestamp() * 1000),
    }
    
    try:
        print(f"[INFO] Enviando requisição POST para {API_URL}")
        response = requests.post(API_URL, headers=headers, data=data, timeout=15)
        
        if response.status_code == 200:
            print(f"[SUCESSO] API respondeu com status 200")
            
            try:
                result = response.json()
                
                # Verificar se temos os dados das mesas
                if 'LiveTables' in result:
                    roulette_tables = []
                    
                    # Processar cada mesa
                    for table_id, table_info in result['LiveTables'].items():
                        # Filtrar apenas mesas de roleta
                        if 'Name' in table_info and 'Roulette' in table_info.get('Name', ''):
                            roulette_table = {
                                'id': table_info.get('GameID', 'N/A'),
                                'name': table_info.get('Name', 'N/A'),
                                'dealer': table_info.get('Dealer', 'N/A'),
                                'is_open': table_info.get('IsOpen', False),
                                'players': table_info.get('Players', 0),
                                'last_numbers': table_info.get('RouletteLastNumbers', [])
                            }
                            roulette_tables.append(roulette_table)
                    
                    # Mostrar resultados
                    if roulette_tables:
                        print(f"\n[INFO] Encontradas {len(roulette_tables)} mesas de roleta:")
                        
                        for i, table in enumerate(roulette_tables):
                            print(f"\n--- Mesa #{i+1} ---")
                            print(f"ID: {table['id']}")
                            print(f"Nome: {table['name']}")
                            print(f"Dealer: {table['dealer']}")
                            print(f"Aberta: {'Sim' if table['is_open'] else 'Não'}")
                            print(f"Jogadores: {table['players']}")
                            print(f"Últimos números: {', '.join(table['last_numbers']) if table['last_numbers'] else 'Nenhum número disponível'}")
                        
                        # Salvar dados em arquivo JSON para uso futuro
                        with open('roulette_data.json', 'w', encoding='utf-8') as f:
                            json.dump({'timestamp': datetime.now().isoformat(), 'tables': roulette_tables}, f, indent=2)
                        print(f"\n[INFO] Dados salvos em roulette_data.json")
                    else:
                        print("[AVISO] Nenhuma mesa de roleta encontrada nos dados")
                else:
                    print("[ERRO] Formato de resposta inesperado. Resposta completa:")
                    print(json.dumps(result, indent=2)[:500] + "..." if len(json.dumps(result, indent=2)) > 500 else json.dumps(result, indent=2))
            
            except ValueError:
                print("[ERRO] Resposta não é um JSON válido:")
                print(response.text[:200] + "..." if len(response.text) > 200 else response.text)
        else:
            print(f"[ERRO] Falha na requisição. Status: {response.status_code}")
            print(f"Resposta: {response.text[:200]}..." if len(response.text) > 200 else response.text)
    
    except Exception as e:
        print(f"[ERRO] Exceção ao fazer requisição: {str(e)}")

if __name__ == "__main__":
    # Executar o scraper
    scrape_roulette_data() 