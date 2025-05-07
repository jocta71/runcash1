import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers
import pymongo
import os
import sys
from datetime import datetime, timedelta
from enum import Enum
import logging

try:
    from art import text2art
except ImportError:
    os.system('pip install art')
    from art import text2art

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("roulette_ai_strategy.log")
    ]
)

# Tabela de terminais para cada número da roleta
# Atualizada para usar a mesma tabela do terminal_table.py
TERMINAL_TABLE = {
    0: [0, 3, 6, 10, 13, 16, 20, 23, 26, 30, 33, 36],
    1: [1, 4, 7, 11, 14, 17, 21, 24, 27, 31, 34],
    2: [0, 2, 5, 8, 12, 15, 18, 22, 25, 28, 32, 35],
    3: [0, 3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36],
    4: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    5: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
    6: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0],
    7: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    8: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    9: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
    10: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    11: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    12: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    13: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    14: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    15: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
    16: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0],
    17: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    18: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    19: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
    20: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    21: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    22: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    23: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    24: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    25: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
    26: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0],
    27: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    28: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    29: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
    30: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    31: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    32: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    33: [1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23, 30, 31, 32, 33, 0],
    34: [4, 7, 8, 10, 14, 17, 18, 20, 24, 27, 28, 30, 34, 0],
    35: [5, 6, 9, 10, 15, 16, 19, 20, 25, 26, 29, 30, 35, 36, 0],
    36: [3, 6, 9, 10, 13, 16, 19, 20, 23, 26, 29, 30, 33, 36, 0]
}

# Remover o número 37 de todas as listas já que a roleta vai de 0-36
for key in TERMINAL_TABLE:
    if 37 in TERMINAL_TABLE[key]:
        TERMINAL_TABLE[key].remove(37)

# Definição dos estados da roleta (igual ao strategy_analyzer.py)
class RouletteState(Enum):
    MORTO = "MORTO"
    NEUTRAL = "NEUTRAL"
    TRIGGER = "TRIGGER"
    POST_GALE_NEUTRAL = "POST_GALE_NEUTRAL"

class RouletteAiStrategy:
    def __init__(self, table_name="Default"):
        """Inicializa o modelo RouletteAi com a estratégia de estados"""
        self.table_name = table_name
        self.numbers = []
        self.max_history = 50  # Manteremos mais números para treinar o modelo
        self.last_update = None
        
        # Variáveis da estratégia
        self.current_state = RouletteState.NEUTRAL
        self.trigger_number = -1
        self.previous_trigger_number = -1
        self.win_count = 0
        self.loss_count = 0
        self.suggestion_display = ""
        
        # Variáveis do modelo
        self.model = None
        self.sequence_length = 10
        self.model_trained = False
        
        # Estratégia personalizada
        self.use_terminals = True  # Se True, usa a estratégia de terminais
        self.use_ai_predictions = True  # Se True, usa previsões do modelo
        
        # Pesos das estratégias
        self.terminal_weight = 0.7  # Peso para a estratégia de terminais (70%)
        self.ai_weight = 0.3        # Peso para a estratégia de IA (30%)
        
        # Texto de arte para exibição
        self.ascii_art = text2art("RouletteAi Strategy")
        print(self.ascii_art)
        print("============================================================")
        print("RouletteAi com Estratégia de Estados")
        print("Baseado no projeto RouletteAi e strategy_analyzer.py")
        print("Usando tabela de terminais oficial do RunCash")
        print("============================================================")
        
    def connect_to_mongodb(self, uri=None, db_name=None, collection_name="roleta_numeros"):
        """Conecta ao MongoDB para obter dados da roleta"""
        # Configurações padrão
        MONGODB_URI = uri or os.environ.get("MONGODB_URI") or "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash"
        MONGODB_DB_NAME = db_name or os.environ.get("MONGODB_DB_NAME") or "runcash"
        ROLETAS_DB_NAME = os.environ.get("ROLETAS_MONGODB_DB_NAME") or "roletas_db"
        
        try:
            # Conectar ao MongoDB
            print("Conectando ao MongoDB...")
            client = pymongo.MongoClient(MONGODB_URI)
            
            # Tentar usar o banco de roletas_db primeiro
            use_roletas_db = input("Usar o banco de dados otimizado roletas_db? (S/n): ").lower() != 'n'
            
            if use_roletas_db:
                # Verificar se o banco roletas_db existe
                if ROLETAS_DB_NAME in client.list_database_names():
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
                                    
                                    if len(resultados) < 20:
                                        print("Poucos dados para análise. É necessário pelo menos 20 registros.")
                                        return False
                                    
                                    # Extrair apenas os números para o treinamento
                                    numeros = [doc.get("numero") for doc in resultados if doc.get("numero") is not None]
                                    
                                    # Adicionar números ao histórico
                                    self.add_numbers(numeros)
                                    print(f"Dados carregados com sucesso: {len(numeros)} números")
                                    self.table_name = roleta_escolhida['nome']  # Definir nome da tabela
                                    return True
                                else:
                                    print(f"Coleção {collection_id} não encontrada. Usando banco principal como fallback.")
                            elif escolha_num != 0:
                                print("Opção inválida. Usando banco principal como fallback.")
                        except ValueError:
                            print("Opção inválida. Usando banco principal como fallback.")
                else:
                    print(f"Banco de dados {ROLETAS_DB_NAME} não encontrado. Usando banco principal.")
            
            # Se chegou aqui, usar o banco principal
            db = client[MONGODB_DB_NAME]
            collection = db[collection_name]
            
            # Parâmetros para busca
            roleta_nome = input("Nome da roleta (deixe em branco para todas): ").strip() or None
            dias_atras = int(input("Quantos dias de dados buscar (padrão: 7): ") or "7")
            
            # Obter um documento de amostra para identificar os campos
            sample_doc = collection.find_one()
            if not sample_doc:
                print("Erro: Não foi possível encontrar nenhum documento na coleção.")
                return False
                
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
                self.table_name = roleta_nome  # Definir nome da tabela
            else:
                print("Todas as roletas")
            
            # Campo que contém o número da roleta
            campo_numero = "numero" if "numero" in sample_doc else "number"
            
            resultados = list(collection.find(query).sort(campo_data, 1))  # Ordem cronológica
            print(f"Encontrados {len(resultados)} resultados")
            
            if len(resultados) < 20:
                print("Poucos dados para análise. É necessário pelo menos 20 registros.")
                return False
                
            # Extrair apenas os números para o treinamento
            numeros = [doc[campo_numero] for doc in resultados]
            
            # Adicionar números ao histórico
            self.add_numbers(numeros)
            print(f"Dados carregados com sucesso: {len(numeros)} números")
            return True
            
        except Exception as e:
            print(f"Erro ao conectar ao MongoDB: {e}")
            return False
            
    def add_number(self, number):
        """Adiciona um único número e o processa"""
        return self.add_numbers([number])
        
    def add_numbers(self, new_numbers):
        """Adiciona novos números ao histórico e mantém apenas os mais recentes"""
        if not new_numbers:
            return False
            
        # Adiciona números apenas se forem válidos
        changed = False
        processed_numbers = []
        for num in new_numbers:
            try:
                # Converta para inteiro, e só adicione se for um número válido (0-36)
                num_int = int(num)
                if 0 <= num_int <= 36:
                    processed_numbers.append(num_int)
                    changed = True
            except (ValueError, TypeError):
                # Ignora valores que não podem ser convertidos para inteiros
                continue
        
        if not changed:
            return False
            
        # Adiciona novos números ao início da lista
        self.numbers = processed_numbers + self.numbers
        
        # Limita o tamanho do histórico
        self.numbers = self.numbers[:self.max_history]
        
        # Processa os novos números na estratégia de estado
        # Processamos apenas o último número para não duplicar processamento
        if processed_numbers:
            self.process_number(processed_numbers[0])
            
        self.last_update = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return True
        
    def process_number(self, number):
        """
        Processa um novo número seguindo a máquina de estados da estratégia
        """
        old_state = self.current_state
        logging.info(f"[{self.table_name}] Processando número: {number} | Estado atual: {self.current_state.value}")
        
        if self.current_state == RouletteState.MORTO:
            # Reseta para NEUTRAL e não continua o processamento
            self.current_state = RouletteState.NEUTRAL
            logging.info(f"[{self.table_name}] Resetando para NEUTRAL após MORTO")
            return
            
        if self.current_state == RouletteState.NEUTRAL:
            # Define o número como gatilho e muda o estado para TRIGGER
            self.trigger_number = number
            self.current_state = RouletteState.TRIGGER
            
            # Atualiza a sugestão de exibição com os terminais
            self._update_suggestion_display()
            
        elif self.current_state == RouletteState.TRIGGER:
            # Verifica se o número está nos terminais do gatilho
            if self._check_number_in_terminals(number, self.trigger_number):
                # Vitória!
                logging.info(f"[{self.table_name}] Vitória! {number} está nos terminais de {self.trigger_number}")
                self.win_count += 1
                self.current_state = RouletteState.MORTO
            else:
                # Falha, vamos para POST_GALE_NEUTRAL
                self.previous_trigger_number = self.trigger_number
                self.current_state = RouletteState.POST_GALE_NEUTRAL
                logging.info(f"[{self.table_name}] Falha! {number} não está nos terminais de {self.trigger_number}")
                
        elif self.current_state == RouletteState.POST_GALE_NEUTRAL:
            # Verifica se o número está nos terminais do gatilho anterior
            if self._check_number_in_terminals(number, self.previous_trigger_number):
                # Vitória!
                logging.info(f"[{self.table_name}] Vitória após gale! {number} está nos terminais de {self.previous_trigger_number}")
                self.win_count += 1
            else:
                # Derrota!
                logging.info(f"[{self.table_name}] Derrota! {number} não está nos terminais de {self.previous_trigger_number}")
                self.loss_count += 1
                
            # Em ambos os casos, vamos para MORTO
            self.current_state = RouletteState.MORTO
            
        if old_state != self.current_state:
            logging.info(f"[{self.table_name}] Estado alterado: {old_state.value} -> {self.current_state.value}")
    
    def _check_number_in_terminals(self, number, trigger):
        """Verifica se um número está nos terminais do gatilho"""
        if trigger in TERMINAL_TABLE:
            return number in TERMINAL_TABLE[trigger]
        return False
        
    def _update_suggestion_display(self):
        """Atualiza a sugestão de exibição com os terminais do número gatilho"""
        if self.trigger_number in TERMINAL_TABLE:
            # Pegando os 3 primeiros terminais para exibição
            terminals = TERMINAL_TABLE[self.trigger_number][:3]
            self.suggestion_display = ", ".join(map(str, terminals))
        else:
            self.suggestion_display = ""
            
    def build_and_train_model(self, usar_modelo_menor=True):
        """Constrói e treina o modelo de IA para previsão"""
        if len(self.numbers) < self.sequence_length + 10:
            print(f"Dados insuficientes para treinar o modelo. Necessário mais de {self.sequence_length + 10} números.")
            return False
        
        # Converter dados para numpy array
        data = np.array(self.numbers)
        
        # Criar sequências
        sequences = np.array([data[i:i+self.sequence_length] for i in range(len(data)-self.sequence_length)])
        targets = data[self.sequence_length:]
        
        # Dividir em conjuntos de treino e validação
        split_idx = int(0.8 * len(sequences))
        train_sequences = sequences[:split_idx]
        train_targets = targets[:split_idx]
        val_sequences = sequences[split_idx:]
        val_targets = targets[split_idx:]
        
        print(f"Conjunto de treino: {len(train_sequences)} sequências")
        print(f"Conjunto de validação: {len(val_sequences)} sequências")
        
        # Definir dimensões do modelo
        max_value = 36  # Valor máximo na roleta
        
        # Criar modelo
        self.model = keras.Sequential()
        
        if usar_modelo_menor:
            # Modelo menor e mais eficiente
            self.model.add(layers.Embedding(input_dim=max_value+1, output_dim=64))
            self.model.add(layers.LSTM(128))
            self.model.add(layers.Dense(37, activation='softmax'))  # 37 classes (0-36)
        else:
            # Modelo maior (similar ao original)
            self.model.add(layers.Embedding(input_dim=max_value+1, output_dim=256))
            self.model.add(layers.LSTM(512))
            self.model.add(layers.Dense(37, activation='softmax'))
            
        # Compilar modelo
        self.model.compile(
            loss='sparse_categorical_crossentropy',
            optimizer='adam',
            metrics=['accuracy']
        )
        
        print("Resumo do modelo:")
        self.model.summary()
        
        # Número de épocas
        epochs = int(input("Número de épocas para treinamento (padrão: 20): ") or "20")
        
        # Treinar modelo
        print("Iniciando treinamento...")
        history = self.model.fit(
            train_sequences, train_targets,
            validation_data=(val_sequences, val_targets),
            epochs=epochs,
            verbose=1,
            batch_size=32
        )
        
        # Avaliar modelo
        loss, accuracy = self.model.evaluate(val_sequences, val_targets)
        print(f"Perda: {loss:.4f}, Acurácia: {accuracy*100:.2f}%")
        
        # Comparar com acurácia aleatória
        random_accuracy = 1/37
        print(f"Acurácia aleatória esperada: {random_accuracy*100:.2f}%")
        
        self.model_trained = True
        return True
        
    def predict_next_number(self):
        """Faz previsão do próximo número da roleta"""
        if not self.model_trained:
            print("Modelo não treinado. Não é possível fazer previsões.")
            return None, []
            
        if len(self.numbers) < self.sequence_length:
            print(f"Histórico insuficiente. Necessários pelo menos {self.sequence_length} números.")
            return None, []
            
        # Pegar últimos números para previsão
        last_sequence = np.array(self.numbers[:self.sequence_length])
        input_data = last_sequence.reshape(1, self.sequence_length)
        
        # Fazer previsão
        predictions = self.model.predict(input_data)[0]
        
        # Obter número mais provável
        next_number = np.argmax(predictions)
        
        # Obter top 5 probabilidades
        top5_indices = np.argsort(predictions)[-5:][::-1]
        top5_probs = [(int(idx), float(predictions[idx])*100) for idx in top5_indices]
        
        return next_number, top5_probs
        
    def get_combined_prediction(self):
        """Combina previsão do modelo com estratégia de terminais"""
        prediction_output = []
        
        # 1. Obter previsão do modelo de IA
        ai_prediction, top5_probs = self.predict_next_number()
        
        # 2. Obter sugestão da estratégia de terminais
        strategy_suggestion = []
        if self.current_state == RouletteState.TRIGGER and self.trigger_number in TERMINAL_TABLE:
            strategy_suggestion = TERMINAL_TABLE[self.trigger_number]
        elif self.current_state == RouletteState.POST_GALE_NEUTRAL and self.previous_trigger_number in TERMINAL_TABLE:
            strategy_suggestion = TERMINAL_TABLE[self.previous_trigger_number]
            
        # 3. Combinar as previsões
        # Usar os pesos definidos nas variáveis da classe
        ai_weight = self.ai_weight if self.use_ai_predictions else 0
        terminal_weight = self.terminal_weight if self.use_terminals else 0
        
        # Normalizar pesos
        total_weight = ai_weight + terminal_weight
        if total_weight > 0:
            ai_weight /= total_weight
            terminal_weight /= total_weight
        else:
            # Se nenhuma estratégia ativa, usar apenas previsão do modelo
            ai_weight = 1
            terminal_weight = 0
            
        # Criar dicionário combinado de números e pontuações
        combined_scores = {}
        
        # Adicionar pontuações do modelo de IA
        if ai_weight > 0 and top5_probs:
            for num, prob in top5_probs:
                combined_scores[num] = ai_weight * (prob / 100)
                
        # Adicionar pontuações da estratégia de terminais
        if terminal_weight > 0 and strategy_suggestion:
            for num in strategy_suggestion:
                if num in combined_scores:
                    combined_scores[num] += terminal_weight / len(strategy_suggestion)
                else:
                    combined_scores[num] = terminal_weight / len(strategy_suggestion)
                    
        # Ordenar por pontuação combinada
        sorted_predictions = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Retornar resultados
        return {
            "ai_prediction": ai_prediction,
            "top5_ai": top5_probs,
            "strategy_state": self.current_state.value,
            "strategy_suggestion": strategy_suggestion,
            "combined_predictions": sorted_predictions[:5]
        }
        
    def display_prediction_analysis(self):
        """Exibe análise completa e previsões"""
        if len(self.numbers) == 0:
            print("Nenhum número no histórico para análise.")
            return
            
        print("\n============================================================")
        print("ANÁLISE E PREVISÃO DA ROLETA")
        print("============================================================")
        
        # Mostrar últimos números
        last_nums = self.numbers[:10]
        print(f"Últimos 10 números: {', '.join(map(str, last_nums))}")
        
        # Status da estratégia
        print("\nStatus da estratégia de estados:")
        print(f"Estado atual: {self.current_state.value}")
        print(f"Número gatilho: {self.trigger_number}")
        print(f"Gatilho anterior: {self.previous_trigger_number}")
        print(f"Sugestão atual: {self.suggestion_display}")
        print(f"Vitórias: {self.win_count}, Derrotas: {self.loss_count}")
        
        # Calcular taxa de acerto
        if (self.win_count + self.loss_count) > 0:
            win_rate = self.win_count / (self.win_count + self.loss_count) * 100
            print(f"Taxa de acerto: {win_rate:.2f}%")
            
        # Mostrar pesos das estratégias
        print(f"\nPesos das estratégias:")
        print(f"Terminais: {self.terminal_weight*100:.0f}% {'(ativo)' if self.use_terminals else '(inativo)'}")
        print(f"IA: {self.ai_weight*100:.0f}% {'(ativo)' if self.use_ai_predictions else '(inativo)'}")
        
        # Previsões
        if self.model_trained:
            print("\nPrevisões:")
            result = self.get_combined_prediction()
            
            # Previsão do modelo de IA
            print("\nModelo de IA:")
            print(f"Próximo número mais provável: {result['ai_prediction']}")
            print("Top 5 probabilidades:")
            for i, (num, prob) in enumerate(result['top5_ai']):
                print(f"  #{i+1}: Número {num} - {prob:.2f}%")
                
            # Sugestão da estratégia de terminais
            print("\nEstatégia de terminais:")
            if result['strategy_suggestion']:
                print(f"Números sugeridos: {', '.join(map(str, result['strategy_suggestion']))}")
            else:
                print("Nenhuma sugestão disponível no estado atual.")
                
            # Previsão combinada
            print("\nPrevisão combinada (IA + Terminais):")
            for i, (num, score) in enumerate(result['combined_predictions']):
                print(f"  #{i+1}: Número {num} - Score: {score:.4f}")
        else:
            print("\nModelo ainda não treinado. Treine o modelo para obter previsões.")
            
        print("\n============================================================")
        
    def run_interactive(self):
        """Executa em modo interativo"""
        print("Iniciando RouletteAi Strategy em modo interativo...")
        
        # Carregar dados iniciais
        data_loaded = False
        load_option = input("Carregar dados do MongoDB? (S/n): ").lower()
        if load_option != 'n':
            data_loaded = self.connect_to_mongodb()
            
        if not data_loaded:
            print("Carregando dados manualmente...")
            manual_data = input("Digite números da roleta separados por espaço: ")
            numbers = [int(n) for n in manual_data.split() if n.isdigit() and 0 <= int(n) <= 36]
            if numbers:
                self.add_numbers(numbers)
                data_loaded = True
                
        if not data_loaded or len(self.numbers) < 20:
            print("Dados insuficientes para análise. Necessário pelo menos 20 números.")
            return
            
        # Treinar modelo
        train_option = input("Treinar modelo de IA agora? (S/n): ").lower()
        if train_option != 'n':
            self.build_and_train_model()
            
        # Configurar estratégia
        print("\nConfigurações da estratégia:")
        self.configure_strategy()
        
        # Menu interativo
        while True:
            print("\n============================================================")
            print("MENU - RouletteAi Strategy")
            print("============================================================")
            print("1. Ver análise e previsões")
            print("2. Adicionar novo número")
            print("3. Treinar/atualizar modelo")
            print("4. Configurar estratégia")
            print("5. Sair")
            
            choice = input("\nEscolha uma opção: ")
            
            if choice == '1':
                self.display_prediction_analysis()
            elif choice == '2':
                new_num = input("Digite o novo número da roleta (0-36): ")
                try:
                    num = int(new_num)
                    if 0 <= num <= 36:
                        self.add_number(num)
                        print(f"Número {num} adicionado e processado.")
                        self.display_prediction_analysis()
                    else:
                        print("Número inválido! Use valores entre 0 e 36.")
                except ValueError:
                    print("Entrada inválida! Digite um número inteiro.")
            elif choice == '3':
                self.build_and_train_model()
            elif choice == '4':
                self.configure_strategy()
            elif choice == '5':
                print("Encerrando RouletteAi Strategy. Até breve!")
                break
            else:
                print("Opção inválida! Por favor, escolha de 1 a 5.")
    
    def configure_strategy(self):
        """Configurar estratégias e seus pesos"""
        print("\nConfigurar estratégia:")
        
        # Ativar/desativar estratégias
        use_ai = input("Usar previsões do modelo de IA? (S/n): ").lower()
        self.use_ai_predictions = use_ai != 'n'
        
        use_term = input("Usar estratégia de terminais? (S/n): ").lower()
        self.use_terminals = use_term != 'n'
        
        # Se ambas estratégias estão ativas, definir pesos
        if self.use_ai_predictions and self.use_terminals:
            try:
                terminal_percent = input(f"Porcentagem para estratégia de terminais (0-100, atual: {self.terminal_weight*100:.0f}): ")
                if terminal_percent.strip():
                    terminal_percent = float(terminal_percent)
                    if 0 <= terminal_percent <= 100:
                        self.terminal_weight = terminal_percent / 100
                        self.ai_weight = 1 - self.terminal_weight
                    else:
                        print("Valor deve estar entre 0 e 100. Mantendo configuração atual.")
            except ValueError:
                print("Valor inválido. Mantendo configuração atual.")
                
        # Mostrar configuração final        
        print("\nConfiguração atualizada:")
        print(f"Estratégia de terminais: {'Ativa' if self.use_terminals else 'Inativa'}")
        print(f"Modelo de IA: {'Ativo' if self.use_ai_predictions else 'Inativo'}")
        
        if self.use_terminals and self.use_ai_predictions:
            print(f"Peso terminais: {self.terminal_weight*100:.0f}%")
            print(f"Peso IA: {self.ai_weight*100:.0f}%")

# Executar diretamente se for o script principal
if __name__ == "__main__":
    strategy = RouletteAiStrategy()
    strategy.run_interactive() 