#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Exemplo prático de uso do novo banco de dados de roletas otimizado.
Este script mostra como utilizar o adaptador e a classe principal.
"""

import time
import random
from datetime import datetime, timedelta
from tabulate import tabulate

try:
    # Tentar importar o adaptador
    from adaptar_scraper_roletas_db import ScraperAdapter
    print("Adaptador importado com sucesso!")
except ImportError:
    print("Erro ao importar o adaptador. Verifique se os arquivos estão no diretório correto.")
    exit(1)

def mostrar_roletas(adaptador):
    """Mostra a lista de roletas disponíveis no banco"""
    print("\n=== ROLETAS DISPONÍVEIS ===")
    
    # Obter roletas
    roletas = adaptador.obter_roletas()
    
    if not roletas:
        print("Nenhuma roleta encontrada!")
        return None
    
    # Preparar dados para tabela
    dados_tabela = []
    for i, roleta in enumerate(roletas):
        dados_tabela.append([
            i+1, 
            roleta['id'], 
            roleta['nome']
        ])
    
    # Mostrar tabela
    headers = ["#", "ID", "Nome"]
    print(tabulate(dados_tabela, headers=headers, tablefmt="pretty"))
    
    return roletas

def mostrar_numeros(adaptador, roleta_id, roleta_nome, limite=20):
    """Mostra os últimos números para uma roleta"""
    print(f"\n=== ÚLTIMOS {limite} NÚMEROS PARA {roleta_nome} ===")
    
    # Obter números
    numeros = adaptador.obter_ultimos_numeros(roleta_id, limite)
    
    if not numeros:
        print("Nenhum número encontrado para esta roleta!")
        return
    
    # Preparar dados para tabela
    dados_tabela = []
    for i, num in enumerate(numeros):
        # Formatar timestamp
        if 'timestamp' in num:
            timestamp = num['timestamp'].strftime("%d/%m/%Y %H:%M:%S")
        else:
            timestamp = "N/A"
        
        dados_tabela.append([
            i+1,
            num.get('numero', 'N/A'),
            num.get('cor', 'N/A'),
            timestamp
        ])
    
    # Mostrar tabela
    headers = ["#", "Número", "Cor", "Timestamp"]
    print(tabulate(dados_tabela, headers=headers, tablefmt="pretty"))

def inserir_numeros_aleatorios(adaptador, roleta_id, roleta_nome, quantidade=5):
    """Insere números aleatórios para teste"""
    print(f"\n=== INSERINDO {quantidade} NÚMEROS ALEATÓRIOS PARA {roleta_nome} ===")
    
    # Gerar e inserir números
    sucesso = 0
    for i in range(quantidade):
        # Gerar número aleatório (0-36)
        numero = random.randint(0, 36)
        
        # Inserir no banco
        resultado = adaptador.inserir_numero(roleta_id, roleta_nome, numero)
        
        if resultado:
            # Determinar cor para exibição
            if numero == 0:
                cor = "verde"
            elif numero % 2 == 0:
                cor = "preto"
            else:
                cor = "vermelho"
                
            print(f"✓ Inserido: {numero} ({cor})")
            sucesso += 1
        else:
            print(f"✗ Falha ao inserir número {numero}")
        
        # Pausa para não sobrecarregar
        time.sleep(0.5)
    
    print(f"\nTotal inserido: {sucesso}/{quantidade}")

def mostrar_menu():
    """Mostra o menu principal"""
    print("\n=== MENU ===")
    print("1. Listar roletas disponíveis")
    print("2. Ver últimos números de uma roleta")
    print("3. Inserir números aleatórios (teste)")
    print("0. Sair")
    
    opcao = input("\nEscolha uma opção: ")
    return opcao

def main():
    """Função principal"""
    print("=== EXEMPLO DE USO DO BANCO DE DADOS OTIMIZADO PARA ROLETAS ===")
    
    try:
        # Inicializar adaptador
        print("\nInicializando adaptador...")
        adaptador = ScraperAdapter()
        print("✓ Adaptador inicializado com sucesso!")
        
        # Roletas disponíveis (para referência no menu)
        roletas_disponiveis = None
        roleta_selecionada = None
        
        # Loop do menu
        while True:
            opcao = mostrar_menu()
            
            if opcao == "1":
                # Listar roletas
                roletas_disponiveis = mostrar_roletas(adaptador)
                
            elif opcao == "2":
                # Ver últimos números
                if not roletas_disponiveis:
                    roletas_disponiveis = adaptador.obter_roletas()
                
                if not roletas_disponiveis:
                    print("Nenhuma roleta encontrada!")
                    continue
                
                # Obter índice da roleta
                try:
                    mostrar_roletas(adaptador)
                    indice = int(input("\nDigite o número da roleta desejada: ")) - 1
                    
                    if 0 <= indice < len(roletas_disponiveis):
                        roleta = roletas_disponiveis[indice]
                        roleta_selecionada = roleta
                        
                        mostrar_numeros(
                            adaptador, 
                            roleta['id'], 
                            roleta['nome'], 
                            limite=20
                        )
                    else:
                        print("Índice inválido!")
                except ValueError:
                    print("Entrada inválida! Digite um número.")
                except Exception as e:
                    print(f"Erro: {str(e)}")
                
            elif opcao == "3":
                # Inserir números aleatórios
                if not roleta_selecionada:
                    # Se não tiver roleta selecionada, pedir para selecionar
                    if not roletas_disponiveis:
                        roletas_disponiveis = adaptador.obter_roletas()
                    
                    mostrar_roletas(adaptador)
                    
                    try:
                        indice = int(input("\nDigite o número da roleta desejada: ")) - 1
                        
                        if 0 <= indice < len(roletas_disponiveis):
                            roleta_selecionada = roletas_disponiveis[indice]
                        else:
                            print("Índice inválido!")
                            continue
                    except ValueError:
                        print("Entrada inválida! Digite um número.")
                        continue
                    except Exception as e:
                        print(f"Erro: {str(e)}")
                        continue
                
                # Obter quantidade
                try:
                    quantidade = int(input("Quantos números deseja inserir? (1-50): "))
                    
                    if 1 <= quantidade <= 50:
                        inserir_numeros_aleatorios(
                            adaptador, 
                            roleta_selecionada['id'], 
                            roleta_selecionada['nome'], 
                            quantidade
                        )
                        
                        # Mostrar os números inseridos
                        mostrar_numeros(
                            adaptador, 
                            roleta_selecionada['id'], 
                            roleta_selecionada['nome'], 
                            limite=quantidade
                        )
                    else:
                        print("Quantidade inválida! Digite um número entre 1 e 50.")
                except ValueError:
                    print("Entrada inválida! Digite um número.")
                except Exception as e:
                    print(f"Erro: {str(e)}")
                
            elif opcao == "0":
                # Sair
                print("\nFechando conexão com o banco de dados...")
                adaptador.fechar()
                print("Conexão fechada. Até logo!")
                break
            
            else:
                print("Opção inválida! Tente novamente.")
    
    except KeyboardInterrupt:
        print("\n\nOperação interrompida pelo usuário.")
    except Exception as e:
        print(f"\nErro durante a execução: {str(e)}")
    finally:
        # Garantir que a conexão seja fechada
        if 'adaptador' in locals():
            try:
                adaptador.fechar()
                print("Conexão com o banco de dados fechada.")
            except:
                pass

if __name__ == "__main__":
    main() 