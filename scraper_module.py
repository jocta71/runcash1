#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Módulo para capturar dados das roletas do 888Casino
Versão: 1.0
"""

import requests
import json
import uuid
import logging
from datetime import datetime
from urllib.parse import quote
import time

class Casino888Scraper:
    """
    Scraper para capturar dados de roletas do 888Casino usando a API GetLiveTables
    """
    
    def __init__(self, log_level=logging.INFO):
        """Inicializa o scraper com configurações padrão"""
        # Configurar logging
        self.logger = logging.getLogger('casino888_scraper')
        self.logger.setLevel(log_level)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - [SCRAPER] - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
        
        # URL da API
        self.api_url = "https://cgp.safe-iplay.com/cgpapi/liveFeed/GetLiveTables"
        
        # Headers padrão
        self.headers = {
            'sec-ch-ua-platform': '"Windows"',
            'referer': 'https://es.888casino.com/live-casino/#filters=live-roulette',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
            'content-type': 'application/x-www-form-urlencoded',
            'sec-ch-ua-mobile': '?0',
            'accept': '*/*',
            'origin': 'https://es.888casino.com'
        }
        
        # Configurações padrão para o payload
        self.client_properties = {
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
    
    def get_roulette_data(self, save_to_file=None, only_with_numbers=False):
        """
        Captura os dados das roletas
        
        Argumentos:
            save_to_file (str): Caminho do arquivo para salvar os dados em JSON (opcional)
            only_with_numbers (bool): Se True, retorna apenas roletas que têm números disponíveis
            
        Retorna:
            dict: Dados das roletas ou None em caso de erro
        """
        try:
            # Gerar UUID para o clientRequestId
            client_request_id = str(uuid.uuid4())
            
            # Codificar os client_properties para URL
            client_properties_encoded = quote(json.dumps(self.client_properties))
            
            # Montar o payload
            payload = f"regulationID=2&lang=spa&clientRequestId={client_request_id}&clientProperties={client_properties_encoded}&CGP_DomainOrigin=https%3A%2F%2Fes.888casino.com&CGP_State=live-casino%2F%23filters%3Dlive-roulette&CGP_Skin=888casino&CGP_SkinOverride=es&CGP_Country=USA&CGP_UseCountryAsState=false"
            
            self.logger.info(f"Enviando requisição para {self.api_url}")
            
            # Fazer a requisição
            response = requests.post(self.api_url, headers=self.headers, data=payload, timeout=15)
            
            if response.status_code == 200:
                self.logger.info("Requisição bem-sucedida (status 200)")
                
                try:
                    result = response.json()
                    
                    if 'LiveTables' in result:
                        # Processar os dados das roletas
                        roulette_tables = []
                        
                        for table_id, table_info in result['LiveTables'].items():
                            table_name = table_info.get('Name', '')
                            
                            # Filtrar apenas mesas de roleta
                            if 'Roulette' in table_name or 'Ruleta' in table_name:
                                last_numbers = table_info.get('RouletteLast5Numbers', [])
                                
                                # Verificar se queremos apenas mesas com números
                                if only_with_numbers and not last_numbers:
                                    continue
                                
                                # Coletar dados da mesa
                                roulette_table = {
                                    'id': table_info.get('GameID', 'N/A'),
                                    'name': table_name,
                                    'dealer': table_info.get('Dealer', 'N/A'),
                                    'is_open': table_info.get('IsOpen', False),
                                    'players': table_info.get('Players', 0),
                                    'last_numbers': last_numbers
                                }
                                
                                roulette_tables.append(roulette_table)
                        
                        # Criar o objeto de resultado
                        output_data = {
                            'timestamp': datetime.now().isoformat(),
                            'tables': roulette_tables,
                            'count': len(roulette_tables)
                        }
                        
                        # Log dos resultados
                        self.logger.info(f"Encontradas {len(roulette_tables)} mesas de roleta")
                        
                        # Opcionalmente salvar em arquivo
                        if save_to_file:
                            with open(save_to_file, 'w', encoding='utf-8') as f:
                                json.dump(output_data, f, indent=2)
                            self.logger.info(f"Dados salvos em {save_to_file}")
                        
                        return output_data
                    else:
                        self.logger.error("Formato de resposta inesperado (sem LiveTables)")
                        return None
                
                except ValueError:
                    self.logger.error("Resposta não é JSON válido")
                    return None
            else:
                self.logger.error(f"Falha na requisição. Status: {response.status_code}")
                return None
        
        except Exception as e:
            self.logger.error(f"Erro ao capturar dados: {str(e)}")
            return None
    
    def extract_numbers(self, data):
        """
        Extrai apenas os números das roletas a partir dos dados completos
        
        Argumentos:
            data (dict): Dados retornados por get_roulette_data()
            
        Retorna:
            dict: Dicionário com ID da roleta como chave e lista de números como valor
        """
        if not data or 'tables' not in data:
            return {}
        
        numbers_dict = {}
        
        for table in data['tables']:
            table_id = table['id']
            numbers = table['last_numbers']
            
            if numbers:  # Apenas incluir mesas que têm números
                numbers_dict[table_id] = numbers
        
        return numbers_dict

    def continuous_capture(self, duration=30, interval=5, save_to_file='roulette_continuous_data.json'):
        """
        Realiza captura contínua de dados por um período específico
        
        Argumentos:
            duration (int): Duração total da captura em segundos
            interval (int): Intervalo entre capturas em segundos
            save_to_file (str): Arquivo para salvar os dados consolidados
            
        Retorna:
            dict: Dados consolidados de todas as mesas detectadas
        """
        self.logger.info(f"Iniciando captura contínua por {duration} segundos")
        
        # Dicionário para armazenar todas as mesas encontradas
        all_tables = {}
        tables_with_numbers = 0
        total_captures = 0
        start_time = time.time()
        end_time = start_time + duration
        
        # Loop de captura
        while time.time() < end_time:
            # Calcular tempo restante
            remaining = end_time - time.time()
            self.logger.info(f"Tempo restante: {int(remaining)}s - Captura #{total_captures + 1}")
            
            # Realizar uma captura
            data = self.get_roulette_data()
            total_captures += 1
            
            if data and 'tables' in data:
                # Processar cada mesa encontrada
                for table in data['tables']:
                    table_id = table['id']
                    has_numbers = len(table.get('last_numbers', [])) > 0
                    
                    # Armazenar ou atualizar informações da mesa
                    if table_id not in all_tables or has_numbers:
                        all_tables[table_id] = table
                        
                        # Contar mesas com números se for a primeira vez que vemos esta mesa com números
                        if has_numbers and (table_id not in all_tables or not all_tables[table_id].get('last_numbers')):
                            tables_with_numbers += 1
                            self.logger.info(f"Nova mesa com números encontrada: {table['name']} - {', '.join(table['last_numbers'])}")
                
                self.logger.info(f"Captura #{total_captures}: {len(data['tables'])} mesas, {sum(1 for t in data['tables'] if t.get('last_numbers'))} com números")
            
            # Aguardar o próximo intervalo se não for a última iteração
            if time.time() + interval < end_time:
                time.sleep(interval)
        
        # Preparar resultado consolidado
        tables_list = list(all_tables.values())
        
        # Ordenar as mesas: primeiro as que têm números, depois por ID
        tables_list.sort(key=lambda t: (0 if t.get('last_numbers') else 1, t['id']))
        
        # Montar o objeto de resultado
        output_data = {
            'timestamp': datetime.now().isoformat(),
            'duration': duration,
            'captures': total_captures,
            'tables': tables_list,
            'count': len(tables_list),
            'tables_with_numbers': sum(1 for t in tables_list if t.get('last_numbers'))
        }
        
        # Salvar resultado consolidado
        if save_to_file:
            with open(save_to_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2)
            self.logger.info(f"Dados consolidados salvos em {save_to_file}")
        
        self.logger.info(f"Captura contínua concluída: {output_data['count']} mesas únicas encontradas, {output_data['tables_with_numbers']} com números")
        
        return output_data


# Exemplo de uso quando executado diretamente
if __name__ == "__main__":
    # Configurar logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - [MAIN] - %(levelname)s - %(message)s')
    logger = logging.getLogger('main')
    
    # Criar instância do scraper
    scraper = Casino888Scraper()
    
    # Capturar os dados de forma contínua por 30 segundos
    logger.info("Iniciando captura contínua de dados...")
    continuous_data = scraper.continuous_capture(duration=30, interval=5, save_to_file='roulette_continuous_data.json')
    
    if continuous_data:
        # Mostrar algumas estatísticas
        logger.info(f"Captura concluída. {continuous_data['count']} mesas encontradas em {continuous_data['captures']} capturas.")
        logger.info(f"{continuous_data['tables_with_numbers']} mesas têm números disponíveis.")
        
        # Extrair apenas os números
        tables_with_numbers = [t for t in continuous_data['tables'] if t.get('last_numbers')]
        
        if tables_with_numbers:
            logger.info("Mesas com números disponíveis:")
            for table in tables_with_numbers[:10]:  # Mostrar até 10 mesas
                logger.info(f"Mesa {table['name']} (ID {table['id']}): {', '.join(table['last_numbers'])}")
            
            if len(tables_with_numbers) > 10:
                logger.info(f"... e mais {len(tables_with_numbers) - 10} mesas")
        else:
            logger.info("Nenhuma mesa tem números disponíveis no momento")
    else:
        logger.error("Falha na captura de dados") 