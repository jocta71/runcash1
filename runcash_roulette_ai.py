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
ROLETAS_DB_NAME = os.environ.get("ROLETAS_MONGODB_DB_NAME") or "roletas_db"

# Conectar ao MongoDB
print("Conectando ao MongoDB...")
client = pymongo.MongoClient(MONGODB_URI)

# Verificar se queremos usar o banco de dados otimizado
use_roletas_db = input("Usar o banco de dados otimizado roletas_db? (S/n): ").lower() != 'n'

resultados = []
campo_numero = "numero"  # Valor padrão

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
            
        resultados = list(collection.find(query).sort(campo_data, 1))  # Ordem cronológica
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
                                    .sort("timestamp", 1))  # Ordem cronológica
                    
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
                
            resultados = list(collection.find(query).sort(campo_data, 1))  # Ordem cronológica
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
    
    # Obter um documento de amostra para identificar os campos
    sample_doc = collection.find_one()
    if not sample_doc:
        print("Erro: Não foi possível encontrar nenhum documento na coleção.")
        sys.exit(1)
    
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
    
    resultados = list(collection.find(query).sort(campo_data, 1))  # Ordem cronológica

print(f"Encontrados {len(resultados)} resultados")

if len(resultados) < 50:
    print("Poucos dados para treinar o modelo. É necessário pelo menos 50 registros.")
    sys.exit(1)

# Extrair apenas os números para o treinamento
numeros = [doc.get(campo_numero) for doc in resultados if doc.get(campo_numero) is not None]

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