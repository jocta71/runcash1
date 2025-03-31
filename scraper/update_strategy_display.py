#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para atualizar diretamente as coleções do MongoDB com 
diferentes estados de estratégia para exibição no frontend
"""

import sys
import logging
from pymongo import MongoClient, UpdateOne
from datetime import datetime
import random
import json

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Estados possíveis
ESTADOS = ["NEUTRAL", "TRIGGER", "POST_GALE_NEUTRAL", "MORTO"]

def process_strategy_rules(roleta, strategy_rules):
    """
    Processa as regras da estratégia de acordo com os dados da roleta
    e retorna o estado e terminais apropriados
    """
    try:
        # Processar regras da estratégia
        # Este é um processamento básico para demonstração
        # Em um caso real, aqui seria implementada a lógica completa da estratégia
        
        # Exemplo: Se temos uma regra para detectar repetição de números
        ultimos_numeros = roleta.get('numeros', [])[:10]  # Usar os últimos 10 números
        
        # Verificar se as regras têm a estrutura esperada
        if not isinstance(strategy_rules, dict):
            logger.warning(f"Formato de regras inválido: {strategy_rules}")
            return "NEUTRAL", [], None, "Formato de regras inválido"
        
        # Regra de exemplo: verificar se temos repetições em sequência
        if 'detectarRepeticoes' in strategy_rules and strategy_rules['detectarRepeticoes'] and len(ultimos_numeros) >= 3:
            # Verificar repetições nos últimos números
            if len(set(ultimos_numeros[:3])) < 3:  # Se houver repetição entre os últimos 3 números
                # Número com repetição
                num_gatilho = ultimos_numeros[0]
                # Gerar terminais baseados no número do gatilho
                terminais = [(num_gatilho + i) % 10 for i in range(1, 4)]
                terminais = [t if t > 0 else t+1 for t in terminais]  # Garantir que sejam 1-9
                
                return "TRIGGER", terminais, num_gatilho, "Repetição detectada"
        
        # Regra de exemplo: verificar alternância de paridade
        if 'verificarParidade' in strategy_rules and strategy_rules['verificarParidade'] and len(ultimos_numeros) >= 4:
            paridades = [n % 2 for n in ultimos_numeros[:4]]
            if paridades == [0, 1, 0, 1] or paridades == [1, 0, 1, 0]:  # Alternância perfeita
                num_gatilho = ultimos_numeros[0]
                # Estratégia: apostar nos terminais opostos à paridade atual
                terminais = [i for i in range(1, 10) if i % 2 != ultimos_numeros[0] % 2][:3]
                return "TRIGGER", terminais, num_gatilho, "Alternância de paridade detectada"
        
        # Regra de exemplo: verificar sequência de cores
        if 'verificarCores' in strategy_rules and strategy_rules['verificarCores'] and len(ultimos_numeros) >= 5:
            # Mapear números para cores (simplificado)
            cores = []
            for n in ultimos_numeros[:5]:
                if n == 0:
                    cores.append("verde")
                elif n in [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]:
                    cores.append("vermelho")
                else:
                    cores.append("preto")
            
            if cores.count("vermelho") >= 4 or cores.count("preto") >= 4:  # Predominância de uma cor
                num_gatilho = ultimos_numeros[0]
                # Estratégia: apostar nos terminais mais frequentes da cor atual
                terminais = [1, 3, 7]  # Terminais exemplo
                return "TRIGGER", terminais, num_gatilho, f"Predominância de cor: {cores[0]}"
        
        # Se nenhuma regra for ativada, retornar estado neutro
        return "NEUTRAL", [], None, "Aguardando condições da estratégia"
        
    except Exception as e:
        logger.error(f"Erro ao processar regras de estratégia: {e}")
        return "NEUTRAL", [], None, f"Erro: {str(e)}"

def update_mongodb_collections():
    """Atualiza diretamente as coleções do MongoDB com estados variados"""
    try:
        # Conectar ao MongoDB
        client = MongoClient('mongodb://localhost:27017/runcash')
        db = client.runcash
        
        # Obter todas as roletas
        roletas = list(db.roletas.find({}))
        
        # Lista de atualizações para executar em lote
        updates_roletas = []
        updates_hist = []
        
        # Obter todas as associações de estratégias personalizadas
        custom_strategies = {}
        try:
            # Recuperar todas as associações de roletas e estratégias
            roulette_strategies = list(db.RouletteStrategy.find({"active": True}))
            
            # Para cada associação, buscar a estratégia correspondente
            for rs in roulette_strategies:
                strategy = db.Strategy.find_one({"_id": rs["strategyId"]})
                if strategy:
                    custom_strategies[rs["roletaId"]] = {
                        "strategy_id": str(strategy["_id"]),
                        "name": strategy["name"],
                        "rules": strategy["rules"],
                        "terminalsConfig": strategy.get("terminalsConfig", {
                            "useDefaultTerminals": True,
                            "customTerminals": []
                        }),
                        "userId": str(strategy["userId"])
                    }
        except Exception as e:
            logger.error(f"Erro ao buscar estratégias personalizadas: {e}")
        
        logger.info(f"Encontradas {len(custom_strategies)} estratégias personalizadas")
        
        # Para cada roleta, associar um estado diferente
        for i, roleta in enumerate(roletas):
            roleta_id = roleta.get("_id") or roleta.get("id")
            roleta_nome = roleta.get("nome")
            
            if not roleta_id or not roleta_nome:
                continue
            
            # Verificar se existe uma estratégia personalizada para esta roleta
            if roleta_id in custom_strategies:
                # Usar a estratégia personalizada
                strategy_config = custom_strategies[roleta_id]
                logger.info(f"Usando estratégia personalizada '{strategy_config['name']}' para roleta {roleta_nome}")
                
                # Processar as regras da estratégia
                estado, terminais, num_gatilho, sugestao = process_strategy_rules(roleta, strategy_config["rules"])
                
                # Se a estratégia tiver terminais configurados, usar esses ao invés dos calculados
                if (not strategy_config["terminalsConfig"]["useDefaultTerminals"] and 
                    strategy_config["terminalsConfig"]["customTerminals"]):
                    terminais = strategy_config["terminalsConfig"]["customTerminals"]
                    logger.info(f"Usando terminais personalizados: {terminais}")
            else:
                # Distribuir os estados de forma cíclica (sistema padrão)
                estado = ESTADOS[i % len(ESTADOS)]
                
                # Definir terminais de acordo com o estado
                terminais = []
                num_gatilho = None
                
                if estado == "TRIGGER" or estado == "POST_GALE_NEUTRAL":
                    num_gatilho = random.randint(1, 36)
                    terminais = [1, 2, 3]  # Terminais simples para teste
                
                # Definir sugestão padrão baseada no estado
                if estado == "NEUTRAL":
                    sugestao = "AGUARDANDO GATILHO"
                elif estado == "TRIGGER":
                    sugestao = f"APOSTAR NOS TERMINAIS: {','.join(map(str, terminais))}"
                elif estado == "POST_GALE_NEUTRAL":
                    sugestao = f"GALE NOS TERMINAIS: {','.join(map(str, terminais))}"
                else:  # MORTO
                    sugestao = "AGUARDANDO PRÓXIMO CICLO"
                    
                logger.info(f"Usando estratégia padrão para roleta {roleta_nome} com estado {estado}")
                
            # Definir vitórias e derrotas
            vitorias = random.randint(1, 5)
            derrotas = random.randint(0, 3)
            
            # Timestamp atual
            timestamp = datetime.now().isoformat()
            
            # Atualização para a coleção roletas
            updates_roletas.append(
                UpdateOne(
                    {"_id": roleta_id},
                    {"$set": {
                        "estado_estrategia": estado,
                        "numero_gatilho": num_gatilho,
                        "terminais_gatilho": terminais,
                        "vitorias": vitorias,
                        "derrotas": derrotas,
                        "sugestao_display": sugestao,
                        "updated_at": timestamp
                    }}
                )
            )
            
            # Atualização para a coleção de histórico
            updates_hist.append({
                "roleta_id": roleta_id,
                "roleta_nome": roleta_nome,
                "estado": estado,
                "numero_gatilho": num_gatilho,
                "terminais_gatilho": terminais,
                "timestamp": timestamp,
                "vitorias": vitorias,
                "derrotas": derrotas,
                "sugestao_display": sugestao
            })
            
            logger.info(f"Roleta {roleta_nome} será atualizada para estado {estado} com {vitorias}W/{derrotas}L")
            
        # Executar atualizações em lote para a coleção roletas
        if updates_roletas:
            result = db.roletas.bulk_write(updates_roletas)
            logger.info(f"Atualizadas {result.modified_count} roletas")
            
        # Limpar e reinserir na coleção de histórico
        if updates_hist:
            # Remover todos os registros existentes
            db.estrategia_historico_novo.delete_many({})
            # Inserir novos registros
            result = db.estrategia_historico_novo.insert_many(updates_hist)
            logger.info(f"Inseridos {len(result.inserted_ids)} registros de histórico")
            
        # Verificar se as últimas atualizações foram feitas
        last_updates = list(db.estrategia_historico_novo.find().sort("timestamp", -1).limit(5))
        for update in last_updates:
            logger.info(f"Último registro: {update.get('roleta_nome')} - Estado: {update.get('estado')} - V/D: {update.get('vitorias')}/{update.get('derrotas')}")
            
        return True
        
    except Exception as e:
        logger.error(f"Erro ao atualizar MongoDB: {str(e)}")
        return False

if __name__ == "__main__":
    if update_mongodb_collections():
        logger.info("Atualização concluída com sucesso")
        sys.exit(0)
    else:
        logger.error("Falha na atualização")
        sys.exit(1) 