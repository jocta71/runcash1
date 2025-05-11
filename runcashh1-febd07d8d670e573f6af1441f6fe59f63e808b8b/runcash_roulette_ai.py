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
    print("Instalando biblioteca art...")
    os.system('pip install art')
    from art import text2art

ascii_art = text2art("RouletteAi")

print("============================================================")
print("RouletteAi - Adaptado para RunCash")
print("Original por: Corvus Codex")
print("Github: https://github.com/CorvusCodex/RouletteAi")
print("Adaptação para integração com MongoDB")
print("============================================================")

print(ascii_art)
print("Roulette prediction artificial intelligence")

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

# Carregar dados como um array numpy
data = np.array(numeros)

# Filtrar apenas números válidos da roleta (0-36)
data = data[(data >= 0) & (data <= 36)]
print(f"Após filtrar números inválidos: {len(data)} números")

# Definir o tamanho da sequência de entrada, como no original
sequence_length = 10
print(f"Tamanho da sequência de entrada: {sequence_length}")

# Verificar se temos dados suficientes
if len(data) <= sequence_length:
    print(f"Dados insuficientes. Necessário mais de {sequence_length} registros após filtragem.")
    sys.exit(1)

# Criar sequências de comprimento fixo a partir dos dados
sequences = np.array([data[i:i+sequence_length] for i in range(len(data)-sequence_length)])
print(f"Número de sequências: {len(sequences)}")

# Criar valores alvo que são o próximo número após cada sequência
targets = data[sequence_length:]
print(f"Número de alvos: {len(targets)}")

# Dividir os dados em conjuntos de treino e validação
split_index = int(0.8*len(sequences))
train_data = sequences[:split_index]
train_targets = targets[:split_index]
val_data = sequences[split_index:]
val_targets = targets[split_index:]

print(f"Conjunto de treino: {len(train_data)} sequências")
print(f"Conjunto de validação: {len(val_data)} sequências")

# Obter o valor máximo nos dados
max_value = np.max(data)
print(f"Valor máximo encontrado: {max_value}")

# Definir o número de características como 1, exatamente como no original
num_features = 1

# Criar modelo exatamente igual ao original
print("Criando modelo...")
model = keras.Sequential()
model.add(layers.Embedding(input_dim=max_value+1, output_dim=51200))
model.add(layers.LSTM(104800))
model.add(layers.Dense(num_features, activation='softmax'))

model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])

print("Resumo do modelo:")
model.summary()

# Parâmetros de treinamento, permitindo personalização
epochs = int(input("Número de épocas para treinamento (padrão: 100): ") or "100")

print("Iniciando treinamento...")
history = model.fit(
    train_data, train_targets,
    validation_data=(val_data, val_targets),
    epochs=epochs,
    verbose=1,
    batch_size=32
)

print("Realizando previsões...")
predictions = model.predict(val_data)

# Processar previsões exatamente como no original
indices = np.argsort(predictions, axis=1)[:, -num_features:]
predicted_numbers = np.take_along_axis(val_data, indices, axis=1)

print("============================================================")
print("Número previsto:")
for numbers in predicted_numbers[:1]:
    print(', '.join(map(str, numbers)))

# Salvar o modelo para uso futuro
model_name = f"model_roulette_ai_{datetime.now().strftime('%Y%m%d_%H%M%S')}.keras"
model.save(model_name)
print(f"Modelo salvo como: {model_name}")

# Fazer previsão para os próximos números
print("\nPrevisão para os próximos números:")
last_sequence = data[-sequence_length:].reshape(1, sequence_length)
print(f"Últimos {sequence_length} números: {last_sequence[0]}")

next_predictions = model.predict(last_sequence)
next_indices = np.argsort(next_predictions, axis=1)[:, -num_features:]
next_predicted_numbers = np.take_along_axis(last_sequence, next_indices, axis=1)

print("Próximo número previsto:")
for numbers in next_predicted_numbers:
    print(', '.join(map(str, numbers)))

print("============================================================")
print("Análise da acurácia:")

# Calcular acurácia nas previsões de validação
correct_predictions = 0
total_predictions = len(val_targets)

for i in range(len(val_targets)):
    if val_targets[i] in predicted_numbers[i]:
        correct_predictions += 1

accuracy = correct_predictions / total_predictions
print(f"Acurácia das previsões: {accuracy*100:.2f}%")

# Acurácia esperada para uma previsão aleatória
random_accuracy = 1/37  # Probabilidade de acertar aleatoriamente entre 0-36
print(f"Acurácia esperada para previsão aleatória: {random_accuracy*100:.2f}%")

print("============================================================")
print("Créditos:")
print("Original por Corvus Codex: https://github.com/CorvusCodex/RouletteAi")
print("Adaptado para integração com MongoDB e RunCash")
print("============================================================")

# Impedir que a janela seja fechada imediatamente
input('Pressione ENTER para sair') 