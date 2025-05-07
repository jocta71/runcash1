import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers
import pymongo
import os
import sys
from datetime import datetime, timedelta
try:
    from art import text2art
except ImportError:
    os.system('pip install art')
    from art import text2art

# Limitar o uso de memória TensorFlow
physical_devices = tf.config.list_physical_devices('GPU')
if physical_devices:
    tf.config.experimental.set_memory_growth(physical_devices[0], True)
    print("Configuração de GPU concluída")

# Diretamente do script original
ascii_art = text2art("RouletteAi")

print("============================================================")
print("RouletteAi - Versão Original")
print("Created by: Corvus Codex")
print("Github: https://github.com/CorvusCodex/")
print("Adaptado para MongoDB por RunCash")
print("============================================================")

print(ascii_art)
print("Roulette prediction artificial intelligence")

# Perguntar se deve usar dados do MongoDB
usar_mongodb = input("Usar dados do MongoDB? (S/n): ").lower() != 'n'

if usar_mongodb:
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

    resultados = list(collection.find(query).sort(campo_data, 1))  # Ordem cronológica
    print(f"Encontrados {len(resultados)} resultados")

    if len(resultados) < 50:
        print("Poucos dados para treinar o modelo. É necessário pelo menos 50 registros.")
        sys.exit(1)

    # Extrair apenas os números para o treinamento
    numeros = [doc[campo_numero] for doc in resultados]

    # Salvar os números em um arquivo para compatibilidade com o script original
    with open("temp_data.txt", "w") as f:
        for num in numeros:
            f.write(f"{num}\n")

    print(f"Dados salvos em temp_data.txt ({len(numeros)} números)")
    data_file = "temp_data.txt"
else:
    data_file = "data.txt"
    print(f"Usando arquivo de dados: {data_file}")

# Definir tamanho reduzido do modelo (para evitar problemas de memória)
usar_modelo_menor = input("Usar modelo menor (recomendado para evitar problemas de memória)? (S/n): ").lower() != 'n'

# Load data from file, ignoring white spaces and accepting unlimited length numbers
print(f"Carregando dados de {data_file}...")
data = np.genfromtxt(data_file, delimiter='\n', dtype=int)
print(f"Dados carregados: {len(data)} números")

# Filter out numbers that are not between 0 and 36 (inclusive)
data = data[(data >= 0) & (data <= 36)]
print(f"Após filtrar números inválidos: {len(data)} números")

# Define the length of the input sequences
sequence_length = 10
print(f"Tamanho da sequência: {sequence_length}")

# Verificar que temos dados suficientes
if len(data) <= sequence_length:
    print(f"Erro: poucos dados após filtragem. Necessários mais de {sequence_length} números válidos.")
    sys.exit(1)

# Create sequences of fixed length from the data
sequences = np.array([data[i:i+sequence_length] for i in range(len(data)-sequence_length)])
print(f"Criadas {len(sequences)} sequências")

# Create target values which are the next number after each sequence
targets = data[sequence_length:]
print(f"Total de alvos: {len(targets)}")

# Split the data into training and validation sets
train_data = sequences[:int(0.8*len(sequences))]
train_targets = targets[:int(0.8*len(targets))]
val_data = sequences[int(0.8*len(sequences)):]
val_targets = targets[int(0.8*len(targets)):]

print(f"Conjunto de treino: {len(train_data)} sequências")
print(f"Conjunto de validação: {len(val_data)} sequências")

# Get the maximum value in the data
max_value = np.max(data)
print(f"Valor máximo nos dados: {max_value}")

# Set the number of features to 1
num_features = 1

# Criar modelo (original ou reduzido)
print("Criando modelo...")
model = keras.Sequential()

if usar_modelo_menor:
    # Modelo reduzido (mais eficiente em memória)
    model.add(layers.Embedding(input_dim=max_value+1, output_dim=256))
    model.add(layers.LSTM(512))
    model.add(layers.Dense(37, activation='softmax'))  # 37 classes (0-36)
    print("Usando modelo menor (recomendado para computadores com menos recursos)")
else:
    # Modelo original (muito grande)
    model.add(layers.Embedding(input_dim=max_value+1, output_dim=51200))
    model.add(layers.LSTM(104800))
    model.add(layers.Dense(num_features, activation='softmax'))
    print("Usando modelo original (exige muita memória)")

model.compile(loss='sparse_categorical_crossentropy', optimizer='adam', metrics=['accuracy'])

# Resumo do modelo
model.summary()

# Número de épocas
epochs = int(input("Número de épocas para treinamento (recomendado: 20, original: 100): ") or "20")

print("Iniciando treinamento...")
history = model.fit(
    train_data, train_targets, 
    validation_data=(val_data, val_targets), 
    epochs=epochs,
    batch_size=32,
    verbose=1
)

print("Fazendo previsões...")
predictions = model.predict(val_data)

# Extrair as previsões do modelo reduzido
if usar_modelo_menor:
    # Para modelo com saída de 37 classes
    predicted_numbers = np.argmax(predictions, axis=1).reshape(-1, 1)
else:
    # Para o modelo original
    indices = np.argsort(predictions, axis=1)[:, -num_features:]
    predicted_numbers = np.take_along_axis(val_data, indices, axis=1)

print("============================================================")
print("Próximo número previsto:")
for numbers in predicted_numbers[:1]:
    print(', '.join(map(str, numbers)))
    
# Fazer previsão para a próxima jogada usando os últimos dados
last_sequence = data[-sequence_length:].reshape(1, sequence_length)
print(f"Últimos {sequence_length} números: {last_sequence[0]}")

next_prediction = model.predict(last_sequence)
if usar_modelo_menor:
    next_number = np.argmax(next_prediction[0])
    print(f"Próximo número previsto: {next_number}")
    
    # Top 5 probabilidades
    top5_indices = np.argsort(next_prediction[0])[-5:][::-1]
    print("\nTop 5 números mais prováveis:")
    for i, idx in enumerate(top5_indices):
        prob = next_prediction[0][idx] * 100
        print(f"#{i+1}: Número {idx} - Probabilidade: {prob:.2f}%")
else:
    # Extrair de acordo com o modelo original
    next_indices = np.argsort(next_prediction, axis=1)[:, -num_features:]
    next_numbers = np.take_along_axis(last_sequence, next_indices, axis=1)
    print(f"Próximo número previsto: {next_numbers[0][0]}")

# Calcular acurácia
print("\nAnálise de acurácia:")
if usar_modelo_menor:
    correct = np.sum(predicted_numbers.flatten() == val_targets)
    accuracy = correct / len(val_targets)
    print(f"Acurácia nas previsões: {accuracy*100:.2f}%")
else:
    # Apenas indicar que a análise de acurácia não está disponível no modelo original
    print("Análise de acurácia não disponível para o modelo original")

# Comparar com acurácia esperada para previsão aleatória
random_accuracy = 1/37  # Probabilidade de acertar aleatoriamente (0-36)
print(f"Acurácia esperada para previsão aleatória: {random_accuracy*100:.2f}%")

print("============================================================")
print("Créditos:")
print("Corvus Codex - https://github.com/CorvusCodex/RouletteAi")
print("Adaptação para MongoDB por RunCash")
print("============================================================")

# Prevent the window from closing immediately
input('Pressione ENTER para sair') 