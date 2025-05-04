# Implementação de API Pública com Server-Sent Events (SSE) e Criptografia

Esta implementação substitui a autenticação JWT tradicional por um sistema que criptografa os dados e os envia através de Server-Sent Events (SSE).

## Visão Geral

Ao invés de verificar a assinatura do usuário a cada requisição, o sistema:

1. Permite acesso público a endpoints específicos
2. Criptografa os dados antes de enviá-los
3. Utiliza SSE para enviar atualizações em tempo real
4. Reduz a sobrecarga no servidor pois:
   - Não precisa verificar JWT a cada requisição
   - Mantém uma única conexão persistente por cliente (SSE)
   - Envia dados apenas quando há atualizações

## Como Ativar

Para ativar o sistema, defina a variável de ambiente:

```
DISABLE_JWT_FOR_ROULETTES=true
```

Ou adicione esta variável ao arquivo `.env`:

```
DISABLE_JWT_FOR_ROULETTES=true
IRON_SECRET_KEY=sua_chave_secreta_aqui
```

## Endpoints Disponíveis

Com o sistema ativado, dois novos endpoints estarão disponíveis:

1. **GET /api/public/roulettes** - Retorna dados criptografados em uma requisição HTTP normal
2. **GET /api/stream/roulettes** - Estabelece uma conexão SSE (Server-Sent Events) para receber atualizações em tempo real

## Segurança

Os dados são criptografados usando a biblioteca [@hapi/iron](https://github.com/hapijs/iron), que implementa o algoritmo Iron (também conhecido como Fe26). Este formato:

- Criptografa o conteúdo (confidencialidade)
- Verifica a integridade dos dados (HMAC)
- Inclui timestamp de expiração
- É resistente a tampering e replay attacks

A chave de criptografia é definida em `IRON_SECRET_KEY` e deve ser mantida em segredo.

## Implementação no Frontend

No frontend, a implementação possui dois componentes principais:

1. **RouletteSSEService.js** - Serviço para consumir os eventos SSE
2. **cryptoUtil.js** - Utilitário para descriptografar dados

Para utilizar:

```javascript
import RouletteSSEService from './services/RouletteSSEService';

// Em um componente React
useEffect(() => {
  // Conectar ao serviço SSE
  RouletteSSEService.connect();
  
  // Registrar ouvinte para receber dados
  const unsubscribe = RouletteSSEService.subscribe((type, data) => {
    if (type === 'data') {
      console.log('Novos dados recebidos:', data);
      // Atualizar estado com os dados
    }
  });
  
  // Limpar na desmontagem
  return () => {
    unsubscribe();
    RouletteSSEService.disconnect();
  };
}, []);
```

## Vantagens

Esta solução oferece várias vantagens:

1. **Reduz sobrecarga do servidor** - Menos requisições por cliente
2. **Atualizações em tempo real** - Clientes recebem dados assim que disponíveis
3. **Segurança mantida** - Dados criptografados, inutilizáveis sem a chave
4. **Melhor experiência do usuário** - Dados atualizados automaticamente na interface
5. **Cacheável** - As respostas podem ser cacheadas em CDNs

## Considerações Técnicas

- A implementação de descriptografia no frontend é simplificada. Em produção, seria necessário usar uma biblioteca completa ou implementação via WebAssembly
- O sistema atualiza os dados a cada 5 segundos para todos os clientes conectados
- Em caso de falha no SSE, há um fallback para requisições HTTP normais 