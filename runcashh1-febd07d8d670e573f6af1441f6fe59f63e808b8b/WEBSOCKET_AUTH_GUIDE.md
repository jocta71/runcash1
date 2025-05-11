# Guia de Autenticação do WebSocket RunCash

## Visão Geral

A API WebSocket do RunCash agora requer autenticação para todas as conexões. Esta implementação de segurança garante que apenas usuários autenticados possam acessar os dados em tempo real e realizar operações no sistema.

## Método de Autenticação

A autenticação é implementada usando JSON Web Tokens (JWT), o mesmo mecanismo usado pela API REST. A autenticação JWT traz as seguintes vantagens:

- **Stateless**: O servidor não precisa manter estado da sessão
- **Segurança**: Os tokens são assinados e limitados por tempo
- **Consistência**: Mesma autenticação usada na API REST e WebSocket
- **Verificação Contínua**: Os tokens são validados em cada operação

## Como Conectar ao WebSocket

### 1. Obter um Token JWT

Primeiro, você precisa autenticar o usuário através da API REST para obter um token JWT válido:

```javascript
// Exemplo usando fetch
fetch('https://backendapi-production-36b5.up.railway.app/api/simple-auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'seu_usuario',
    password: 'sua_senha'
  })
})
.then(response => response.json())
.then(data => {
  const token = data.token;
  // Use este token para conectar ao WebSocket
});
```

### 2. Conectar ao WebSocket com o Token

Existem duas maneiras de incluir o token na conexão WebSocket:

#### Opção 1: Como parâmetro de consulta na URL (Query Parameter)

```javascript
const socket = io('https://backendapi-production-36b5.up.railway.app', {
  query: {
    token: 'seu_token_jwt'
  }
});
```

#### Opção 2: Como cabeçalho de autorização (Authorization Header)

```javascript
const socket = io('https://backendapi-production-36b5.up.railway.app', {
  extraHeaders: {
    Authorization: `Bearer seu_token_jwt`
  }
});
```

## Tratamento de Erros de Autenticação

O servidor WebSocket responderá com erros específicos em caso de falha na autenticação:

```javascript
// Tratar erros de conexão
socket.on('connect_error', (error) => {
  console.error('Erro de conexão:', error.message);
  // Aqui você pode implementar uma lógica para redirecionar para a tela de login
});

// Tratar mensagens de erro específicas
socket.on('error', (data) => {
  console.error('Erro do servidor:', data.message);
  // Ex: "Token inválido ou expirado. Por favor, autentique-se novamente."
});
```

## Renovação de Token

O token JWT possui um tempo de expiração. Quando expirar, o cliente receberá um erro de autenticação e deverá:

1. Obter um novo token através da API REST
2. Desconectar o socket atual
3. Reconectar com o novo token

```javascript
// Exemplo de reconexão após expiração do token
socket.on('error', async (data) => {
  if (data.message.includes('expirado')) {
    // Obter novo token
    const newToken = await refreshToken();
    
    // Desconectar socket atual
    socket.disconnect();
    
    // Reconectar com novo token
    const newSocket = io('https://backendapi-production-36b5.up.railway.app', {
      query: { token: newToken }
    });
    
    // Configurar os handlers para o novo socket
    setupSocketHandlers(newSocket);
  }
});
```

## Permissões por Plano de Assinatura

O sistema verifica não apenas a autenticação, mas também o plano de assinatura do usuário. Diferentes funcionalidades podem estar disponíveis dependendo do plano contratado.

Os níveis de plano incluem:
- FREE
- BASIC
- PRO
- PREMIUM

## Segurança Adicional

- As conexões sem autenticação serão automaticamente rejeitadas
- Os tokens JWT expirados serão rejeitados
- Cada evento emitido pelo cliente é verificado para garantir que o usuário ainda está autenticado
- Todas as tentativas de conexão e autenticação são registradas para auditoria

## Exemplo Completo em JavaScript

```javascript
// Autenticar e obter token
async function autenticar() {
  const response = await fetch('https://backendapi-production-36b5.up.railway.app/api/simple-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'seu_usuario',
      password: 'sua_senha'
    })
  });
  
  const data = await response.json();
  return data.token;
}

// Conectar ao WebSocket
async function conectarWebSocket() {
  const token = await autenticar();
  
  const socket = io('https://backendapi-production-36b5.up.railway.app', {
    query: { token }
  });
  
  // Evento de conexão bem-sucedida
  socket.on('connection_success', (data) => {
    console.log('Conectado com sucesso!', data);
  });
  
  // Tratamento de erros
  socket.on('connect_error', (error) => {
    console.error('Erro de conexão:', error.message);
  });
  
  socket.on('error', (data) => {
    console.error('Erro do servidor:', data.message);
  });
  
  // Exemplo de subscrição a uma roleta
  socket.on('connect', () => {
    socket.emit('subscribe', 'nome_da_roleta');
  });
  
  // Receber novos números
  socket.on('new_number', (data) => {
    console.log('Novo número:', data);
  });
  
  // Receber atualizações de estratégia
  socket.on('strategy_update', (data) => {
    console.log('Atualização de estratégia:', data);
  });
  
  return socket;
}

// Iniciar conexão
conectarWebSocket().catch(console.error);
```

## Suporte

Em caso de problemas ou dúvidas sobre a autenticação WebSocket, entre em contato com nossa equipe de suporte. 