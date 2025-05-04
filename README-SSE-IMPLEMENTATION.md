# Implementação de Server-Sent Events (SSE) - Documentação

Este documento descreve a implementação de Server-Sent Events (SSE) para transmissão de dados em tempo real com baixa sobrecarga no sistema.

## Visão Geral

A solução implementada permite que o servidor envie dados em tempo real para múltiplos clientes através de um único endpoint. Ao contrário de requisições HTTP tradicionais, onde cada cliente faria polling repetidamente, o SSE mantém uma conexão aberta por cliente e o servidor envia atualizações apenas quando há novos dados.

### Benefícios Principais

- **Redução de sobrecarga no servidor**: Cada usuário mantém apenas uma conexão, em vez de fazer múltiplas requisições
- **Dados em tempo real**: As atualizações são enviadas instantaneamente quando disponíveis
- **Segurança mantida**: Os dados são criptografados e a verificação de assinatura é realizada na conexão inicial
- **Compatibilidade com navegadores**: Funciona em todos os navegadores modernos
- **Escalabilidade**: Suporta milhares de conexões simultâneas com impacto mínimo no servidor

## Arquitetura

![Arquitetura SSE](https://i.imgur.com/sD67Uyk.png)

### Componentes Principais

1. **Controller SSE** (`streamController.js`): Gerencia as requisições e estabelece conexões SSE
2. **Serviço de Stream** (`streamService.js`): Mantém registro de clientes e envia eventos
3. **Job de Atualização** (`streamUpdateJob.js`): Monitora por novos dados e dispara eventos
4. **Utilitário de Criptografia** (`encryption.js`): Garante segurança dos dados transmitidos

## Segurança

A implementação inclui várias camadas de segurança:

1. **Autenticação**: Verificação de token JWT na conexão inicial
2. **Verificação de Assinatura**: Apenas usuários com assinatura ativa podem se conectar
3. **Criptografia de Dados**: Todos os dados são criptografados no formato Fe26.2
4. **Token no Payload**: Inclui timestamp para evitar replay attacks
5. **Verificação de Origem**: Cabeçalhos de segurança para evitar vazamento de dados

## Uso no Backend

### Iniciar o Job de Streaming

O job de streaming é iniciado automaticamente no arquivo `index.js`:

```javascript
// Iniciar job de atualização de streams
const { startStreamUpdateJob } = require('./jobs/streamUpdateJob');
const stopStreamJob = startStreamUpdateJob(5000); // Verificar a cada 5 segundos
```

### Enviar Dados para Clientes Conectados

```javascript
const { broadcastToResource } = require('./services/streamService');

// Enviar dados para clientes de uma roleta específica
broadcastToResource('ROULETTE', roletaId, {
  update_type: 'new_number',
  number: {
    value: 25,
    color: 'red',
    timestamp: new Date()
  }
});
```

## Uso no Frontend

### Conectar ao Stream (React)

```jsx
import { useState, useEffect } from 'react';

function useRouletteStream(gameId, token) {
  const [numbers, setNumbers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    if (!gameId || !token) return;
    
    const url = `/stream/rounds/ROULETTE/${gameId}/v2/live?k=3`;
    const eventSource = new EventSource(`${url}&token=${encodeURIComponent(token)}`);
    
    eventSource.addEventListener('update', async (event) => {
      const decryptedData = await decryptData(event.data);
      
      if (decryptedData.update_type === 'new_number') {
        setNumbers(prev => [decryptedData.number, ...prev].slice(0, 50));
      }
    });
    
    return () => eventSource.close();
  }, [gameId, token]);
  
  return { numbers, isConnected };
}
```

### Uso em Outros Frameworks

O mesmo conceito pode ser aplicado em Vue.js, Angular ou JavaScript puro:

```javascript
// Vanilla JavaScript
const eventSource = new EventSource('/stream/rounds/ROULETTE/123/v2/live?token=...');

eventSource.addEventListener('update', async (event) => {
  const data = await decryptData(event.data);
  console.log('Novo número:', data.number.value);
});
```

## Configuração

### Variáveis de Ambiente

- `SSE_ENCRYPTION_KEY`: Chave para criptografar/descriptografar dados SSE
- `POLL_INTERVAL`: Intervalo em ms para verificar novos dados (padrão: 5000)

### Endpoints

- **GET** `/stream/rounds/:gameType/:gameId/:version/live`: Endpoint principal SSE
- **GET** `/stream/status`: Verifica status do serviço de streaming

## Considerações de Implementação

### Proxies e Load Balancers

Se o servidor estiver atrás de proxies ou balanceadores de carga, certifique-se que eles estão configurados para suportar conexões persistentes e não armazenar em buffer as respostas SSE:

```
# Configuração Nginx para SSE
proxy_set_header Connection '';
proxy_http_version 1.1;
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
```

### Clientes sem Suporte

Para navegadores antigos ou ambientes que não suportam SSE, é recomendado implementar um fallback com polling tradicional.

## Performance e Escalabilidade

- O sistema suporta facilmente **milhares de conexões** simultâneas em hardware modesto
- Para **dezenas de milhares** de conexões, considere:
  - Implementar clustering de Node.js
  - Distribuir a carga entre múltiplas instâncias
  - Usar Redis pub/sub para coordenar atualizações entre instâncias

## Extensões Possíveis

- **Canais temáticos**: Permitir inscrição em tipos específicos de eventos
- **Compressão de dados**: Reduzir tamanho de payloads grandes
- **Métricas de conexão**: Monitorar número de clientes conectados
- **Heartbeat inteligente**: Ajustar frequência de keep-alive baseado na carga

## Troubleshooting

### Problemas Comuns

1. **Conexão fechando inesperadamente**: Verifique timeouts de proxies/load balancers
2. **Atrasos na entrega de mensagens**: Ajuste o job de verificação para intervalos menores
3. **Erro de descriptografia**: Verifique se as chaves são consistentes entre serviços

### Logs de Diagnóstico

Os logs do sistema incluem prefixos para facilitar depuração:
- `[STREAM]`: Logs do serviço de streaming
- `[STREAM JOB]`: Logs do job de atualização
- `[STREAM {connectionId}]`: Logs de conexões específicas

## Conclusão

Esta implementação permite transmitir dados em tempo real de forma eficiente e segura para todos os usuários com assinatura ativa, reduzindo drasticamente a sobrecarga no servidor comparado ao sistema anterior baseado em múltiplas requisições HTTP. 