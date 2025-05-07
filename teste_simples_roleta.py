import numpy as np
import pymongo
import os
import sys
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import random

print("============================================================")
print("Análise de Roleta - Versão Simplificada")
print("Baseado no conceito do RouletteAi")
print("============================================================")

# Configurações MongoDB
MONGODB_URI = os.environ.get("MONGODB_URI") or "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash"
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME") or "runcash"

# Conectar ao MongoDB
print("Conectando ao MongoDB...")
client = pymongo.MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
collection = db["roleta_numeros"]

# Parâmetros para busca
roleta_nome = input("Nome da roleta (deixe em branco para todas): ").strip() or None
dias_atras = int(input("Quantos dias de dados buscar (padrão: 7): ") or "7")

# Obter um documento de amostra para identificar os campos
sample_doc = collection.find_one()
if not sample_doc:
    print("Erro: Não foi possível encontrar nenhum documento na coleção.")
    sys.exit(1)

# Filtrar por nome da roleta e período
query = {}
if roleta_nome:
    # Verificar o nome do campo (pode ser roleta_nome ou rouletteName)
    roleta_nome_field = "roleta_nome" if "roleta_nome" in sample_doc else "rouletteName"
    query[roleta_nome_field] = roleta_nome

# Filtrar por data
data_limite = datetime.now() - timedelta(days=dias_atras)
campo_data = "timestamp" if "timestamp" in sample_doc else "createdAt"
query[campo_data] = {"$gte": data_limite}

# Buscar dados
print(f"Buscando dados dos últimos {dias_atras} dias...")
if roleta_nome:
    print(f"Roleta: {roleta_nome}")
else:
    print("Todas as roletas")

# Campo que contém o número da roleta
campo_numero = "numero" if "numero" in sample_doc else "number"

resultados = list(collection.find(query).sort(campo_data, -1))
print(f"Encontrados {len(resultados)} resultados")

if len(resultados) < 10:
    print("Poucos dados para análise. É necessário pelo menos 10 registros.")
    sys.exit(1)

# Extrair apenas os números para análise
numeros = [doc[campo_numero] for doc in resultados]
numeros.reverse()  # Organizar em ordem cronológica

print(f"\nÚltimos 10 números: {numeros[-10:]}")

# Análise Estatística Básica
print("\n============================================================")
print("ANÁLISE ESTATÍSTICA BÁSICA")
print("============================================================")

# Contagem de ocorrências
ocorrencias = {}
for i in range(37):  # 0-36
    ocorrencias[i] = numeros.count(i)

# Números mais frequentes
mais_frequentes = sorted(ocorrencias.items(), key=lambda x: x[1], reverse=True)[:5]
menos_frequentes = sorted(ocorrencias.items(), key=lambda x: x[1])[:5]

print("\nNúmeros mais frequentes:")
for numero, contagem in mais_frequentes:
    percentual = (contagem / len(numeros)) * 100
    print(f"Número {numero}: {contagem} ocorrências ({percentual:.2f}%)")

print("\nNúmeros menos frequentes:")
for numero, contagem in menos_frequentes:
    percentual = (contagem / len(numeros)) * 100
    print(f"Número {numero}: {contagem} ocorrências ({percentual:.2f}%)")

# Estatísticas por categoria
zeros = numeros.count(0)
vermelhos = sum(1 for n in numeros if n in [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
pretos = sum(1 for n in numeros if n in [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35])
pares = sum(1 for n in numeros if n > 0 and n % 2 == 0)
impares = sum(1 for n in numeros if n > 0 and n % 2 != 0)

print("\nEstatísticas por categoria:")
print(f"Zeros: {zeros} ({zeros/len(numeros)*100:.2f}%)")
print(f"Vermelhos: {vermelhos} ({vermelhos/len(numeros)*100:.2f}%)")
print(f"Pretos: {pretos} ({pretos/len(numeros)*100:.2f}%)")
print(f"Pares: {pares} ({pares/(len(numeros)-zeros)*100:.2f}%)")
print(f"Ímpares: {impares} ({impares/(len(numeros)-zeros)*100:.2f}%)")

# Análise de padrões
print("\n============================================================")
print("ANÁLISE DE PADRÕES")
print("============================================================")

# Sequências de cores
def encontrar_maior_sequencia(nums, criterio):
    maior_sequencia = 0
    sequencia_atual = 0
    
    for n in nums:
        if criterio(n):
            sequencia_atual += 1
            maior_sequencia = max(maior_sequencia, sequencia_atual)
        else:
            sequencia_atual = 0
            
    return maior_sequencia

maior_sequencia_vermelho = encontrar_maior_sequencia(
    numeros, 
    lambda n: n in [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
)

maior_sequencia_preto = encontrar_maior_sequencia(
    numeros, 
    lambda n: n in [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]
)

maior_sequencia_par = encontrar_maior_sequencia(
    numeros, 
    lambda n: n > 0 and n % 2 == 0
)

maior_sequencia_impar = encontrar_maior_sequencia(
    numeros, 
    lambda n: n > 0 and n % 2 != 0
)

print(f"Maior sequência de vermelhos: {maior_sequencia_vermelho}")
print(f"Maior sequência de pretos: {maior_sequencia_preto}")
print(f"Maior sequência de pares: {maior_sequencia_par}")
print(f"Maior sequência de ímpares: {maior_sequencia_impar}")

# Análise de repetições
repeticoes = []
for i in range(1, len(numeros)):
    if numeros[i] == numeros[i-1]:
        repeticoes.append(numeros[i])

print(f"\nNúmeros que repetiram consecutivamente: {repeticoes}")
print(f"Total de repetições consecutivas: {len(repeticoes)}")
if len(repeticoes) > 0:
    print(f"Percentual de jogadas com repetição: {len(repeticoes)/len(numeros)*100:.2f}%")

# Previsão básica baseada em frequência e recência
print("\n============================================================")
print("PREVISÃO BASEADA EM FREQUÊNCIA E RECÊNCIA")
print("============================================================")

# Atribuindo um score para cada número baseado em frequência e recência
scores = {}

# Componente de frequência
for num, freq in ocorrencias.items():
    scores[num] = freq / len(numeros)  # Normalizar por total de jogadas

# Componente de recência (mais peso para números que aparecem nos últimos 50 resultados)
ultimos_50 = numeros[-50:] if len(numeros) >= 50 else numeros
for i, num in enumerate(ultimos_50):
    # Dar mais peso para números mais recentes
    recencia = (i + 1) / len(ultimos_50)
    scores[num] = scores.get(num, 0) + (recencia * 0.5)

# Top 5 previsões
previsoes = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:5]

print("\nTop 5 números previstos (baseado em frequência e recência):")
for i, (numero, score) in enumerate(previsoes):
    print(f"#{i+1}: Número {numero} (Score: {score:.4f})")

# Visualização
print("\nCriando visualização...")

# Gráfico de barras para os número mais frequentes
plt.figure(figsize=(14, 8))

# Gráfico de frequência
plt.subplot(2, 2, 1)
numeros_plot = [x[0] for x in mais_frequentes]
frequencias = [x[1] for x in mais_frequentes]
plt.bar(numeros_plot, frequencias, color='blue')
plt.title('Números Mais Frequentes')
plt.xlabel('Número')
plt.ylabel('Frequência')

# Gráfico de distribuição por categoria
plt.subplot(2, 2, 2)
categorias = ['Zero', 'Vermelho', 'Preto', 'Par', 'Ímpar']
valores = [zeros, vermelhos, pretos, pares, impares]
plt.bar(categorias, valores, color=['green', 'red', 'black', 'blue', 'orange'])
plt.title('Distribuição por Categoria')
plt.ylabel('Contagem')

# Histograma de todos os números
plt.subplot(2, 1, 2)
plt.hist(numeros, bins=37, range=(-0.5, 36.5), color='purple', alpha=0.7)
plt.title('Distribuição de Todos os Números')
plt.xlabel('Número')
plt.ylabel('Frequência')
plt.xticks(range(0, 37, 2))  # Mostrar apenas números pares no eixo x para clareza

plt.tight_layout()
plt.savefig('analise_roleta.png')
print("Gráfico salvo como 'analise_roleta.png'")

print("\n============================================================")
print("SIMULAÇÕES DE APOSTAS")
print("============================================================")

# Função para simular apostas baseadas em diferentes estratégias
def simular_apostas(estrategia, capital_inicial=100, apostas=100):
    capital = capital_inicial
    historico_capital = [capital]
    
    for i in range(min(apostas, len(numeros) - 1)):
        # Obter número a ser apostado baseado na estratégia
        if estrategia == "frequente":
            # Apostar nos 5 números mais frequentes
            numeros_aposta = [x[0] for x in mais_frequentes]
        elif estrategia == "raro":
            # Apostar nos 5 números menos frequentes
            numeros_aposta = [x[0] for x in menos_frequentes]
        elif estrategia == "recente":
            # Apostar nos 5 números mais recentes (sem repetição)
            recentes = []
            for n in reversed(numeros[:i]):
                if n not in recentes:
                    recentes.append(n)
                if len(recentes) >= 5:
                    break
            numeros_aposta = recentes
        elif estrategia == "aleatorio":
            # Apostar em 5 números aleatórios
            numeros_aposta = random.sample(range(37), 5)
        
        # Verificar se ganhamos
        numero_real = numeros[i + 1]
        
        # Calcular lucro/perda
        if numero_real in numeros_aposta:
            # Ganhou (pagamento é 36 para 1, mas apostamos em 5 números)
            capital += (36 / 5) - 5  # ganho líquido
        else:
            # Perdeu a aposta
            capital -= 5
        
        # Registrar capital
        historico_capital.append(capital)
        
        # Parar se o capital acabou
        if capital <= 0:
            break
    
    return historico_capital

# Simular diferentes estratégias
estrategias = ["frequente", "raro", "recente", "aleatorio"]
resultados_simulacao = {}

for estrategia in estrategias:
    resultados_simulacao[estrategia] = simular_apostas(estrategia)
    final_capital = resultados_simulacao[estrategia][-1]
    lucro_perda = final_capital - 100
    print(f"Estratégia '{estrategia}': Capital final = {final_capital:.2f} (Lucro/Perda: {lucro_perda:.2f})")

# Gráfico comparativo
plt.figure(figsize=(12, 6))
for estrategia, historico in resultados_simulacao.items():
    plt.plot(historico, label=estrategia)

plt.axhline(y=100, color='r', linestyle='--', alpha=0.3)
plt.title('Comparação de Estratégias de Apostas')
plt.xlabel('Número de Apostas')
plt.ylabel('Capital')
plt.legend()
plt.grid(True, alpha=0.3)
plt.savefig('simulacao_apostas.png')
print("Gráfico de simulação salvo como 'simulacao_apostas.png'")

print("\n============================================================")
print("Análise concluída!")
print("============================================================")

print("\nOBSERVAÇÕES IMPORTANTES:")
print("1. A roleta é projetada para ser um jogo de azar genuinamente aleatório")
print("2. Qualquer padrão detectado é mais provável ser coincidência estatística")
print("3. A casa sempre tem vantagem matemática no longo prazo (2.7% na roleta européia)")
print("4. Esta análise é apenas para fins educacionais e de entretenimento")

input('\nPressione ENTER para sair') 