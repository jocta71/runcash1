import numpy as np
import os
import sys
from datetime import datetime, timedelta
import pymongo
try:
    from art import text2art
except ImportError:
    print("Instalando biblioteca art...")
    os.system('pip install art')
    from art import text2art

# Verificar disponibilidade de TensorFlow e importar apenas se disponível
try:
    import tensorflow as tf
    from tensorflow import keras
    from keras import layers
    TENSORFLOW_AVAILABLE = True
    print("TensorFlow disponível, usando modelo neural")
except ImportError:
    TENSORFLOW_AVAILABLE = False
    print("TensorFlow não disponível, usando modelo estatístico")

ascii_art = text2art("RouletteAi")

print("============================================================")
print("RouletteAi - Versão Otimizada para RunCash")
print("Original por: Corvus Codex")
print("Github: https://github.com/CorvusCodex/RouletteAi")
print("Adaptação para integração com MongoDB")
print("============================================================")

print(ascii_art)
print("Roulette prediction artificial intelligence")

# Configurações MongoDB
MONGODB_URI = os.environ.get("MONGODB_URI") or "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash"
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME") or "runcash"

# Perguntar por modo leve
modo_leve = input("Usar modo leve? (recomendado para computadores com menos recursos) [S/n]: ").lower() != 'n'

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

min_registros = 20 if modo_leve else 50
if len(resultados) < min_registros:
    print(f"Poucos dados para treinar o modelo. É necessário pelo menos {min_registros} registros.")
    sys.exit(1)

# Extrair apenas os números para o treinamento
numeros = [doc[campo_numero] for doc in resultados]

# Carregar dados como um array numpy
data = np.array(numeros)

# Filtrar apenas números válidos da roleta (0-36)
data = data[(data >= 0) & (data <= 36)]
print(f"Após filtrar números inválidos: {len(data)} números")

# Definir o tamanho da sequência de entrada
sequence_length = 5 if modo_leve else 10
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

if TENSORFLOW_AVAILABLE:
    # Definir o número de características como 1, seguindo a ideia original
    num_features = 1

    # Criar modelo, mas com tamanhos reduzidos para economizar memória
    print("Criando modelo de IA...")
    if modo_leve:
        embedding_dim = 64
        lstm_units = 128
        epochs_default = 20
    else:
        embedding_dim = 256
        lstm_units = 512  
        epochs_default = 50

    # Configurar TensorFlow para economizar memória
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
            print("Configuração de memória da GPU concluída")
        except RuntimeError as e:
            print(f"Erro na configuração da GPU: {e}")

    # Criar modelo com tamanhos reduzidos
    model = keras.Sequential([
        layers.Embedding(input_dim=max_value+1, output_dim=embedding_dim),
        layers.LSTM(lstm_units),
        layers.Dense(37, activation='softmax')  # 37 classes (0-36)
    ])

    # Compilar modelo
    model.compile(
        loss='sparse_categorical_crossentropy',
        optimizer='adam',
        metrics=['accuracy']
    )

    print("Resumo do modelo:")
    model.summary()

    # Parâmetros de treinamento, permitindo personalização
    epochs = int(input(f"Número de épocas para treinamento (padrão: {epochs_default}): ") or f"{epochs_default}")

    print("Iniciando treinamento...")
    history = model.fit(
        train_data, train_targets,
        validation_data=(val_data, val_targets),
        epochs=epochs,
        verbose=1,
        batch_size=32
    )

    print("Realizando previsões...")
    # Fazer previsões para os próximos números
    print("\nPrevisão para os próximos números:")
    last_sequence = data[-sequence_length:].reshape(1, sequence_length)
    print(f"Últimos {sequence_length} números: {last_sequence[0]}")

    predictions = model.predict(last_sequence)
    
    # Obter os 5 números mais prováveis
    top_indices = np.argsort(predictions[0])[-5:][::-1]
    top_probabilities = predictions[0][top_indices]

    print("\nTop 5 previsões para o próximo número:")
    for i, (idx, prob) in enumerate(zip(top_indices, top_probabilities)):
        print(f"#{i+1}: Número {idx} (Probabilidade: {prob*100:.2f}%)")

    # Avaliar o modelo
    loss, accuracy = model.evaluate(val_data, val_targets)
    print(f"Perda: {loss:.4f}, Acurácia: {accuracy*100:.2f}%")

    # Salvar o modelo (opcional)
    if input("Deseja salvar o modelo? (s/N): ").lower() == 's':
        model_name = f"model_roulette_ai_{datetime.now().strftime('%Y%m%d_%H%M%S')}.keras"
        model.save(model_name)
        print(f"Modelo salvo como: {model_name}")
else:
    # Método alternativo baseado em estatística quando TensorFlow não está disponível
    print("\nUsando método estatístico para previsão...")
    
    # Contagem de ocorrências
    ocorrencias = {}
    for i in range(37):  # 0-36
        ocorrencias[i] = np.count_nonzero(data == i)

    # Calcular frequências
    frequencias = {num: count / len(data) for num, count in ocorrencias.items()}
    
    # Análise de padrões após sequências específicas
    padroes_sequencia = {}
    
    # Para cada sequência no conjunto de treinamento, verificar o que vem depois
    for i in range(len(sequences)):
        seq_tuple = tuple(sequences[i])
        if seq_tuple not in padroes_sequencia:
            padroes_sequencia[seq_tuple] = []
        padroes_sequencia[seq_tuple].append(targets[i])
    
    # Previsão baseada na sequência mais recente
    ultima_sequencia = tuple(data[-sequence_length:])
    print(f"Última sequência: {ultima_sequencia}")
    
    # Verificar se a sequência já foi vista antes
    if ultima_sequencia in padroes_sequencia:
        proximos_numeros = padroes_sequencia[ultima_sequencia]
        contagem_proximos = {}
        
        for num in proximos_numeros:
            contagem_proximos[num] = contagem_proximos.get(num, 0) + 1
        
        probabilidades = {num: count / len(proximos_numeros) for num, count in contagem_proximos.items()}
        top_previsoes = sorted(probabilidades.items(), key=lambda x: x[1], reverse=True)[:5]
        
        print("\nTop 5 previsões baseadas em padrões anteriores:")
        for i, (num, prob) in enumerate(top_previsoes):
            print(f"#{i+1}: Número {num} (Probabilidade: {prob*100:.2f}%)")
    else:
        # Se a sequência nunca foi vista, usar frequência geral
        top_frequentes = sorted(frequencias.items(), key=lambda x: x[1], reverse=True)[:5]
        
        print("\nTop 5 previsões baseadas em frequência geral (sequência não encontrada no histórico):")
        for i, (num, freq) in enumerate(top_frequentes):
            print(f"#{i+1}: Número {num} (Frequência: {freq*100:.2f}%)")

    # Calcular estatísticas adicionais
    # Estatísticas por categoria
    zeros = np.count_nonzero(data == 0)
    vermelhos = sum(1 for n in data if n in [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
    pretos = sum(1 for n in data if n in [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35])
    
    print("\nEstatísticas gerais:")
    print(f"Zeros: {zeros} ({zeros/len(data)*100:.2f}%)")
    print(f"Vermelhos: {vermelhos} ({vermelhos/len(data)*100:.2f}%)")
    print(f"Pretos: {pretos} ({pretos/len(data)*100:.2f}%)")

print("\n============================================================")
print("Análise concluída!")
print("============================================================")

print("\nOBSERVAÇÕES IMPORTANTES:")
print("1. A roleta é projetada para ser um jogo de azar genuinamente aleatório")
print("2. Qualquer padrão detectado é mais provável ser coincidência estatística")
print("3. A casa sempre tem vantagem matemática no longo prazo (2.7% na roleta européia)")
print("4. Esta análise é apenas para fins educacionais e de entretenimento")

print("============================================================")
print("Créditos:")
print("Original por Corvus Codex: https://github.com/CorvusCodex/RouletteAi")
print("Adaptado para integração com MongoDB e RunCash")
print("============================================================")

# Impedir que a janela seja fechada imediatamente
input('Pressione ENTER para sair') 