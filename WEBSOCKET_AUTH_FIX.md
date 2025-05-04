# Correção da Autenticação WebSocket RunCash

## Problema Identificado

Após testes detalhados, identificamos que o serviço WebSocket do RunCash **não está aplicando a autenticação JWT** conforme esperado. A conexão WebSocket está permitindo acesso sem token de autenticação, o que representa uma falha grave de segurança.

## Causa do Problema

Através da análise do código-fonte, identificamos o problema específico:

1. No arquivo `backend/websocket_server.js`, o módulo `jsonwebtoken` não está sendo importado no escopo global onde é utilizado.
2. Na linha 360, o middleware de autenticação Socket.IO tenta utilizar o objeto `jwt` que não foi importado nesse contexto.
3. As importações do módulo `jwt` ocorrem apenas em funções locais (nas linhas 631, 754 e 1645).

## Solução

### 1. Correção Imediata

Adicionar a importação do módulo `jsonwebtoken` no topo do arquivo `backend/websocket_server.js`:

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Adicionar esta linha

// Resto do código...
```

### 2. Refatoração do Middleware de Autenticação

Além disso, recomendamos refatorar o middleware de autenticação para garantir que ele rejeite conexões sem token, e também criar uma verificação secundária no evento de conexão:

```javascript
// Verificar se o middleware de autenticação está sendo registrado corretamente
console.log('[Socket.IO] Registrando middleware de autenticação JWT...');

// Adicionar middleware de autenticação global para todas as conexões Socket.io
io.use((socket, next) => {
  try {
    const token = socket.handshake.query.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log(`[WebSocket Middleware] Conexão rejeitada: ${socket.id} - Token ausente`);
      return next(new Error('Autenticação necessária. Token não fornecido.'));
    }
    
    // Verificar JWT com constante global
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcashh_secret_key');
    
    // Guardar dados do usuário no socket
    socket.user = decoded;
    socket.isAuthenticated = true;
    
    console.log(`[WebSocket Middleware] Conexão autorizada: ${socket.id} - Usuário: ${decoded.username || decoded.email || 'usuário'}`);
    return next();
  } catch (error) {
    console.log(`[WebSocket Middleware] Conexão rejeitada: ${socket.id} - Erro: ${error.message}`);
    return next(new Error('Token inválido ou expirado. Por favor, autentique-se novamente.'));
  }
});

console.log('[Socket.IO] Middleware de autenticação JWT registrado com sucesso');
```

### 3. Verificação Secundária no Evento de Conexão

Adicionar uma verificação no evento `connection` para garantir que apenas sockets autenticados possam realizar operações:

```javascript
// Verificar a autenticação explicitamente em cada operação do socket
io.on('connection', (socket) => {
  // Log de conexão
  console.log(`[Socket.IO] Nova conexão: ${socket.id}`);
  
  // Verificar autenticação antes de permitir qualquer operação
  if (!socket.isAuthenticated) {
    console.log(`[Socket.IO] Tentativa de uso sem autenticação: ${socket.id}`);
    socket.emit('error', { message: 'Autenticação necessária para usar este serviço.' });
    socket.disconnect(true);
    return;
  }
  
  // Evento de conexão bem-sucedida com informações do usuário
  socket.emit('connection_success', {
    user: socket.user,
    message: 'Conectado com sucesso ao WebSocket RunCash',
    socket_id: socket.id,
    timestamp: new Date().toISOString()
  });
  
  // Restante das configurações do socket...
});
```

## Implementação

### Opção 1: Aplicar Patch Rápido

1. Editar diretamente o arquivo `backend/websocket_server.js`
2. Adicionar a linha `const jwt = require('jsonwebtoken');` no início do arquivo, junto com as outras importações
3. Reiniciar o serviço WebSocket

### Opção 2: Atualização Completa

1. Substituir o arquivo atual por uma versão corrigida (exemplo: `websocket_server_fix.js`)
2. Testar exaustivamente a nova implementação
3. Implantar em produção após validação

## Testes para Validar a Correção

1. Tentar conectar ao WebSocket sem fornecer token (deve ser rejeitado)
2. Tentar conectar com token inválido (deve ser rejeitado)
3. Conectar com token válido (deve ser aceito)
4. Verificar se operações como subscrição a roletas exigem autenticação

## Monitoramento

Após a implementação, é crucial monitorar atentamente:

1. Logs do servidor para verificar tentativas de conexão sem autenticação
2. Desempenho do serviço para garantir que a validação de tokens não impacte a performance
3. Feedback dos usuários sobre qualquer problema de conexão

## Documentação

Após a correção, atualizar a documentação para refletir o fato de que a autenticação está funcionando corretamente.

---

**IMPORTANTE**: Esta correção é crítica para a segurança do sistema e deve ser implementada o mais rápido possível para evitar acesso não autorizado aos dados em tempo real do RunCash. 