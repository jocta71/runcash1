#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
API REST para RunCash - Integração com frontend
Suporte a Server-Sent Events (SSE) para atualizações em tempo real
"""

import os
import json
import time
import threading
import logging
import queue
from datetime import datetime
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import hashlib
import uuid

# Importações locais
from data_source_mongo import MongoDataSource
from event_manager import event_manager, EventManager
from config import DEFAULT_HOST, DEFAULT_PORT, API_VERSION

# Configurar logger
logger = logging.getLogger('runcash_api')
logger.setLevel(logging.INFO)

# Criar a aplicação Flask
app = Flask(__name__)

# Configurar CORS para permitir solicitações do frontend
allowed_origins = os.environ.get('ALLOWED_ORIGINS', 'https://runcashnew-frontend-nu.vercel.app,https://runcashnew.vercel.app,https://seu-projeto.vercel.app,http://localhost:3000,http://localhost:5173,https://788b-146-235-26-230.ngrok-free.app,https://new-run-zeta.vercel.app')
CORS(app, resources={r"/api/*": {"origins": allowed_origins.split(','), "supports_credentials": True}})

# Fonte de dados
data_source = MongoDataSource()

@app.route('/api/status')
def api_status():
    """Endpoint para verificar se a API está online"""
    return jsonify({
        "status": "online",
        "version": API_VERSION,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/roletas', methods=['GET'])
def get_roletas():
    """Retorna a lista de roletas disponíveis no MongoDB"""
    roletas = data_source.db.roletas.find({}, {'_id': 0})
    return jsonify(list(roletas))

@app.route('/api/roulettes', methods=['GET'])
def get_roulettes():
    """Verifica assinatura Asaas e retorna roletas apenas para assinantes válidos"""
    # Obter token de autorização
    auth_header = request.headers.get('Authorization')
    request_id = str(uuid.uuid4())
    
    # Verificar se o header de autorização está presente
    if not auth_header or not auth_header.startswith('Bearer '):
        # Registrar tentativa de acesso não autenticado
        logger.warning(f"[AUTH {request_id}] Acesso não autenticado à rota /api/roulettes")
        logger.warning(f"[AUTH {request_id}] Headers: {request.headers}")
        logger.warning(f"[AUTH {request_id}] IP: {request.remote_addr}")
        
        # Retornar resposta 401 Unauthorized
        response = jsonify({
            "success": False,
            "message": "Autenticação necessária para acessar este recurso.",
            "code": "AUTHENTICATION_REQUIRED",
            "requestId": request_id,
            "timestamp": datetime.now().isoformat()
        })
        response.status_code = 401
        return response
    
    # Extrair token
    token = auth_header.split(' ')[1]
    
    try:
        # Verificar JWT (usando biblioteca específica ou função externa)
        jwt_secret = os.environ.get('JWT_SECRET', 'runcash_jwt_secret_key_2023')
        import jwt
        decoded = jwt.decode(token, jwt_secret, algorithms=['HS256'])
        
        # Verificar se há customerId no token
        customer_id = decoded.get('customerId')
        if not customer_id:
            # Buscar customerId no banco de dados
            user_id = decoded.get('id')
            if user_id:
                user = data_source.db.users.find_one({'id': user_id})
                if user and 'customerId' in user:
                    customer_id = user['customerId']
        
        # Se não encontrou customerId, negar acesso
        if not customer_id:
            logger.warning(f"[AUTH {request_id}] Usuário sem ID Asaas: {decoded.get('id')}")
            response = jsonify({
                "success": False,
                "message": "Assinatura necessária para acessar este recurso.",
                "code": "SUBSCRIPTION_REQUIRED",
                "requestId": request_id,
                "timestamp": datetime.now().isoformat()
            })
            response.status_code = 403
            return response
        
        # Verificar assinatura Asaas no banco de dados
        subscription = data_source.db.subscriptions.find_one({
            'customer_id': customer_id,
            'status': 'ACTIVE'
        })
        
        # Se não encontrou assinatura ativa, negar acesso
        if not subscription:
            logger.warning(f"[AUTH {request_id}] Sem assinatura ativa para: {customer_id}")
            response = jsonify({
                "success": False,
                "message": "Assinatura ativa necessária para acessar este recurso.",
                "code": "ACTIVE_SUBSCRIPTION_REQUIRED",
                "requestId": request_id,
                "timestamp": datetime.now().isoformat()
            })
            response.status_code = 403
            return response
        
        # Assinatura ativa verificada, retornar roletas
        logger.info(f"[AUTH {request_id}] Assinatura verificada para: {customer_id}")
        
        # Buscar roletas com base no plano do usuário
        plan_type = subscription.get('plan_type', 'BASIC').upper()
        
        # Definir limite com base no plano
        limit = 5  # Default
        if plan_type == 'BASIC':
            limit = 15
        elif plan_type == 'PRO':
            limit = 50
        elif plan_type == 'PREMIUM':
            limit = None  # Sem limite
        
        # Buscar todas as roletas
        roletas = list(data_source.db.roletas.find({}, {'_id': 0}))
        
        # Limitar conforme o plano (exceto PREMIUM)
        if limit is not None:
            roletas = roletas[:limit]
        
        return jsonify({
            "success": True,
            "data": roletas,
            "count": len(roletas),
            "plan": plan_type,
            "timestamp": datetime.now().isoformat()
        })
    
    except Exception as e:
        logger.error(f"[AUTH {request_id}] Erro ao verificar token/assinatura: {str(e)}")
        response = jsonify({
            "success": False,
            "message": "Erro ao verificar autenticação ou assinatura.",
            "code": "AUTH_ERROR",
            "error": str(e),
            "requestId": request_id,
            "timestamp": datetime.now().isoformat()
        })
        response.status_code = 401
        return response

@app.route('/api/ROULETTES', methods=['GET'])
def get_roulettes_uppercase():
    """Rota desativada (versão maiúscula) - Retorna 403 Forbidden por questões de segurança"""
    # Gerar um ID único para rastreamento nos logs
    request_id = str(uuid.uuid4())
    
    # Registrar tentativa de acesso à rota bloqueada
    logger.warning(f"[FIREWALL {request_id}] Bloqueando acesso à rota desativada: /api/ROULETTES")
    logger.warning(f"[FIREWALL {request_id}] Headers: {request.headers}")
    logger.warning(f"[FIREWALL {request_id}] IP: {request.remote_addr}")
    logger.warning(f"[FIREWALL {request_id}] User-Agent: {request.user_agent}")
    logger.warning(f"[FIREWALL {request_id}] Timestamp: {datetime.now().isoformat()}")
    
    # Retornar resposta 403 Forbidden com mensagem clara
    response = jsonify({
        "success": False,
        "message": "Esta rota foi desativada por razões de segurança.",
        "code": "ROUTE_DISABLED",
        "requestId": request_id,
        "alternativeEndpoints": ["/api/roletas"],
        "timestamp": datetime.now().isoformat()
    })
    
    # Configurar cabeçalhos CORS explicitamente para esta resposta
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    response.status_code = 403
    
    return response

@app.route('/api/roletas/<roleta_id>', methods=['GET'])
def get_roleta(roleta_id):
    """Retorna informações sobre uma roleta específica pelo ID"""
    roleta = data_source.db.roletas.find_one({'id': roleta_id}, {'_id': 0})
    if not roleta:
        return jsonify({'error': 'Roleta não encontrada'}), 404
    return jsonify(roleta)

@app.route('/api/roulettes/<roulette_id>', methods=['GET'])
def get_roulette(roulette_id):
    """Returns information about a specific roulette by ID"""
    roulette = data_source.db.roletas.find_one({'id': roulette_id}, {'_id': 0})
    if not roulette:
        return jsonify({'error': 'Roulette not found'}), 404
    return jsonify(roulette)

@app.route('/api/roletas/<roleta_id>/numeros', methods=['GET'])
def get_roleta_numeros(roleta_id):
    """Retorna os números de uma roleta específica"""
    # Log da requisição
    print(f"[API] Recebida requisição para números da roleta: {roleta_id}")
    
    # Quantidade de números a retornar
    limite = int(request.args.get('limit', 50))
    
    # Remover a conversão para UUID e usar o ID original
    # Verificar se a roleta existe
    roleta = data_source.db.roletas.find_one({'id': roleta_id}, {'_id': 0})
    if not roleta:
        print(f"[API] Roleta não encontrada pelo ID: {roleta_id}")
        return jsonify({'error': 'Roleta não encontrada'}), 404
    
    print(f"[API] Roleta encontrada: {roleta['nome']}")
    
    # Obter os números da roleta
    numeros_brutos = data_source.obter_ultimos_numeros(roleta_id, limite)
    print(f"[API] Números brutos obtidos: {len(numeros_brutos)}")
    
    # Converter para formato com mais informações
    numeros = []
    for i, num in enumerate(numeros_brutos):
        cor = data_source.obter_cor_numero(num)
        timestamp = data_source.obter_timestamp_numero(roleta_id, num, i)
        numeros.append({
            "numero": num,
            "cor": cor,
            "timestamp": timestamp
        })
    
    resposta = {
        "roleta_id": roleta_id,
        "roleta_nome": roleta['nome'],
        "numeros": numeros,
        "total": len(numeros)
    }
    
    print(f"[API] Resposta formatada para '{roleta['nome']}': {len(numeros)} números")
    return jsonify(resposta)

@app.route('/api/roulettes/<roulette_id>/numbers', methods=['GET'])
def get_roulette_numbers(roulette_id):
    """Returns the numbers of a specific roulette"""
    # Log the request
    print(f"[API] Received request for roulette numbers: {roulette_id}")
    
    # Number of numbers to return
    limit = int(request.args.get('limit', 50))
    
    # Remove UUID conversion and use original ID
    # Check if the roulette exists
    roulette = data_source.db.roletas.find_one({'id': roulette_id}, {'_id': 0})
    if not roulette:
        print(f"[API] Roulette not found by ID: {roulette_id}")
        return jsonify({'error': 'Roulette not found'}), 404
    
    print(f"[API] Roulette found: {roulette['nome']}")
    
    # Get the roulette numbers
    raw_numbers = data_source.obter_ultimos_numeros(roulette_id, limit)
    print(f"[API] Raw numbers obtained: {len(raw_numbers)}")
    
    # Convert to format with more information
    numbers = []
    for i, num in enumerate(raw_numbers):
        color = data_source.obter_cor_numero(num)
        timestamp = data_source.obter_timestamp_numero(roulette_id, num, i)
        numbers.append({
            "numero": num,
            "cor": color,
            "timestamp": timestamp
        })
    
    response = {
        "roulette_id": roulette_id,
        "roulette_name": roulette['nome'],
        "numbers": numbers,
        "total": len(numbers)
    }
    
    print(f"[API] Formatted response for '{roulette['nome']}': {len(numbers)} numbers")
    return jsonify(response)

@app.route('/api/roletas/<roleta_id>/numeros', methods=['POST'])
def add_roleta_numero(roleta_id):
    """Adiciona um novo número para uma roleta específica"""
    # Verificar se o corpo da requisição é válido
    if not request.is_json:
        return jsonify({"error": "Corpo da requisição deve ser JSON"}), 400
    
    # Obter dados do corpo da requisição
    data = request.json
    
    # Validar dados
    if 'numero' not in data:
        return jsonify({"error": "Campo 'numero' é obrigatório"}), 400
    
    try:
        numero = int(data['numero'])
        if numero < 0 or numero > 36:
            return jsonify({"error": "Número deve estar entre 0 e 36"}), 400
    except ValueError:
        return jsonify({"error": "Número deve ser um inteiro"}), 400
    
    # Obter roleta pelo ID
    roleta = data_source.db.roletas.find_one({'id': roleta_id}, {'_id': 0})
    if not roleta:
        return jsonify({'error': 'Roleta não encontrada'}), 404
    
    # Determinar cor do número
    cor = data_source.obter_cor_numero(numero)
    
    # Inserir número
    timestamp = data.get('timestamp', datetime.now().isoformat())
    sucesso = data_source.inserir_numero(roleta_id, roleta['nome'], numero, cor, timestamp)
    
    if sucesso:
        # Notificar clientes SSE sobre o novo número
        event_manager.notify_clients({
            "type": "new_number",
            "roleta_id": roleta_id,
            "roleta_nome": roleta['nome'],
            "numero": numero,
            "cor": cor,
            "timestamp": timestamp
        })
        
        return jsonify({
            "success": True,
            "message": f"Número {numero} inserido com sucesso para roleta {roleta['nome']}",
            "roleta_id": roleta_id,
            "numero": numero,
            "cor": cor,
            "timestamp": timestamp
        })
    else:
        return jsonify({
            "success": False,
            "error": f"Falha ao inserir número {numero} para roleta {roleta['nome']}"
        }), 500

@app.route('/api/events')
def sse_stream():
    """Endpoint SSE para receber atualizações em tempo real"""
    def generate():
        # Registrar cliente e obter fila
        client_queue = event_manager.register_client()
        
        # Enviar cabeçalho SSE
        yield 'retry: 10000\n\n'
        
        try:
            # Obter eventos históricos
            history = event_manager.get_event_history(limit=10)
            for event in history:
                yield f'data: {json.dumps(event)}\n\n'
            
            # Esperar por novos eventos
            while True:
                try:
                    # Timeout para evitar bloqueio indefinido
                    event = client_queue.get(timeout=30)
                    
                    # Enviar evento para o cliente
                    yield f'data: {json.dumps(event)}\n\n'
                except queue.Empty:
                    # Se não houver eventos, enviar ping para manter a conexão viva
                    yield f'data: {json.dumps({"type": "ping", "timestamp": datetime.now().isoformat()})}\n\n'
        except:
            # Em caso de erro, remover cliente
            event_manager.unregister_client(client_queue)
        
        # Quando a conexão for fechada, remover cliente
        event_manager.unregister_client(client_queue)

    # Configurar resposta SSE
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        }
    )


@app.route('/api/strategy/<roleta_id>', methods=['GET'])
def get_strategy_status(roleta_id):
    """
    Endpoint para obter o estado atual da estratégia para uma roleta específica
    """
    try:
        # Verificar se a roleta existe
        roleta = data_source.db.roletas.find_one({'id': roleta_id}, {'_id': 0})
        if not roleta:
            return jsonify({'error': 'Roleta não encontrada'}), 404
        
        # Obter dados da estratégia atual
        # Estes campos são atualizados pelo processo em run_real_scraper.py
        strategy_data = {
            'estado': roleta.get('estado_estrategia', 'NEUTRAL'),
            'numero_gatilho': roleta.get('numero_gatilho', None),
            'terminais_gatilho': roleta.get('terminais_gatilho', []),
            'vitorias': roleta.get('vitorias', 0),
            'derrotas': roleta.get('derrotas', 0),
            'sugestao_display': roleta.get('sugestao_display', '')
        }
        
        return jsonify(strategy_data)
    except Exception as e:
        logger.error(f"Erro ao obter estado da estratégia: {str(e)}")
        return jsonify({'error': f'Erro ao obter estado da estratégia: {str(e)}'}), 500

@app.route('/api/strategy/<roulette_id>', methods=['GET'])
def get_strategy_status_en(roulette_id):
    """
    Endpoint to get the current strategy state for a specific roulette
    """
    try:
        # Check if the roulette exists
        roulette = data_source.db.roletas.find_one({'id': roulette_id}, {'_id': 0})
        if not roulette:
            return jsonify({'error': 'Roulette not found'}), 404
        
        # Get current strategy data
        # These fields are updated by the process in run_real_scraper.py
        strategy_data = {
            'estado': roulette.get('estado_estrategia', 'NEUTRAL'),
            'numero_gatilho': roulette.get('numero_gatilho', None),
            'terminais_gatilho': roulette.get('terminais_gatilho', []),
            'vitorias': roulette.get('vitorias', 0),
            'derrotas': roulette.get('derrotas', 0),
            'sugestao_display': roulette.get('sugestao_display', '')
        }
        
        return jsonify(strategy_data)
    except Exception as e:
        logger.error(f"Error getting strategy state: {str(e)}")
        return jsonify({'error': f'Error getting strategy state: {str(e)}'}), 500

@app.route('/api/test-event', methods=['POST'])
def test_event():
    """Endpoint para testar o envio de eventos SSE"""
    # Verificar se o corpo da requisição é válido
    if not request.is_json:
        return jsonify({"error": "Corpo da requisição deve ser JSON"}), 400
    
    # Obter dados do corpo da requisição
    data = request.json
    
    # Validar dados
    if 'type' not in data:
        return jsonify({"error": "Campo 'type' é obrigatório"}), 400
    
    # Adicionar timestamp se não existir
    if 'timestamp' not in data:
        data['timestamp'] = datetime.now().isoformat()
    
    # Notificar clientes SSE
    event_manager.notify_clients(data)
    
    return jsonify({
        "success": True,
        "message": "Evento enviado com sucesso",
        "event": data
    })

def start_server():
    """Inicia o servidor Flask com as configurações do arquivo .env"""
    # Obter configurações do arquivo .env
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    # Iniciar servidor Flask
    app.run(host=host, port=port, debug=debug, threaded=True)

if __name__ == "__main__":
    start_server() 