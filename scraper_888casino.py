#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Scraper para capturar dados de roletas do 888Casino
usando o formato exato de requisição capturado
"""

import requests
import json
import uuid
from datetime import datetime
from urllib.parse import quote

# URL exata da API
API_URL = "https://cgp.safe-iplay.com/cgpapi/liveFeed/GetLiveTables"

def scrape_roulette_data():
    """Captura dados das roletas usando a API GetLiveTables com o formato exato da requisição"""
    print(f"\n{'='*80}")
    print(f" SCRAPER DE ROLETAS - 888CASINO ".center(80, "="))
    print(f" Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "="))
    print(f"{'='*80}\n")
    
    # Headers exatos conforme capturados
    headers = {
        'sec-ch-ua-platform': '"Windows"',
        'referer': 'https://es.888casino.com/live-casino/#filters=live-roulette',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
        'content-type': 'application/x-www-form-urlencoded',
        'sec-ch-ua-mobile': '?0',
        'accept': '*/*',
        'origin': 'https://es.888casino.com'
    }
    
    # Gerar um UUID para o clientRequestId
    client_request_id = str(uuid.uuid4())
    
    # Montar o clientProperties como JSON
    client_properties = {
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
    
    # Converter para string JSON e codificar para URL
    client_properties_encoded = quote(json.dumps(client_properties))
    
    # Montar o corpo da requisição exatamente como capturado
    payload = f"regulationID=2&lang=spa&clientRequestId={client_request_id}&clientProperties={client_properties_encoded}&CGP_DomainOrigin=https%3A%2F%2Fes.888casino.com&CGP_State=live-casino%2F%23filters%3Dlive-roulette&CGP_Skin=888casino&CGP_SkinOverride=es&CGP_Country=USA&CGP_UseCountryAsState=false"
    
    try:
        print(f"[INFO] Enviando requisição POST para {API_URL}")
        print(f"[INFO] Client Request ID: {client_request_id}")
        
        response = requests.post(API_URL, headers=headers, data=payload, timeout=15)
        
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
                        table_name = table_info.get('Name', '')
                        if 'Roulette' in table_name or 'Ruleta' in table_name:
                            roulette_table = {
                                'id': table_info.get('GameID', 'N/A'),
                                'name': table_name,
                                'dealer': table_info.get('Dealer', 'N/A'),
                                'is_open': table_info.get('IsOpen', False),
                                'players': table_info.get('Players', 0),
                                'last_numbers': table_info.get('RouletteLast5Numbers', [])
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
                        output_data = {
                            'timestamp': datetime.now().isoformat(),
                            'tables': roulette_tables
                        }
                        
                        with open('roulette_data_final.json', 'w', encoding='utf-8') as f:
                            json.dump(output_data, f, indent=2)
                        print(f"\n[INFO] Dados salvos em roulette_data_final.json")
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