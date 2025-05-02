# API de Roletas Específicas - RunCash

Este documento descreve as APIs específicas para cada roleta individual disponíveis no backend do RunCash.

## Visão Geral

O sistema agora suporta endpoints dedicados para cada roleta, permitindo consultas específicas por ID de roleta. Isso facilita a integração com aplicações que acompanham roletas específicas.

## Endpoints HTTP

### Obter Dados Básicos da Roleta

```
GET /api/roulette/:id
```

**Parâmetros:**
- `id`: ID da roleta (obrigatório)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "_id": "60f1a5b3c9e4b2001f7c8f4d",
    "name": "Roleta Brasileira",
    "provider": "Evolution Gaming",
    "status": "online",
    "createdAt": "2023-01-15T12:30:45Z"
  }
}
```

### Obter Números Recentes

```
GET /api/roulette/:id/numbers
```

**Parâmetros:**
- `id`: ID da roleta (obrigatório)
- `limit`: Quantidade de números a retornar (opcional, padrão: 20)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "rouletteId": "60f1a5b3c9e4b2001f7c8f4d",
    "numbers": [
      {
        "number": 7,
        "timestamp": "2023-08-24T15:30:22Z",
        "color": "red"
      },
      {
        "number": 12,
        "timestamp": "2023-08-24T15:29:15Z",
        "color": "red"
      }
    ],
    "count": 2,
    "lastUpdated": "2023-08-24T15:30:22Z"
  }
}
```

### Obter Estatísticas

```
GET /api/roulette/:id/stats
```

**Parâmetros:**
- `id`: ID da roleta (obrigatório)
- `full`: Se true, retorna estatísticas completas (requer autenticação)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "rouletteId": "60f1a5b3c9e4b2001f7c8f4d",
    "stats": {
      "colors": {
        "red": 45,
        "black": 43,
        "green": 5
      },
      "parity": {
        "even": 44,
        "odd": 44
      },
      "dozens": {
        "first": 30,
        "second": 31,
        "third": 32
      },
      "columns": {
        "first": 32,
        "second": 31,
        "third": 30
      },
      "halves": {
        "first": 47,
        "second": 46
      }
    },
    "basedOn": 93,
    "lastUpdated": "2023-08-24T15:30:22Z"
  }
}
```

### Obter Status da Roleta

```
GET /api/roulette/:id/status
```

**Parâmetros:**
- `id`: ID da roleta (obrigatório)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "60f1a5b3c9e4b2001f7c8f4d",
    "name": "Roleta Brasileira",
    "status": "online",
    "lastNumber": 15,
    "lastUpdate": "2023-08-24T15:30:22Z",
    "currentTime": "2023-08-24T15:31:05Z"
  }
}
```

### Obter Estratégias (Requer Assinatura)

```
GET /api/roulette/:id/strategies
```

**Parâmetros:**
- `id`: ID da roleta (obrigatório)

**Headers:**
- `Authorization`: Bearer {token} (obrigatório)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "rouletteId": "60f1a5b3c9e4b2001f7c8f4d",
    "strategies": [
      {
        "name": "Sequência de Cores",
        "description": "Baseado na análise dos últimos 50 números",
        "prediction": "Vermelho",
        "confidence": 0.75
      },
      {
        "name": "Dúzias",
        "description": "Baseado na análise de frequência",
        "prediction": "Primeira Dúzia (1-12)",
        "confidence": 0.68
      }
    ],
    "disclaimer": "Estas estratégias são baseadas em análise estatística e não garantem resultados",
    "lastUpdated": "2023-08-24T15:31:05Z"
  }
}
```

## WebSocket

Além dos endpoints HTTP, também é possível receber atualizações em tempo real de roletas específicas via WebSocket.

### Eventos Disponíveis

#### Inscrever-se em uma Roleta

Envie:
```javascript
socket.emit('join_roulette', 'ID_DA_ROLETA');
```

Recebe:
```javascript
socket.on('joined_roulette', (data) => {
  console.log(`Inscrito na roleta ${data.rouletteId}`);
});
```

#### Cancelar Inscrição

Envie:
```javascript
socket.emit('leave_roulette', 'ID_DA_ROLETA');
```

Recebe:
```javascript
socket.on('left_roulette', (data) => {
  console.log(`Inscrição cancelada na roleta ${data.rouletteId}`);
});
```

#### Solicitar Último Número

Envie:
```javascript
socket.emit('get_last_number', 'ID_DA_ROLETA');
```

Recebe:
```javascript
socket.on('last_number', (data) => {
  console.log(`Último número da roleta ${data.rouletteId}: ${data.number}`);
});
```

#### Receber Atualizações

```javascript
socket.on('number_update', (data) => {
  console.log(`Novo número na roleta ${data.rouletteId}: ${data.number} (${data.color})`);
});
```

## Exemplo de Uso (JavaScript)

```javascript
// Conectar ao servidor WebSocket
const socket = io('https://api.runcash.com', {
  transports: ['websocket']
});

// Inscrever-se em uma roleta específica
socket.emit('join_roulette', '60f1a5b3c9e4b2001f7c8f4d');

// Receber confirmação de inscrição
socket.on('joined_roulette', (data) => {
  console.log(`Inscrito na roleta ${data.rouletteId}`);
});

// Receber atualizações de números
socket.on('number_update', (data) => {
  console.log(`Novo número na roleta ${data.rouletteId}: ${data.number} (${data.color})`);
  
  // Atualizar interface do usuário
  updateRouletteUI(data);
});

// Função para buscar histórico via HTTP
async function getRouletteHistory(rouletteId) {
  const response = await fetch(`https://api.runcash.com/api/roulette/${rouletteId}/numbers?limit=50`);
  const data = await response.json();
  
  if (data.success) {
    // Processar dados
    processRouletteHistory(data.data.numbers);
  }
}

// Função para buscar estatísticas via HTTP
async function getRouletteStats(rouletteId) {
  const response = await fetch(`https://api.runcash.com/api/roulette/${rouletteId}/stats`);
  const data = await response.json();
  
  if (data.success) {
    // Processar estatísticas
    displayRouletteStats(data.data.stats);
  }
}
```

## Limitações

- As APIs públicas têm limites de taxa e de quantidade de dados retornados
- Estatísticas detalhadas e estratégias requerem uma assinatura válida
- Os dados históricos são limitados a 1000 números por consulta

## Códigos de Erro

- `404`: Roleta não encontrada
- `403`: Acesso negado (assinatura necessária)
- `429`: Limite de taxa excedido
- `500`: Erro interno do servidor

Para mais informações, entre em contato com o suporte técnico. 