#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de teste para verificar se o scraper está usando corretamente
apenas o banco de dados roletas_db.
"""

import os
import sys
import time
from datetime import datetime

print("\n" + "="*80)
print("TESTE DO SISTEMA COMPLETO - SCRAPER COM BANCO ROLETAS_DB")
print("Data/Hora:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
print("="*80 + "\n")

# Definir variável de ambiente para usar apenas o banco roletas_db
os.environ['ROLETAS_MONGODB_DB_NAME'] = 'roletas_db'
print(f"Banco de dados configurado: {os.environ['ROLETAS_MONGODB_DB_NAME']}")

# Importar adaptador para o novo banco
try:
    from adaptar_scraper_roletas_db import ScraperAdapter
    print("✅ Adaptador importado com sucesso!")
except ImportError as e:
    print(f"❌ Erro ao importar adaptador: {e}")
    sys.exit(1)

# Importar scraper
try:
    from scraper_mongodb import scrape_roletas_api
    print("✅ Scraper importado com sucesso!")
except ImportError as e:
    print(f"❌ Erro ao importar scraper: {e}")
    sys.exit(1)

# Inicializar adaptador
try:
    print("\nInicializando adaptador...")
    adapter = ScraperAdapter()
    print("✅ Adaptador inicializado!")
except Exception as e:
    print(f"❌ Erro ao inicializar adaptador: {e}")
    sys.exit(1)

# Verificar roletas disponíveis
try:
    print("\nListando roletas disponíveis:")
    roletas = adapter.obter_roletas()
    print(f"Encontradas {len(roletas)} roletas")
    
    for i, roleta in enumerate(roletas[:5]):
        print(f"  {i+1}. {roleta['nome']} (ID: {roleta['id']})")
except Exception as e:
    print(f"❌ Erro ao listar roletas: {e}")

# Teste de inserção manual
try:
    print("\nTestando inserção manual...")
    if roletas:
        roleta = roletas[0]
        roleta_id = roleta['id']
        roleta_nome = roleta['nome']
        
        numero_teste = 27
        resultado = adapter.inserir_numero(roleta_id, roleta_nome, numero_teste)
        print(f"Inserção de {numero_teste} para {roleta_nome}: {'Sucesso' if resultado else 'Falha'}")
        
        # Verificar se foi inserido
        numeros = adapter.obter_ultimos_numeros(roleta_id, 1)
        if numeros and numeros[0]['numero'] == numero_teste:
            print(f"✅ Número {numero_teste} verificado no banco!")
        else:
            print(f"❌ Número {numero_teste} não encontrado no banco!")
except Exception as e:
    print(f"❌ Erro no teste de inserção: {e}")

# Testar integração com scraper (simulação)
try:
    print("\nTestando integração com scraper (simulação)...")
    
    # Definir hook de exemplo para verificar chamadas
    chamadas_hook = []
    
    def hook_teste(roleta_id, roleta_nome, numero):
        chamadas_hook.append((roleta_id, roleta_nome, numero))
        print(f"[HOOK] Recebido: roleta_id={roleta_id}, roleta_nome={roleta_nome}, numero={numero}")
    
    # Criar uma simulação de processamento de números
    from scraper_mongodb import processar_numeros
    
    # Simular uma chamada como se viesse da API
    table_id = "2_2010049"  # ID como seria recebido da API
    roleta_nome = "Roleta de Teste"
    numeros_novos = [5, 7, 9]  # Simular três números novos
    
    print(f"Simulando processamento para: {roleta_nome} (ID API: {table_id})")
    resultado = processar_numeros(adapter, table_id, roleta_nome, numeros_novos, hook_teste)
    
    print(f"Processamento: {'Sucesso' if resultado else 'Falha'}")
    print(f"Hook chamado {len(chamadas_hook)} vezes")
    
    # Verificar números no banco
    # Extrair ID numérico
    id_numerico = table_id.split("_")[1] if "_" in table_id else table_id
    numeros = adapter.obter_ultimos_numeros(id_numerico, 10)
    
    print(f"\nÚltimos números para {roleta_nome} (ID: {id_numerico}):")
    for num in numeros[:5]:
        print(f"  - {num['numero']} ({num['cor']}) em {num['timestamp'].strftime('%d/%m/%Y %H:%M:%S')}")
    
except Exception as e:
    print(f"❌ Erro no teste de integração: {e}")

# Encerramento
try:
    print("\nFechando conexões...")
    adapter.fechar()
    print("✅ Conexões fechadas!")
except Exception as e:
    print(f"❌ Erro ao fechar conexões: {e}")

print("\n" + "="*80)
print("TESTE CONCLUÍDO")
print("="*80 + "\n") 