from flask import Flask, render_template, jsonify, send_from_directory, request
from flask_socketio import SocketIO, emit
import threading
import json
import time
import os
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'roleta_unibet'
socketio = SocketIO(app, cors_allowed_origins="*")

# Referência para os dados compartilhados com o script principal
tabela_mesas_compartilhada = {}

# Criar diretório de templates e static se não existirem
if not os.path.exists('templates'):
    os.makedirs('templates')
if not os.path.exists('static'):
    os.makedirs('static')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@socketio.on('connect')
def handle_connect():
    print(f"Cliente conectado: {request.sid}")
    # Envia dados iniciais quando um cliente se conecta
    emit('atualizar_mesas', tabela_mesas_compartilhada)

def enviar_atualizacoes():
    """Thread para enviar atualizações periódicas aos clientes conectados"""
    while True:
        # Envia atualizações a cada 2 segundos
        time.sleep(2)
        socketio.emit('atualizar_mesas', tabela_mesas_compartilhada)

def iniciar_servidor(dados_compartilhados, porta=5000):
    """Inicia o servidor Flask"""
    global tabela_mesas_compartilhada
    tabela_mesas_compartilhada = dados_compartilhados
    
    # Inicia thread para atualizações em tempo real
    atualizar_thread = threading.Thread(target=enviar_atualizacoes)
    atualizar_thread.daemon = True
    atualizar_thread.start()
    
    # Inicia o servidor
    socketio.run(app, host='0.0.0.0', port=porta, debug=False, allow_unsafe_werkzeug=True)

if __name__ == '__main__':
    # Teste com dados simulados
    dados_teste = {
        "mesa1": {
            "fornecedor": "evolution",
            "nome": "Lightning Roulette",
            "historico": ["0", "32", "15", "19"],
            "jogadores": 120,
            "ultimo": "0",
            "dealer": "Maria"
        }
    }
    iniciar_servidor(dados_teste) 