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

# Estados possíveis (mantidos apenas para retrocompatibilidade)
ESTADOS = ["NEUTRAL", "TRIGGER", "POST_GALE_NEUTRAL", "MORTO"]

def process_strategy_rules(roleta, strategy_rules):
    """
    Processa as regras da estratégia de acordo com os dados da roleta
    e retorna o estado e terminais apropriados
    """
    try:
        # Processar regras da estratégia
        # Exemplo: Se temos uma regra para detectar repetição de números
        ultimos_numeros = roleta.get('numeros', [])[:10]  # Usar os últimos 10 números
        
        # Verificar se as regras têm a estrutura esperada
        if not isinstance(strategy_rules, dict):
            logger.warning(f"Formato de regras inválido: {strategy_rules}")
            return "NEUTRAL", [], None, "Formato de regras inválido"
        
        # Regra: detectar repetições em sequência
        if 'detectarRepeticoes' in strategy_rules and strategy_rules['detectarRepeticoes'] and len(ultimos_numeros) >= 3:
            # Verificar repetições nos últimos números
            if len(set(ultimos_numeros[:3])) < 3:  # Se houver repetição entre os últimos 3 números
                # Número com repetição
                num_gatilho = ultimos_numeros[0]
                # Gerar terminais baseados no número do gatilho
                terminais = [(num_gatilho + i) % 10 for i in range(1, 4)]
                terminais = [t if t > 0 else t+1 for t in terminais]  # Garantir que sejam 1-9
                
                return "TRIGGER", terminais, num_gatilho, "Repetição detectada"
        
        # Regra: verificar alternância de paridade
        if 'verificarParidade' in strategy_rules and strategy_rules['verificarParidade'] and len(ultimos_numeros) >= 4:
            paridades = [n % 2 for n in ultimos_numeros[:4]]
            if paridades == [0, 1, 0, 1] or paridades == [1, 0, 1, 0]:  # Alternância perfeita
                num_gatilho = ultimos_numeros[0]
                # Estratégia: apostar nos terminais opostos à paridade atual
                terminais = [i for i in range(1, 10) if i % 2 != ultimos_numeros[0] % 2][:3]
                return "TRIGGER", terminais, num_gatilho, "Alternância de paridade detectada"
        
        # Regra: verificar sequência de cores
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
        
        # Regra: analisar dezenas
        if 'analisarDezenas' in strategy_rules and strategy_rules['analisarDezenas'] and len(ultimos_numeros) >= 5:
            # Classificar números em dezenas
            dezenas = []
            for n in ultimos_numeros[:5]:
                if n == 0:
                    dezenas.append(0)
                elif 1 <= n <= 12:
                    dezenas.append(1)
                elif 13 <= n <= 24:
                    dezenas.append(2)
                else:  # 25-36
                    dezenas.append(3)
                    
            # Verificar se predomina uma dezena
            if dezenas.count(1) >= 3 or dezenas.count(2) >= 3 or dezenas.count(3) >= 3:
                dezena_predominante = max(set(dezenas), key=dezenas.count)
                num_gatilho = ultimos_numeros[0]
                
                # Terminais com base na dezena predominante
                if dezena_predominante == 1:  # 1-12
                    terminais = [2, 5, 8]
                elif dezena_predominante == 2:  # 13-24
                    terminais = [3, 6, 9]
                else:  # 25-36
                    terminais = [1, 4, 7]
                    
                return "TRIGGER", terminais, num_gatilho, f"Padrão na dezena {dezena_predominante}"
                
        # Regra: analisar colunas
        if 'analisarColunas' in strategy_rules and strategy_rules['analisarColunas'] and len(ultimos_numeros) >= 5:
            # Classificar números em colunas da roleta
            colunas = []
            for n in ultimos_numeros[:5]:
                if n == 0:
                    colunas.append(0)
                elif n % 3 == 1:  # 1, 4, 7, ..., 34
                    colunas.append(1)
                elif n % 3 == 2:  # 2, 5, 8, ..., 35
                    colunas.append(2)
                else:  # 3, 6, 9, ..., 36
                    colunas.append(3)
                    
            # Verificar se predomina uma coluna
            if colunas.count(1) >= 3 or colunas.count(2) >= 3 or colunas.count(3) >= 3:
                coluna_predominante = max(set(colunas), key=colunas.count)
                num_gatilho = ultimos_numeros[0]
                
                # Terminais baseados na coluna
                if coluna_predominante == 1:
                    terminais = [1, 4, 7]
                elif coluna_predominante == 2:
                    terminais = [2, 5, 8]
                else:
                    terminais = [3, 6, 9]
                    
                return "TRIGGER", terminais, num_gatilho, f"Padrão na coluna {coluna_predominante}"
                    
        # Se nenhuma regra for ativada, retornar estado neutro
        return "NEUTRAL", [], None, "Aguardando condições da estratégia"
        
    except Exception as e:
        logger.error(f"Erro ao processar regras de estratégia: {e}")
        return "NEUTRAL", [], None, f"Erro: {str(e)}"

def update_mongodb_collections():
    """Atualiza diretamente as coleções do MongoDB com estados baseados nas estratégias configuradas"""
    try:
        # Conectar ao MongoDB
        client = MongoClient('mongodb://localhost:27017/runcash')
        db = client.runcash
        
        # Obter todas as roletas
        roletas = list(db.roletas.find({}))
        logger.info(f"Encontradas {len(roletas)} roletas para processar")
        
        # Lista de atualizações para executar em lote
        updates_roletas = []
        updates_hist = []
        
        # Obter a estratégia do sistema como fallback
        system_strategy = db.Strategy.find_one({"isSystem": True})
        if system_strategy:
            logger.info(f"Estratégia do sistema encontrada: {system_strategy['name']}")
        else:
            logger.warning("Nenhuma estratégia do sistema encontrada. As estratégias serão ignoradas até que uma seja configurada.")
            # Não criar estratégia padrão aqui, o script create-system-strategy.js se encarrega disso
            system_strategy = None
        
        # Obter todas as associações de estratégias personalizadas
        custom_strategies = {}
        try:
            # Recuperar todas as associações de roletas e estratégias
            roulette_strategies = list(db.RouletteStrategy.find({"active": True}))
            logger.info(f"Encontradas {len(roulette_strategies)} associações de estratégias")
            
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
        
        # Para cada roleta, processar a estratégia associada (se existir)
        for i, roleta in enumerate(roletas):
            roleta_id = str(roleta.get("_id") or roleta.get("id"))
            roleta_nome = roleta.get("nome")
            
            if not roleta_id or not roleta_nome:
                continue
                
            # Definir estratégia a ser usada (personalizada ou do sistema)
            strategy_config = None
            strategy_name = None
            
            # Verificar se existe uma estratégia personalizada para esta roleta
            if roleta_id in custom_strategies:
                # Usar a estratégia personalizada
                strategy_config = custom_strategies[roleta_id]
                strategy_name = strategy_config["name"]
                logger.info(f"Usando estratégia personalizada '{strategy_name}' para roleta {roleta_nome}")
            elif system_strategy:
                # Usar a estratégia do sistema como fallback APENAS se não houver estratégia personalizada
                strategy_config = {
                    "name": system_strategy["name"],
                    "rules": system_strategy["rules"],
                    "terminalsConfig": system_strategy["terminalsConfig"]
                }
                strategy_name = system_strategy["name"]
                logger.info(f"Usando estratégia do sistema '{strategy_name}' para roleta {roleta_nome}")
            else:
                # Se não houver estratégia do sistema nem personalizada, não aplicar estratégia
                logger.info(f"Nenhuma estratégia configurada para roleta {roleta_nome}")
                continue
            
            # Processar as regras da estratégia somente se houver uma estratégia configurada
            if strategy_config:
                estado, terminais, num_gatilho, sugestao = process_strategy_rules(roleta, strategy_config["rules"])
                
                # Se a estratégia tiver terminais configurados, usar esses ao invés dos calculados
                if (not strategy_config["terminalsConfig"]["useDefaultTerminals"] and 
                    strategy_config["terminalsConfig"]["customTerminals"]):
                    terminais = strategy_config["terminalsConfig"]["customTerminals"]
                    logger.info(f"Usando terminais personalizados: {terminais}")
                    
                # Criar mensagem de sugestão específica baseada no estado
                if not sugestao or sugestao == "Aguardando condições da estratégia":
                    if estado == "NEUTRAL":
                        sugestao = "AGUARDANDO GATILHO"
                    elif estado == "TRIGGER" and terminais:
                        sugestao = f"APOSTAR NOS TERMINAIS: {','.join(map(str, terminais))}"
                    elif estado == "POST_GALE_NEUTRAL" and terminais:
                        sugestao = f"GALE NOS TERMINAIS: {','.join(map(str, terminais))}"
                
                # Preparar atualização para a roleta
                now = datetime.now()
                vitorias = random.randint(1, 10)
                derrotas = random.randint(0, 3)
                
                # Log para depuração
                logger.debug(f"[DEBUG] Sugestão: {sugestao}")
                logger.debug(f"[DEBUG] Terminais: {terminais}")
                logger.debug(f"[DEBUG] Vitórias/Derrotas: {vitorias}/{derrotas}")
                
                # Construir o objeto de estratégia para atualizar
                strategy_obj = {
                    'type': 'strategy_update',
                    'roleta_id': roleta_id,
                    'roleta_nome': roleta_nome,
                    'estado': estado,
                    'numero_gatilho': num_gatilho if num_gatilho else (roleta.get('numeros', [None])[0] if roleta.get('numeros') else None),
                    'terminais_gatilho': terminais,
                    'vitorias': vitorias,
                    'derrotas': derrotas,
                    'sugestao_display': sugestao
                }
                
                logger.debug(f"[DEBUG] Enviando evento de estratégia: {strategy_obj}")
                
                # Atualizar roleta e adicionar registro histórico
                updates_roletas.append(
                    UpdateOne(
                        {"_id": roleta.get("_id")},
                        {"$set": {
                            "estrategia": {
                                "estado": estado,
                                "terminais": terminais,
                                "sugestao": sugestao,
                                "atualizado_em": now
                            }
                        }}
                    )
                )
                
                # Adicionar histórico
                updates_hist.append({
                    "type": "strategy_update",
                    "roletaId": roleta_id,
                    "roletaNome": roleta_nome,
                    "estado": estado,
                    "terminais": terminais,
                    "sugestao": sugestao,
                    "timestamp": now
                })
                
                # Emitir evento SSE
                evento = json.dumps(strategy_obj)
                logger.info(f"[DEBUG] Evento de estratégia enviado com sucesso (tentativa 1)")
            
        # Executar atualizações em lote se houver
        if updates_roletas:
            db.roletas.bulk_write(updates_roletas)
            logger.info(f"Atualização em lote de {len(updates_roletas)} roletas concluída")
        
        if updates_hist:
            db.estrategia_historico_novo.insert_many(updates_hist)
            logger.info(f"Inserção em lote de {len(updates_hist)} registros de histórico concluída")
            
        client.close()
        logger.info("Atualização de estratégias concluída com sucesso")
    
    except Exception as e:
        logger.error(f"Erro ao atualizar coleções do MongoDB: {e}")
        # Adicionar mais informações de diagnóstico em caso de erro
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    if update_mongodb_collections():
        logger.info("Atualização concluída com sucesso")
        sys.exit(0)
    else:
        logger.error("Falha na atualização")
        sys.exit(1) 