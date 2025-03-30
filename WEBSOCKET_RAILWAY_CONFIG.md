# Configuração de WebSocket no Railway

Este documento descreve como configurar corretamente o servidor WebSocket no Railway para evitar problemas de conexão.

## Problema: WebSocket fechando prematuramente

O erro `WebSocket connection to 'wss://runcash1-production.up.railway.app/socket.io/?EIO=4&transport=websocket' failed: WebSocket is closed before the connection is established` ocorre quando a conexão WebSocket é fechada antes mesmo de ser estabelecida completamente.

## Causas comuns

1. **Configuração incorreta do proxy/ingress**: O Railway usa um proxy para gerenciar o tráfego, e esse proxy precisa ser configurado corretamente para permitir conexões WebSocket.
2. **Timeout da conexão**: As conexões WebSocket podem estar sendo fechadas devido a configurações de timeout muito curtas.
3. **Problemas de CORS**: O servidor pode estar rejeitando conexões devido a configurações incorretas de CORS.
4. **SSL/TLS**: Problemas com certificados SSL podem causar falhas na conexão WSS (WebSocket Secure).

## Configurações corrigidas

Foram feitas as seguintes alterações para resolver o problema:

1. **Configuração do Railway** (`railway.toml`):
   ```toml
   [http]
   forwardHeaders = ["Upgrade", "Connection"]
   websockets = true
   upgradeWebsockets = true
   ```

2. **Configuração do Servidor Socket.IO**:
   ```javascript
   const io = new Server(server, {
     cors: {
       origin: "*",
       methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
       credentials: true
     },
     allowEIO3: true,
     transports: ['websocket', 'polling'],
     pingTimeout: 60000,
     pingInterval: 25000,
     upgradeTimeout: 30000,
     path: '/socket.io/',
     connectTimeout: 45000
   });
   ```

3. **Configuração do Cliente Socket.IO**:
   ```javascript
   const socket = io(wsUrl, {
     transports: ['websocket', 'polling'],
     reconnectionAttempts: 10,
     reconnectionDelay: 1000,
     reconnectionDelayMax: 10000,
     timeout: 30000,
     forceNew: true,
     autoConnect: true,
     upgrade: true,
     rejectUnauthorized: false
   });
   ```

## Variáveis de ambiente necessárias

Certifique-se de que as seguintes variáveis de ambiente estejam configuradas no Railway:

- `WEBSOCKET_DEBUG=true` - Ativa logs adicionais para debug
- `WEBSOCKET_HEARTBEAT=15000` - Define o intervalo de heartbeat em ms
- `WEBSOCKET_RECONNECTION_DELAY=5000` - Define o delay para tentativas de reconexão

## Como testar a conexão

Execute o script de diagnóstico para verificar se a conexão WebSocket está funcionando corretamente:

```
node debug_websocket_connection.js
```

Este script tentará estabelecer uma conexão WebSocket com o servidor e mostrará informações detalhadas sobre o processo.

## Solução de problemas adicionais

1. **Erro "xhr poll error"**: 
   - Verifique as configurações de CORS no servidor
   - Verifique se o servidor está acessível via HTTP regular

2. **Erro "transport close"**:
   - O proxy pode estar encerrando a conexão prematuramente
   - Verifique se as configurações de timeout são adequadas

3. **Erro "ping timeout"**:
   - Aumente o valor de `pingTimeout` no servidor
   - Verifique se há problemas de conectividade entre cliente e servidor

## Recursos adicionais

- [Documentação do Socket.IO](https://socket.io/docs/v4/)
- [Configuração de WebSockets no Railway](https://docs.railway.app/reference/websockets)
- [Troubleshooting WebSockets](https://web.dev/articles/websockets-basics) 