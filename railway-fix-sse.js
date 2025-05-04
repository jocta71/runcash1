/**
 * Script para corrigir o problema de SSE no Railway
 * 
 * Este script deve ser executado no ambiente do Railway para 
 * adicionar diretamente as rotas SSE, ignorando o sistema de rotas do Express.
 */

const express = require('express');
const crypto = require('crypto');
const app = express();
const Iron = require('@hapi/iron');
const { MongoClient } = require('mongodb');

// Importar chave de criptografia do ambiente ou usar padrão
const ENCRYPTION_SECRET = process.env.DATA_ENCRYPTION_KEY || 'runcash_secret_encryption_key_32_chars';

// Configuração do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

console.log('[FIX-SSE] Iniciando script de correção SSE para o Railway');
console.log('[FIX-SSE] Configurando rota SSE para todas as roletas');

// Verificar se req.user existe
const ensureUser = (req, res, next) => {
  if (!req.user || !req.user.id) {
    console.log('[FIX-SSE] Requisição sem usuário autenticado. Criando usuário mock para testes.');
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      subscription: {
        type: 'PREMIUM'
      }
    };
  }
  next();
};

// Sempre permitir (para teste)
const mockCheckSubscription = (req, res, next) => {
  console.log(`[FIX-SSE] Verificando assinatura para usuário ${req.user.id}`);
  next();
};

// Rota SSE direta, independente do sistema de rotas
console.log('[FIX-SSE] Adicionando rota /api-fix/stream/roulettes');
app.get('/api-fix/stream/roulettes', ensureUser, mockCheckSubscription, async (req, res) => {
  try {
    // Gerar ID de requisição único para rastreamento
    const requestId = crypto.randomUUID();
    
    // Log detalhado do acesso
    console.log(`[FIX-SSE] Iniciando conexão SSE para todas as roletas`);
    console.log(`[FIX-SSE] Request URL: ${req.originalUrl}`);
    console.log(`[FIX-SSE] Request ID: ${requestId}`);
    console.log(`[FIX-SSE] Usuário ID: ${req.user.id}`);
    console.log(`[FIX-SSE] Timestamp: ${new Date().toISOString()}`);
    
    // Configurar cabeçalhos SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Importante para nginx
    });
    
    // Função para enviar eventos
    const sendEvent = async (eventType, data) => {
      try {
        // Criptografar dados usando Iron
        const encryptedData = await Iron.seal(
          data,
          ENCRYPTION_SECRET,
          Iron.defaults
        );
        
        // Estrutura do evento SSE
        res.write(`event: ${eventType}\n`);
        res.write(`id: ${Date.now()}\n`);
        res.write(`data: ${encryptedData}\n\n`);
      } catch (error) {
        console.error(`[FIX-SSE] Erro ao criptografar dados: ${error.message}`);
      }
    };
    
    // Conectar ao banco de dados
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbName);
    
    // Obter dados iniciais de todas as roletas
    const roulettesData = await db.collection('roulettes').find({}).toArray();
    
    // Configurar limites com base no plano do usuário
    let limit = 5; // Padrão para plano básico
    let limited = true;
    
    // Ajustar limite com base no plano
    if (req.user.subscription) {
      switch (req.user.subscription.type) {
        case 'BASIC':
          limit = 15;
          break;
        case 'PRO':
          limit = 50;
          break;
        case 'PREMIUM':
          limit = Infinity; // Sem limite
          limited = false;
          break;
        default:
          limit = 5; // Plano básico padrão
      }
    }
    
    // Enviar dados iniciais
    await sendEvent('update', {
      type: 'initial',
      roulettes: limited ? roulettesData.slice(0, limit) : roulettesData,
      limited,
      totalCount: roulettesData.length,
      availableCount: limited ? limit : roulettesData.length,
      userPlan: req.user.subscription ? req.user.subscription.type : 'BASIC',
      timestamp: new Date().toISOString()
    });
    
    // Configurar changestream para atualização em tempo real
    const changeStream = db.collection('roulettes').watch([], { fullDocument: 'updateLookup' });
    
    changeStream.on('change', async (change) => {
      if (change.operationType === 'update' || change.operationType === 'replace' || 
          change.operationType === 'insert' || change.operationType === 'delete') {
        
        // Buscar dados atualizados de todas as roletas
        const updatedRoulettes = await db.collection('roulettes').find({}).toArray();
        
        await sendEvent('update', {
          type: 'update',
          roulettes: limited ? updatedRoulettes.slice(0, limit) : updatedRoulettes,
          changeType: change.operationType,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Simular atualização a cada 30 segundos para manter a conexão ativa
    // e garantir que os clientes tenham dados atualizados
    const interval = setInterval(async () => {
      // Enviar heartbeat para manter a conexão ativa
      await sendEvent('heartbeat', {
        timestamp: new Date().toISOString()
      });
    }, 30000);
    
    // Limpar recursos quando a conexão for fechada
    req.on('close', () => {
      console.log(`[FIX-SSE] Fechando conexão SSE para todas as roletas (${requestId})`);
      clearInterval(interval);
      changeStream.close();
      client.close();
    });
    
  } catch (error) {
    console.error(`[FIX-SSE] Erro ao processar stream para todas as roletas:`, error);
    res.write(`event: error\n`);
    res.write(`data: {"message": "Erro interno do servidor"}\n\n`);
    res.end();
  }
});

// Rota SSE para uma roleta específica
console.log('[FIX-SSE] Adicionando rota /api-fix/stream/roulettes/:id');
app.get('/api-fix/stream/roulettes/:id', ensureUser, mockCheckSubscription, async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const requestId = crypto.randomUUID();
    
    // Log detalhado do acesso
    console.log(`[FIX-SSE] Iniciando conexão SSE para roleta específica: ${rouletteId}`);
    console.log(`[FIX-SSE] Request URL: ${req.originalUrl}`);
    console.log(`[FIX-SSE] Request ID: ${requestId}`);
    console.log(`[FIX-SSE] Usuário ID: ${req.user.id}`);
    console.log(`[FIX-SSE] Timestamp: ${new Date().toISOString()}`);
    
    // Configurar cabeçalhos SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Importante para nginx
    });
    
    // Função para enviar eventos
    const sendEvent = async (eventType, data) => {
      try {
        // Criptografar dados usando Iron
        const encryptedData = await Iron.seal(
          data,
          ENCRYPTION_SECRET,
          Iron.defaults
        );
        
        // Estrutura do evento SSE
        res.write(`event: ${eventType}\n`);
        res.write(`id: ${Date.now()}\n`);
        res.write(`data: ${encryptedData}\n\n`);
      } catch (error) {
        console.error(`[FIX-SSE] Erro ao criptografar dados: ${error.message}`);
      }
    };
    
    // Conectar ao banco de dados
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbName);
    
    // Obter dados da roleta específica
    const roulette = await db.collection('roulettes').findOne({ id: rouletteId });
    
    if (!roulette) {
      console.log(`[FIX-SSE] Roleta não encontrada: ${rouletteId}`);
      res.write(`event: error\n`);
      res.write(`data: {"message": "Roleta não encontrada"}\n\n`);
      res.end();
      return;
    }
    
    // Enviar dados iniciais
    await sendEvent('update', {
      type: 'initial',
      roulette,
      timestamp: new Date().toISOString()
    });
    
    // Configurar pipeline para filtrar apenas eventos relacionados à esta roleta
    const pipeline = [
      {
        $match: {
          'fullDocument.id': rouletteId
        }
      }
    ];
    
    // Configurar changestream para atualização em tempo real
    const changeStream = db.collection('roulettes').watch(pipeline, { fullDocument: 'updateLookup' });
    
    changeStream.on('change', async (change) => {
      if (change.operationType === 'update' || change.operationType === 'replace') {
        await sendEvent('update', {
          type: 'update',
          roulette: change.fullDocument,
          changeType: change.operationType,
          timestamp: new Date().toISOString()
        });
      } else if (change.operationType === 'delete') {
        await sendEvent('update', {
          type: 'delete',
          rouletteId,
          changeType: 'delete',
          timestamp: new Date().toISOString()
        });
        
        // Fechar conexão se a roleta for excluída
        res.end();
      }
    });
    
    // Simular atualização a cada 30 segundos para manter a conexão ativa
    const interval = setInterval(async () => {
      // Enviar heartbeat para manter a conexão ativa
      await sendEvent('heartbeat', {
        timestamp: new Date().toISOString()
      });
    }, 30000);
    
    // Limpar recursos quando a conexão for fechada
    req.on('close', () => {
      console.log(`[FIX-SSE] Fechando conexão SSE para roleta ${rouletteId} (${requestId})`);
      clearInterval(interval);
      changeStream.close();
      client.close();
    });
    
  } catch (error) {
    console.error(`[FIX-SSE] Erro ao processar stream para roleta específica:`, error);
    res.write(`event: error\n`);
    res.write(`data: {"message": "Erro interno do servidor"}\n\n`);
    res.end();
  }
});

// Página HTML para testar as conexões SSE
console.log('[FIX-SSE] Adicionando rota /teste-sse');
app.get('/teste-sse', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tester de SSE para Roulettes</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .card {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .connection-options {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }
        input, select, button {
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        button {
          background-color: #4CAF50;
          color: white;
          border: none;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #45a049;
        }
        button.disconnect {
          background-color: #f44336;
        }
        button.disconnect:hover {
          background-color: #d32f2f;
        }
        button.clear {
          background-color: #2196F3;
        }
        button.clear:hover {
          background-color: #0b7dda;
        }
        .status {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 4px;
          font-weight: bold;
        }
        .connected {
          background-color: #e8f5e9;
          color: #2e7d32;
        }
        .disconnected {
          background-color: #ffebee;
          color: #c62828;
        }
        .loading {
          display: flex;
          justify-content: center;
          margin: 20px 0;
        }
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top: 4px solid #3498db;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .error {
          background-color: #ffebee;
          color: #c62828;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .hidden {
          display: none;
        }
        .data-display {
          background-color: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          overflow: auto;
          max-height: 300px;
        }
        pre {
          margin: 0;
          white-space: pre-wrap;
        }
        .event-log {
          margin-top: 20px;
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #ddd;
          padding: 10px;
          background-color: #f8f8f8;
        }
        .log-entry {
          margin-bottom: 5px;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
        }
        .log-entry:last-child {
          border-bottom: none;
        }
        .log-time {
          color: #666;
          font-size: 0.8em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Teste de SSE para Roulettes</h1>
          </div>
          
          <div class="connection-options">
            <input type="text" id="serverUrl" value="http://${req.headers.host}" placeholder="URL do servidor" style="flex: 2;">
            <select id="endpoint" style="flex: 1;">
              <option value="/api-fix/stream/roulettes">Todas as roletas</option>
              <option value="/api-fix/stream/roulettes/specific">Roleta específica</option>
            </select>
            <input type="text" id="rouletteId" placeholder="ID da roleta (se específica)" style="flex: 1;">
            <input type="text" id="token" placeholder="Token (opcional)" style="flex: 2;">
            <button id="connect">Conectar</button>
          </div>
          
          <div class="card">
            <div class="header">
              <h2>Status da Conexão</h2>
              <div>
                <span class="status disconnected" id="connectionStatus">Desconectado</span>
                <button id="reconnect" disabled>Reconectar</button>
                <button id="disconnect" class="disconnect" disabled>Desconectar</button>
              </div>
            </div>
            
            <div id="loading" class="loading hidden">
              <div class="spinner"></div>
              <p>Conectando...</p>
            </div>
            
            <div id="error" class="error hidden">
              <p id="errorMessage"></p>
            </div>
          </div>
          
          <div class="card">
            <div class="header">
              <h2>Dados Recebidos</h2>
            </div>
            <div class="data-display">
              <pre id="dataDisplay">Nenhum dado recebido ainda.</pre>
            </div>
          </div>
          
          <div class="card">
            <div class="header">
              <h2>Log de Eventos</h2>
              <button id="clearLog" class="clear">Limpar Log</button>
            </div>
            <div id="eventLog" class="event-log">
              <div class="log-entry">
                <span class="log-time">${new Date().toLocaleTimeString()}</span> - Pronto para conexão
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        // Referências para elementos DOM
        const serverUrlInput = document.getElementById('serverUrl');
        const endpointSelect = document.getElementById('endpoint');
        const rouletteIdInput = document.getElementById('rouletteId');
        const tokenInput = document.getElementById('token');
        const connectBtn = document.getElementById('connect');
        const reconnectBtn = document.getElementById('reconnect');
        const disconnectBtn = document.getElementById('disconnect');
        const connectionStatusEl = document.getElementById('connectionStatus');
        const loadingEl = document.getElementById('loading');
        const errorEl = document.getElementById('error');
        const errorMessageEl = document.getElementById('errorMessage');
        const dataDisplayEl = document.getElementById('dataDisplay');
        const eventLogEl = document.getElementById('eventLog');
        const clearLogBtn = document.getElementById('clearLog');
        
        // Estado da conexão
        let eventSource = null;
        
        // Gerenciamento de eventos do formulário
        endpointSelect.addEventListener('change', function() {
          if (this.value.includes('specific')) {
            rouletteIdInput.style.display = '';
          } else {
            rouletteIdInput.style.display = 'none';
          }
        });
        
        // Inicialização
        rouletteIdInput.style.display = 'none';
        
        // Lógica de conexão
        connectBtn.addEventListener('click', connectToStream);
        reconnectBtn.addEventListener('click', connectToStream);
        disconnectBtn.addEventListener('click', disconnectFromStream);
        clearLogBtn.addEventListener('click', clearEventLog);
        
        function connectToStream() {
          // Mostrar loading, esconder erro
          loadingEl.classList.remove('hidden');
          errorEl.classList.add('hidden');
          
          // Desabilitar botões durante conexão
          connectBtn.disabled = true;
          reconnectBtn.disabled = true;
          
          // Atualizar status
          connectionStatusEl.textContent = 'Conectando...';
          connectionStatusEl.className = 'status';
          
          // Obter URL
          let url = serverUrlInput.value.trim();
          let endpoint = endpointSelect.value;
          
          // Se for roleta específica, adicionar ID
          if (endpoint.includes('specific') && rouletteIdInput.value.trim()) {
            endpoint = endpoint.replace('specific', rouletteIdInput.value.trim());
          }
          
          // Construir URL completa
          const fullUrl = url + endpoint;
          
          // Registrar tentativa de conexão
          logEvent(\`Conectando a: \${fullUrl}\`);
          
          try {
            // Usar EventSourcePolyfill se disponível, caso contrário usar padrão do navegador
            if (typeof EventSourcePolyfill !== 'undefined') {
              const options = {
                headers: {}
              };
              
              // Adicionar token se fornecido
              if (tokenInput.value.trim()) {
                options.headers.Authorization = \`Bearer \${tokenInput.value.trim()}\`;
              }
              
              eventSource = new EventSourcePolyfill(fullUrl, options);
            } else {
              // EventSource padrão (não suporta cabeçalhos personalizados)
              eventSource = new EventSource(fullUrl);
              
              if (tokenInput.value.trim()) {
                logEvent('AVISO: Token fornecido, mas EventSourcePolyfill não está disponível para enviar o token.');
              }
            }
            
            // Manipuladores de eventos
            eventSource.onopen = function() {
              // Atualizar UI
              loadingEl.classList.add('hidden');
              connectionStatusEl.textContent = 'Conectado';
              connectionStatusEl.className = 'status connected';
              
              // Atualizar botões
              connectBtn.disabled = true;
              reconnectBtn.disabled = false;
              disconnectBtn.disabled = false;
              
              // Registrar no log
              logEvent('Conexão estabelecida com sucesso');
            };
            
            eventSource.onerror = function(error) {
              // Atualizar UI para mostrar erro
              loadingEl.classList.add('hidden');
              errorEl.classList.remove('hidden');
              errorMessageEl.textContent = 'Erro na conexão SSE. Verifique o console para detalhes.';
              
              // Atualizar status
              connectionStatusEl.textContent = 'Erro';
              connectionStatusEl.className = 'status disconnected';
              
              // Atualizar botões
              connectBtn.disabled = false;
              reconnectBtn.disabled = false;
              disconnectBtn.disabled = true;
              
              // Fechar conexão se ainda estiver aberta
              if (eventSource) {
                eventSource.close();
                eventSource = null;
              }
              
              // Registrar erro
              logEvent(\`Erro na conexão: \${error}\`);
              console.error('SSE Connection Error:', error);
            };
            
            // Escutar eventos específicos
            eventSource.addEventListener('update', function(event) {
              try {
                // Registrar recebimento
                logEvent('Evento "update" recebido');
                
                // Atualizar display
                dataDisplayEl.textContent = JSON.stringify(event.data, null, 2);
                
                // Tentar descriptografar (se necessário)
                try {
                  // Aqui você pode adicionar lógica para descriptografar se os dados estiverem criptografados
                  // Por simplicidade, apenas exibimos os dados brutos
                } catch (decryptError) {
                  logEvent(\`Erro ao descriptografar: \${decryptError.message}\`);
                }
              } catch (e) {
                logEvent(\`Erro ao processar evento: \${e.message}\`);
              }
            });
            
            eventSource.addEventListener('heartbeat', function(event) {
              logEvent('Heartbeat recebido');
            });
            
            eventSource.addEventListener('error', function(event) {
              try {
                const errorData = event.data ? JSON.parse(event.data) : { message: 'Erro desconhecido' };
                logEvent(\`Erro do servidor: \${errorData.message}\`);
              } catch (e) {
                logEvent(\`Evento de erro recebido: \${event.data || 'Sem detalhes'}\`);
              }
            });
            
            // Também capturar eventos genéricos
            eventSource.onmessage = function(event) {
              logEvent(\`Mensagem genérica recebida: \${event.data}\`);
            };
            
          } catch (error) {
            // Lidar com erros na inicialização
            loadingEl.classList.add('hidden');
            errorEl.classList.remove('hidden');
            errorMessageEl.textContent = \`Erro ao configurar conexão: \${error.message}\`;
            
            connectionStatusEl.textContent = 'Falha';
            connectionStatusEl.className = 'status disconnected';
            
            connectBtn.disabled = false;
            reconnectBtn.disabled = false;
            disconnectBtn.disabled = true;
            
            logEvent(\`Exceção: \${error.message}\`);
          }
        }
        
        function disconnectFromStream() {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
            
            // Atualizar UI
            connectionStatusEl.textContent = 'Desconectado';
            connectionStatusEl.className = 'status disconnected';
            
            // Atualizar botões
            connectBtn.disabled = false;
            reconnectBtn.disabled = false;
            disconnectBtn.disabled = true;
            
            // Registrar no log
            logEvent('Conexão fechada manualmente');
          }
        }
        
        function logEvent(message) {
          const time = new Date().toLocaleTimeString();
          const logEntry = document.createElement('div');
          logEntry.className = 'log-entry';
          logEntry.innerHTML = \`<span class="log-time">\${time}</span> - \${message}\`;
          
          eventLogEl.prepend(logEntry);
          
          // Limitar o número de entradas de log para evitar problemas de memória
          while (eventLogEl.children.length > 100) {
            eventLogEl.removeChild(eventLogEl.lastChild);
          }
        }
        
        function clearEventLog() {
          // Manter apenas a primeira entrada
          while (eventLogEl.children.length > 1) {
            eventLogEl.removeChild(eventLogEl.lastChild);
          }
          logEvent('Log limpo');
        }
      </script>
    </body>
    </html>
  `);
});

// Exportar o app para ser usado pelo servidor principal
module.exports = app;

// Instruções para integração com o servidor principal
console.log('[FIX-SSE] Para integrar este módulo ao servidor principal:');
console.log('[FIX-SSE] 1. Importe este arquivo no arquivo principal do servidor:');
console.log('[FIX-SSE]    const fixSSE = require("./railway-fix-sse");');
console.log('[FIX-SSE] 2. Use o app exportado no servidor principal:');
console.log('[FIX-SSE]    app.use(fixSSE);');

// Se este arquivo for executado diretamente, iniciar o servidor
if (require.main === module) {
  const PORT = process.env.PORT || 5002;
  app.listen(PORT, () => {
    console.log(`[FIX-SSE] Servidor de teste rodando na porta ${PORT}`);
    console.log(`[FIX-SSE] Acesse: http://localhost:${PORT}/api-fix/stream/roulettes`);
    console.log(`[FIX-SSE] Página de teste: http://localhost:${PORT}/teste-sse`);
  });
} 