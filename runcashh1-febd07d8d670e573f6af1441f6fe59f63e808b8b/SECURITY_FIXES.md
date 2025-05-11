# Correções de Segurança do Sistema RunCash

## Correções Implementadas em 03/05/2025

### 1. Correção da Autenticação WebSocket

Foi identificado um problema crítico de segurança no servidor WebSocket, onde as conexões não estavam sendo devidamente autenticadas apesar do middleware estar configurado. O problema ocorria porque o módulo `jsonwebtoken` (JWT) não estava sendo importado no escopo global, impossibilitando a validação do token no middleware.

**Alterações realizadas:**

1. **Importação global do módulo JWT:**
   ```javascript
   const jwt = require('jsonwebtoken');
   ```

2. **Definição global da chave secreta:**
   ```javascript
   const JWT_SECRET = process.env.JWT_SECRET || 'runcashh_secret_key';
   ```

3. **Atualização do middleware de autenticação:**
   ```javascript
   io.use((socket, next) => {
     try {
       const token = socket.handshake.query.token || socket.handshake.headers.authorization?.split(' ')[1];
       
       if (!token) {
         console.log(`[WebSocket Middleware] Conexão rejeitada: ${socket.id} - Token ausente`);
         return next(new Error('Autenticação necessária. Token não fornecido.'));
       }
       
       // Verificar JWT com a constante global JWT_SECRET
       const decoded = jwt.verify(token, JWT_SECRET);
       
       // Guardar dados do usuário no socket
       socket.user = decoded;
       socket.isAuthenticated = true;
       
       console.log(`[WebSocket Middleware] Conexão autorizada: ${socket.id} - Usuário: ${decoded.username || decoded.email || decoded.id || 'usuário'}`);
       return next();
     } catch (error) {
       console.log(`[WebSocket Middleware] Conexão rejeitada: ${socket.id} - Erro: ${error.message}`);
       return next(new Error('Token inválido ou expirado. Por favor, autentique-se novamente.'));
     }
   });
   ```

4. **Verificação secundária no evento de conexão:**
   ```javascript
   io.on('connection', async (socket) => {
     // Verificar se o socket já foi autenticado pelo middleware
     if (!socket.isAuthenticated) {
       console.log(`[WebSocket] Tentativa de uso sem autenticação: ${socket.id}`);
       socket.emit('error', { message: 'Autenticação necessária para usar este serviço.' });
       socket.disconnect(true);
       return;
     }
     
     // Resto do código...
   });
   ```

5. **Padronização do uso da constante JWT_SECRET:**
   - Todas as ocorrências de verificação JWT no código agora usam a mesma constante global para garantir consistência e segurança.

### 2. Correção das Verificações JWT nas Rotas da API

Além da correção no WebSocket, também foi identificado que as rotas da API possuíam importações redundantes do módulo JWT e definições locais da chave secreta. Isso foi corrigido para usar a constante global.

**Alterações realizadas:**

1. **Remoção de importações redundantes:**
   - Removidas todas as instâncias de `const jwt = require('jsonwebtoken');` dentro de funções.

2. **Uso da constante global JWT_SECRET:**
   - Todas as instâncias de `const secret = process.env.JWT_SECRET || 'runcashh_secret_key';` foram removidas.
   - Substituídas todas as referências a `secret` por `JWT_SECRET`.

### 3. Melhorias para Detecção de Problemas

1. **Log de inicialização aprimorado:**
   ```javascript
   console.log(`JWT_SECRET: ${JWT_SECRET ? '******' : 'Não definido'}`);
   ```

2. **Log detalhado de middleware:**
   ```javascript
   console.log('[Socket.IO] Registrando middleware de autenticação JWT...');
   console.log('[Socket.IO] Middleware de autenticação JWT registrado com sucesso');
   ```

## Impacto das Correções

1. **Segurança Aprimorada:**
   - WebSocket agora rejeita corretamente conexões sem token de autenticação válido.
   - Detecção e rejeição consistente de tokens inválidos ou expirados.

2. **Integridade de Dados:**
   - Apenas usuários autenticados podem receber dados em tempo real das roletas.
   - Proteção contra acesso não autorizado a dados sensíveis.

3. **Consistência:**
   - Uso da mesma chave JWT em todo o sistema.
   - Comportamento de autenticação consistente entre a API REST e o WebSocket.

## Testes de Validação Recomendados

1. **Teste de Acesso WebSocket Sem Token:**
   - Tentar conectar ao WebSocket sem fornecer token (deve ser rejeitado)

2. **Teste de Acesso WebSocket Com Token Inválido:**
   - Tentar conectar com token inválido (deve ser rejeitado)

3. **Teste de Acesso WebSocket Com Token Válido:**
   - Conectar com token válido (deve ser aceito)
   
4. **Teste de Operações WebSocket:**
   - Verificar se operações como subscrição a roletas exigem autenticação

5. **Teste de Acesso à API REST:**
   - Verificar se as rotas protegidas da API REST exigem autenticação válida

## Monitoramento

Após a implementação destas correções, é recomendado monitorar:

1. **Logs do Servidor:**
   - Verificar tentativas de conexão WebSocket sem autenticação
   - Analisar padrões de tentativas de acesso não autorizado

2. **Desempenho:**
   - Confirmar que as verificações de token não impactam significativamente a performance

3. **Feedback de Usuários:**
   - Verificar se há relatos de problemas de conexão após as mudanças 