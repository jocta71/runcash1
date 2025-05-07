import os
import sys
import logging
from datetime import datetime, timedelta
from enum import Enum
import pymongo

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
        logging.FileHandler("roulette_terminal_strategy.log")
    ]
)

# Tabela de terminais oficial do RunCash
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

# Definição dos estados da roleta
class RouletteState(Enum):
    MORTO = "MORTO"
    NEUTRAL = "NEUTRAL"
    TRIGGER = "TRIGGER"
    POST_GALE_NEUTRAL = "POST_GALE_NEUTRAL"

class RouletteTerminalStrategy:
    def __init__(self, table_name="Default"):
        """Inicializa a estratégia de terminais"""
        self.table_name = table_name
        self.numbers = []
        self.max_history = 50
        self.last_update = None
        
        # Variáveis da estratégia
        self.current_state = RouletteState.NEUTRAL
        self.trigger_number = -1
        self.previous_trigger_number = -1
        self.win_count = 0
        self.loss_count = 0
        self.suggestion_display = ""
        
        # Estatísticas avançadas
        self.state_history = []
        self.win_history = []
        self.trigger_history = []
        
        # Texto de arte para exibição
        self.ascii_art = text2art("Terminal Strategy")
        print(self.ascii_art)
        print("============================================================")
        print("Estratégia de Terminais para Roleta")
        print("Baseado no strategy_analyzer.py do RunCash")
        print("Usando tabela de terminais oficial")
        print("============================================================")
        
    def connect_to_mongodb(self, uri=None, db_name=None, collection_name="roleta_numeros"):
        """Conecta ao MongoDB para obter dados da roleta"""
        # Configurações padrão
        MONGODB_URI = uri or os.environ.get("MONGODB_URI") or "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash"
        MONGODB_DB_NAME = db_name or os.environ.get("MONGODB_DB_NAME") or "runcash"
        
        try:
            # Conectar ao MongoDB
            print("Conectando ao MongoDB...")
            client = pymongo.MongoClient(MONGODB_URI)
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
            else:
                print("Todas as roletas")
                
            # Campo que contém o número da roleta
            campo_numero = "numero" if "numero" in sample_doc else "number"
            
            resultados = list(collection.find(query).sort(campo_data, 1))  # Ordem cronológica
            print(f"Encontrados {len(resultados)} resultados")
            
            if len(resultados) < 10:
                print("Poucos dados para análise. É necessário pelo menos 10 registros.")
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
        # Processamos em ordem cronológica para manter o estado correto
        for num in reversed(processed_numbers):
            # Salvar estado anterior para histórico
            old_state = self.current_state
            old_trigger = self.trigger_number
            
            # Processar número
            self.process_number(num)
            
            # Registrar na história
            self.state_history.append(self.current_state.value)
            self.trigger_history.append(old_trigger)
            
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
                self.win_history.append(True)
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
                self.win_history.append(True)
            else:
                # Derrota!
                logging.info(f"[{self.table_name}] Derrota! {number} não está nos terminais de {self.previous_trigger_number}")
                self.loss_count += 1
                self.win_history.append(False)
                
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
            # Pegando os terminais para exibição
            terminals = TERMINAL_TABLE[self.trigger_number]
            self.suggestion_display = ", ".join(map(str, terminals))
        else:
            self.suggestion_display = ""
    
    def get_current_suggestions(self):
        """
        Retorna números sugeridos para apostar com base no estado atual
        """
        suggestions = []
        
        if self.current_state == RouletteState.TRIGGER and self.trigger_number in TERMINAL_TABLE:
            suggestions = TERMINAL_TABLE[self.trigger_number]
        elif self.current_state == RouletteState.POST_GALE_NEUTRAL and self.previous_trigger_number in TERMINAL_TABLE:
            suggestions = TERMINAL_TABLE[self.previous_trigger_number]
            
        return suggestions
        
    def display_analysis(self):
        """Exibe análise completa da estratégia"""
        if len(self.numbers) == 0:
            print("Nenhum número no histórico para análise.")
            return
            
        print("\n============================================================")
        print("ANÁLISE DA ESTRATÉGIA DE TERMINAIS")
        print("============================================================")
        
        # Mostrar últimos números
        last_nums = self.numbers[:10]
        print(f"Últimos 10 números: {', '.join(map(str, last_nums))}")
        
        # Status da estratégia
        print("\nStatus da estratégia de estados:")
        print(f"Estado atual: {self.current_state.value}")
        print(f"Número gatilho: {self.trigger_number}")
        print(f"Gatilho anterior: {self.previous_trigger_number}")
        
        # Mostrar terminais relacionados
        if self.trigger_number in TERMINAL_TABLE:
            print(f"Terminais do gatilho atual: {', '.join(map(str, TERMINAL_TABLE[self.trigger_number]))}")
        
        if self.previous_trigger_number in TERMINAL_TABLE:
            print(f"Terminais do gatilho anterior: {', '.join(map(str, TERMINAL_TABLE[self.previous_trigger_number]))}")
        
        # Estatísticas
        print(f"\nHistórico de resultados:")
        print(f"Vitórias: {self.win_count}, Derrotas: {self.loss_count}")
        
        if (self.win_count + self.loss_count) > 0:
            win_rate = self.win_count / (self.win_count + self.loss_count) * 100
            print(f"Taxa de acerto: {win_rate:.2f}%")
            
        # Previsão para o próximo número
        print("\nNúmeros sugeridos para apostar:")
        suggestions = self.get_current_suggestions()
        
        if suggestions:
            print(f"Números: {', '.join(map(str, suggestions))}")
        else:
            print("Nenhuma sugestão disponível no estado atual.")
            
        print("\n============================================================")
        
    def run_interactive(self):
        """Executa em modo interativo"""
        print("Iniciando estratégia de terminais em modo interativo...")
        
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
                
        if not data_loaded or len(self.numbers) < 3:
            print("Dados insuficientes para análise. Necessário pelo menos 3 números.")
            return
            
        # Menu interativo
        while True:
            print("\n============================================================")
            print("MENU - Estratégia de Terminais")
            print("============================================================")
            print("1. Ver análise e sugestões")
            print("2. Adicionar novo número")
            print("3. Simulação com novos números")
            print("4. Resetar estratégia")
            print("5. Sair")
            
            choice = input("\nEscolha uma opção: ")
            
            if choice == '1':
                self.display_analysis()
            elif choice == '2':
                new_num = input("Digite o novo número da roleta (0-36): ")
                try:
                    num = int(new_num)
                    if 0 <= num <= 36:
                        self.add_number(num)
                        print(f"Número {num} adicionado e processado.")
                        self.display_analysis()
                    else:
                        print("Número inválido! Use valores entre 0 e 36.")
                except ValueError:
                    print("Entrada inválida! Digite um número inteiro.")
            elif choice == '3':
                self.run_simulation()
            elif choice == '4':
                confirm = input("Tem certeza que deseja resetar a estratégia? (s/N): ").lower()
                if confirm == 's':
                    self.__init__(self.table_name)
                    print("Estratégia resetada com sucesso.")
            elif choice == '5':
                print("Encerrando estratégia de terminais. Até breve!")
                break
            else:
                print("Opção inválida! Por favor, escolha de 1 a 5.")
    
    def run_simulation(self):
        """Simula a estratégia com uma sequência de números"""
        print("\n============================================================")
        print("SIMULAÇÃO DA ESTRATÉGIA")
        print("============================================================")
        print("Digite uma sequência de números para simular (separados por espaço)")
        print("Exemplo: 24 15 5 1 8 7")
        
        # Cria uma cópia da estratégia atual para não afetar o estado real
        simulation = RouletteTerminalStrategy(self.table_name + "_sim")
        
        # Carregar números
        sim_data = input("\nDigite os números: ")
        numbers = []
        try:
            numbers = [int(n) for n in sim_data.split() if n.isdigit() and 0 <= int(n) <= 36]
        except ValueError:
            print("Entrada inválida! Use apenas números entre 0 e 36.")
            return
            
        if not numbers:
            print("Nenhum número válido fornecido.")
            return
            
        # Processar números um a um para mostrar a evolução dos estados
        print("\nResultado da simulação:")
        print("============================================================")
        
        for i, num in enumerate(numbers):
            old_state = simulation.current_state
            old_trigger = simulation.trigger_number
            old_prev_trigger = simulation.previous_trigger_number
            
            # Processar o número
            simulation.add_number(num)
            
            # Mostrar resultado para este número
            print(f"Passo {i+1}: Número {num}")
            print(f"  Estado anterior: {old_state.value}")
            
            if old_state == RouletteState.TRIGGER:
                hit = simulation._check_number_in_terminals(num, old_trigger)
                print(f"  Gatilho: {old_trigger}")
                print(f"  Verificação: {num} {'ESTÁ' if hit else 'NÃO ESTÁ'} nos terminais de {old_trigger}")
            elif old_state == RouletteState.POST_GALE_NEUTRAL:
                hit = simulation._check_number_in_terminals(num, old_prev_trigger)
                print(f"  Gatilho anterior: {old_prev_trigger}")
                print(f"  Verificação: {num} {'ESTÁ' if hit else 'NÃO ESTÁ'} nos terminais de {old_prev_trigger}")
                if hit:
                    print("  Resultado: VITÓRIA após gale")
                else:
                    print("  Resultado: DERROTA")
                
            print(f"  Novo estado: {simulation.current_state.value}")
            print()
            
        # Resumo final
        print("============================================================")
        print(f"Total de vitórias: {simulation.win_count}")
        print(f"Total de derrotas: {simulation.loss_count}")
        
        if (simulation.win_count + simulation.loss_count) > 0:
            win_rate = simulation.win_count / (simulation.win_count + simulation.loss_count) * 100
            print(f"Taxa de acerto: {win_rate:.2f}%")
            
        print("============================================================")
        
# Executar diretamente se for o script principal
if __name__ == "__main__":
    strategy = RouletteTerminalStrategy()
    strategy.run_interactive() 