import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers
import pymongo
import os
import sys
from datetime import datetime, timedelta
import pandas as pd
import matplotlib.pyplot as plt

print("============================================================")
print("Teste de RouletteAi adaptado para RunCash")
print("Baseado no projeto: https://github.com/CorvusCodex/RouletteAi")
print("============================================================")

# Configurações MongoDB
MONGODB_URI = os.environ.get("MONGODB_URI") or "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash"
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME") or "runcash"
ROLETAS_DB_NAME = os.environ.get("ROLETAS_MONGODB_DB_NAME") or "roletas_db"

# Conectar ao MongoDB
print("Conectando ao MongoDB...")
client = pymongo.MongoClient(MONGODB_URI)

# Verificar se queremos usar o banco de dados otimizado
use_roletas_db = input("Usar o banco de dados otimizado roletas_db? (S/n): ").lower() != 'n'

if use_roletas_db and ROLETAS_DB_NAME in client.list_database_names():
    db_roletas = client[ROLETAS_DB_NAME]
    print(f"Conectado ao banco de dados: {ROLETAS_DB_NAME}")
    
    # Obter lista de roletas disponíveis
    roletas_disponiveis = []
    
    # Verificar se existe a coleção de metadados
    if "metadados" in db_roletas.list_collection_names():
        # Buscar informações das roletas da coleção metadados
        print("Buscando roletas na coleção metadados...")
        roletas_docs = list(db_roletas.metadados.find({"ativa": True}))
        
        for roleta in roletas_docs:
            roletas_disponiveis.append({
                "id": roleta.get("roleta_id") or roleta.get("colecao"),
                "nome": roleta.get("roleta_nome")
            })
    
    # Se não encontrou na coleção metadados, listar coleções disponíveis
    if not roletas_disponiveis:
        print("Coleção metadados não encontrada. Listando coleções disponíveis...")
        collections = db_roletas.list_collection_names()
        
        # Filtrar apenas coleções que representam roletas (excluir metadados, sistema, etc)
        roleta_collections = [col for col in collections 
                            if not col.startswith("system.") 
                            and col not in ["metadados", "estatisticas"]]
        
        # Criar lista de roletas a partir das coleções
        for collection_name in roleta_collections:
            roletas_disponiveis.append({
                "id": collection_name,
                "nome": f"Roleta {collection_name}"
            })
    
    # Verificar se encontrou roletas
    if not roletas_disponiveis:
        print("Nenhuma roleta encontrada no banco roletas_db. Usando banco principal como fallback.")
        db = client[MONGODB_DB_NAME]
        collection = db["roleta_numeros"]
        
        # Continuar com o fluxo original para o banco principal
        roleta_nome = input("Nome da roleta (deixe em branco para todas): ").strip() or None
        dias_atras = int(input("Quantos dias de dados buscar (padrão: 7): ") or "7")
        
        # Filtrar por nome da roleta e período
        query = {}
        sample_doc = collection.find_one()
        
        if roleta_nome:
            # Verificar o nome do campo (pode ser roleta_nome ou rouletteName)
            roleta_nome_field = "roleta_nome" if "roleta_nome" in sample_doc else "rouletteName"
            query[roleta_nome_field] = roleta_nome
        
        # Filtrar por data
        data_limite = datetime.now() - timedelta(days=dias_atras)
        campo_data = "timestamp" if "timestamp" in sample_doc else "createdAt"
        query[campo_data] = {"$gte": data_limite}
        
        # Campo que contém o número da roleta
        campo_numero = "numero" if "numero" in sample_doc else "number"
        
        # Buscar dados
        print(f"Buscando dados dos últimos {dias_atras} dias...")
        if roleta_nome:
            print(f"Roleta: {roleta_nome}")
        else:
            print("Todas as roletas")
            
        resultados = list(collection.find(query).sort(campo_data, -1))
    else:
        # Mostrar roletas disponíveis
        print("\nRoletas disponíveis:")
        for i, roleta in enumerate(roletas_disponiveis):
            print(f"{i+1}. {roleta['nome']} (ID: {roleta['id']})")
        
        # Solicitar escolha da roleta
        escolha = input("\nEscolha o número da roleta (ou 0 para usar banco principal): ")
        
        try:
            escolha_num = int(escolha)
            if 1 <= escolha_num <= len(roletas_disponiveis):
                roleta_escolhida = roletas_disponiveis[escolha_num-1]
                print(f"Roleta escolhida: {roleta_escolhida['nome']}")
                
                # Buscar coleção específica da roleta
                collection_id = roleta_escolhida['id']
                
                # Verificar se a coleção existe
                if collection_id in db_roletas.list_collection_names():
                    dias_atras = int(input("Quantos dias de dados buscar (padrão: 7): ") or "7")
                    
                    # Buscar dados diretamente da coleção da roleta
                    data_limite = datetime.now() - timedelta(days=dias_atras)
                    resultados = list(db_roletas[collection_id]
                                    .find({"timestamp": {"$gte": data_limite}})
                                    .sort("timestamp", -1))  # Ordem inversa
                    
                    print(f"Encontrados {len(resultados)} resultados na coleção {collection_id}")
                    
                    # Definir campo_numero para extração consistente
                    campo_numero = "numero"
                else:
                    print(f"Coleção {collection_id} não encontrada. Usando banco principal como fallback.")
                    raise ValueError("Coleção não encontrada")
            else:
                # Usar banco principal
                raise ValueError("Opção inválida")
        except ValueError:
            # Usar banco principal como fallback
            print("Usando banco principal...")
            db = client[MONGODB_DB_NAME]
            collection = db["roleta_numeros"]
            
            # Continuar com o fluxo original para o banco principal
            roleta_nome = input("Nome da roleta (deixe em branco para todas): ").strip() or None
            dias_atras = int(input("Quantos dias de dados buscar (padrão: 7): ") or "7")
            
            # Filtrar por nome da roleta e período
            query = {}
            sample_doc = collection.find_one()
            
            if roleta_nome:
                # Verificar o nome do campo (pode ser roleta_nome ou rouletteName)
                roleta_nome_field = "roleta_nome" if "roleta_nome" in sample_doc else "rouletteName"
                query[roleta_nome_field] = roleta_nome
            
            # Filtrar por data
            data_limite = datetime.now() - timedelta(days=dias_atras)
            campo_data = "timestamp" if "timestamp" in sample_doc else "createdAt"
            query[campo_data] = {"$gte": data_limite}
            
            # Campo que contém o número da roleta
            campo_numero = "numero" if "numero" in sample_doc else "number"
            
            # Buscar dados
            print(f"Buscando dados dos últimos {dias_atras} dias...")
            if roleta_nome:
                print(f"Roleta: {roleta_nome}")
            else:
                print("Todas as roletas")
                
            resultados = list(collection.find(query).sort(campo_data, -1))
else:
    # Usar banco principal
    print("Usando banco principal padrão...")
    db = client[MONGODB_DB_NAME]
    collection = db["roleta_numeros"]
    
    # Parâmetros para busca
    roleta_nome = input("Nome da roleta (deixe em branco para todas): ").strip() or None
    dias_atras = int(input("Quantos dias de dados buscar (padrão: 7): ") or "7")
    
    # Filtrar por nome da roleta e período
    query = {}
    sample_doc = collection.find_one()
    
    if roleta_nome:
        # Verificar o nome do campo (pode ser roleta_nome ou rouletteName)
        roleta_nome_field = "roleta_nome" if "roleta_nome" in sample_doc else "rouletteName"
        query[roleta_nome_field] = roleta_nome
    
    # Filtrar por data
    data_limite = datetime.now() - timedelta(days=dias_atras)
    campo_data = "timestamp" if "timestamp" in sample_doc else "createdAt"
    query[campo_data] = {"$gte": data_limite}
    
    # Campo que contém o número da roleta
    campo_numero = "numero" if "numero" in sample_doc else "number"
    
    # Buscar dados
    print(f"Buscando dados dos últimos {dias_atras} dias...")
    if roleta_nome:
        print(f"Roleta: {roleta_nome}")
    else:
        print("Todas as roletas")
        
    resultados = list(collection.find(query).sort(campo_data, -1))

print(f"Encontrados {len(resultados)} resultados")

if len(resultados) < 50:
    print("Poucos dados para treinar o modelo. É necessário pelo menos 50 registros.")
    sys.exit(1)

# Extrair apenas os números para o treinamento
numeros = [doc[campo_numero] for doc in resultados if campo_numero in doc]
numeros.reverse()  # Organizar em ordem cronológica

# Salvar os números em um arquivo para compatibilidade com o script original
with open("temp_data.txt", "w") as f:
    for num in numeros:
        f.write(f"{num}\n")

print(f"Dados salvos em temp_data.txt ({len(numeros)} números)")

# Carregar dados do arquivo
data = np.array(numeros)

# Filtrar apenas números válidos da roleta (0-36)
data = data[(data >= 0) & (data <= 36)]

# Definir o tamanho da sequência de entrada
sequence_length = min(10, len(data) // 5)  # Ajustar baseado na quantidade de dados

print(f"Usando sequência de tamanho: {sequence_length}")

# Criar sequências de comprimento fixo a partir dos dados
sequences = []
targets = []

for i in range(len(data) - sequence_length):
    seq = data[i:i+sequence_length]
    target = data[i+sequence_length]
    sequences.append(seq)
    targets.append(target)

sequences = np.array(sequences)
targets = np.array(targets)

# Dividir os dados em conjuntos de treino e validação
split_idx = int(0.8 * len(sequences))
train_data = sequences[:split_idx]
train_targets = targets[:split_idx]
val_data = sequences[split_idx:]
val_targets = targets[split_idx:]

# Obter o valor máximo nos dados
max_value = 36  # A roleta vai de 0 a 36

# Criar o modelo
model = keras.Sequential([
    layers.Embedding(input_dim=max_value+1, output_dim=64),
    layers.LSTM(128, return_sequences=False),
    layers.Dense(37, activation='softmax')  # 37 classes (0-36)
])

# Compilar o modelo
model.compile(
    loss='sparse_categorical_crossentropy',
    optimizer='adam',
    metrics=['accuracy']
)

# Resumo do modelo
model.summary()

# Treinar o modelo
print("\nIniciando treinamento...")
history = model.fit(
    train_data, train_targets,
    validation_data=(val_data, val_targets),
    epochs=50,
    batch_size=32,
    verbose=1
)

# Visualizar o histórico de treinamento
plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.plot(history.history['accuracy'])
plt.plot(history.history['val_accuracy'])
plt.title('Acurácia do Modelo')
plt.ylabel('Acurácia')
plt.xlabel('Época')
plt.legend(['Treino', 'Validação'], loc='upper left')

plt.subplot(1, 2, 2)
plt.plot(history.history['loss'])
plt.plot(history.history['val_loss'])
plt.title('Perda do Modelo')
plt.ylabel('Perda')
plt.xlabel('Época')
plt.legend(['Treino', 'Validação'], loc='upper left')

plt.tight_layout()
plt.savefig('treinamento_roulette_ai.png')
print("Gráfico de treinamento salvo em 'treinamento_roulette_ai.png'")

# Avaliar o modelo
print("\nAvaliando o modelo...")
loss, accuracy = model.evaluate(val_data, val_targets)
print(f"Perda: {loss:.4f}, Acurácia: {accuracy:.4f}")

# Fazer previsões
print("\nFazendo previsões...")
last_sequence = data[-sequence_length:].reshape(1, sequence_length)
predictions = model.predict(last_sequence)[0]

# Obter os 5 números mais prováveis
top_indices = np.argsort(predictions)[-5:][::-1]
top_probabilities = predictions[top_indices]

print("\nTop 5 previsões para o próximo número:")
for i, (idx, prob) in enumerate(zip(top_indices, top_probabilities)):
    print(f"#{i+1}: Número {idx} (Probabilidade: {prob*100:.2f}%)")

# Análise de desempenho
print("\nAnálise de desempenho em dados históricos:")
correct_predictions = 0
total_predictions = len(val_data)

# Previsão nos dados de validação
val_predictions = model.predict(val_data)
val_predicted_classes = np.argmax(val_predictions, axis=1)

# Calcular acurácia
correct_predictions = np.sum(val_predicted_classes == val_targets)
accuracy = correct_predictions / total_predictions
print(f"Acurácia nas previsões históricas: {accuracy*100:.2f}%")

# Comparar com acurácia esperada para previsão aleatória
random_accuracy = 1/37  # Probabilidade de acertar aleatoriamente (0-36)
print(f"Acurácia esperada para previsão aleatória: {random_accuracy*100:.2f}%")

if accuracy > random_accuracy:
    improvement = (accuracy / random_accuracy) - 1
    print(f"O modelo é {improvement*100:.2f}% melhor que previsão aleatória")
else:
    print("O modelo não supera a previsão aleatória, indicando que pode não haver padrões predizíveis")

# Salvar o modelo
model.save('roulette_model.keras')
print("Modelo salvo como 'roulette_model.keras'")

print("\n============================================================")
print("Teste de RouletteAi concluído!")
print("============================================================")

# Impedir que a janela seja fechada imediatamente
input('Pressione ENTER para sair') 