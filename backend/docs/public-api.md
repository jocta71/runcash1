# API Pública com Dados Criptografados

## Visão Geral

A nova API pública para dados de roletas fornece acesso sem autenticação, porém com dados criptografados usando o pacote `@hapi/iron`. Isso permite que a API seja acessada diretamente sem verificação de JWT, mas os dados só podem ser decodificados pelo frontend oficial que possui a chave de descriptografia.

## Endpoints Disponíveis

### 1. Listar todas as roletas disponíveis

```
GET /api/public/roulettes
```

**Resposta:**
```json
{
  "success": true,
  "data": "Fe26.2*[dados criptografados]*[timestamp]*[outras informações de segurança]"
}
```

### 2. Obter dados de uma roleta específica

```
GET /api/public/roulettes/:id
```

**Parâmetros:**
- `id`: ID da roleta

**Resposta:**
```json
{
  "success": true,
  "data": "Fe26.2*[dados criptografados]*[timestamp]*[outras informações de segurança]"
}
```

### 3. Obter últimos números em tempo real de todas as roletas

```
GET /api/public/roulettes/realtime/latest
```

**Resposta:**
```json
{
  "success": true,
  "data": "Fe26.2*[dados criptografados]*[timestamp]*[outras informações de segurança]"
}
```

## Como decodificar os dados no frontend

Para decodificar os dados criptografados no seu frontend, você precisa usar a biblioteca `@hapi/iron`:

```javascript
import Iron from '@hapi/iron';

// A chave de descriptografia deve ser a mesma usada no backend
const ENCRYPTION_KEY = 'CwRS4tDa5uY7Bz9E0fGhJmNpQrStVxYz'; 

async function fetchAndDecryptRoulettes() {
  try {
    // Obter dados criptografados da API
    const response = await fetch('/api/public/roulettes');
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Erro ao obter dados');
    }
    
    // Decodificar dados criptografados
    const decryptedData = await Iron.unseal(result.data, ENCRYPTION_KEY, Iron.defaults);
    
    // Usar os dados decodificados
    console.log('Roletas disponíveis:', decryptedData.roulettes);
    return decryptedData;
  } catch (error) {
    console.error('Erro ao decodificar dados:', error);
    throw error;
  }
}
```

## Segurança e Limitações

- Os dados são criptografados usando o algoritmo de criptografia do pacote `@hapi/iron`
- O token criptografado tem um tempo de vida (TTL) definido (60 segundos para listas e dados de roletas, 10 segundos para dados em tempo real)
- A chave de criptografia deve ser mantida em segredo e idealmente armazenada em variáveis de ambiente
- Mesmo que alguém intercepte os dados, não poderá decodificá-los sem a chave correta

## Benefícios desta abordagem

- Reduz a sobrecarga do servidor ao eliminar a verificação de assinatura a cada requisição
- Mantém a segurança dos dados através da criptografia
- Permite implementação de CDN para cachear respostas e melhorar a performance
- Funciona bem com Server-Sent Events (SSE) para dados em tempo real

## Exemplos de uso com SSE (Server-Sent Events)

```javascript
import Iron from '@hapi/iron';

const ENCRYPTION_KEY = 'CwRS4tDa5uY7Bz9E0fGhJmNpQrStVxYz';

function setupSSEConnection() {
  const eventSource = new EventSource('/api/events/roulettes');
  
  eventSource.addEventListener('update', async (event) => {
    try {
      // Decodificar dados do evento
      const encryptedData = event.data;
      const decryptedData = await Iron.unseal(encryptedData, ENCRYPTION_KEY, Iron.defaults);
      
      // Atualizar UI com os dados decodificados
      updateRouletteDisplay(decryptedData);
    } catch (error) {
      console.error('Erro ao processar evento:', error);
    }
  });
  
  eventSource.onerror = (error) => {
    console.error('Erro na conexão SSE:', error);
    // Reconectar após um tempo
    setTimeout(setupSSEConnection, 5000);
  };
}
``` 