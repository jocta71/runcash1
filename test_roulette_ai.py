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

# Conectar ao MongoDB
print("Conectando ao MongoDB...")
client = pymongo.MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
collection = db["roleta_numeros"]

# Parâmetros para busca
roleta_nome = input("Nome da roleta (deixe em branco para todas): ").strip() or None
dias_atras = int(input("Quantos dias de dados buscar (padrão: 7): ") or "7")

# Filtrar por nome da roleta e período
query = {}
if roleta_nome:
    # Verificar o nome do campo (pode ser roleta_nome ou rouletteName)
    sample_doc = collection.find_one()
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

if len(resultados) < 50:
    print("Poucos dados para treinar o modelo. É necessário pelo menos 50 registros.")
    sys.exit(1)

# Extrair apenas os números para o treinamento
numeros = [doc[campo_numero] for doc in resultados]
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