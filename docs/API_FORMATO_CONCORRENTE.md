# Implementação de API no Formato do Concorrente

Este documento descreve a implementação da nova API de roletas que utiliza um formato similar ao observado em concorrentes do mercado.

## Formato dos Dados

A API agora retorna dados no seguinte formato:

```json
[
  {
    "id": "a8a1f746-6002-eabf-b14d-d78d13877599",
    "nome": "VIP Roulette",
    "ativa": true,
    "numero": [
      {
        "numero": 28,
        "roleta_id": "2010097",
        "roleta_nome": "VIP Roulette",
        "cor": "preto",
        "timestamp": "2025-05-04T14:31:13.911Z"
      },
      {
        "numero": 7,
        "roleta_id": "2380117",
        "roleta_nome": "VIP Roulette",
        "cor": "vermelho",
        "timestamp": "2025-05-04T14:30:44.764Z"
      }
    ]
  }
]
```

## Criptografia de Dados

Para proteger os dados, a API utiliza criptografia com formato similar ao observado no concorrente:

```json
{
  "event": "update",
  "id": 1,
  "data": "Fe26_2a1f746600eabfb14d_DADOS_CRIPTOGRAFADOS"
}
```

## Rotas Implementadas

1. **GET /api/roulettes**
   - Retorna todas as roletas disponíveis com os últimos números
   - Resposta criptografada

2. **GET /api/roulettes/:id**
   - Retorna uma roleta específica com seus últimos números
   - Resposta criptografada

3. **GET /api/roulettes/:id/numbers**
   - Retorna apenas os números de uma roleta específica
   - Resposta criptografada

## Decodificação no Frontend

Para decodificar os dados no frontend, foi implementado um utilitário em `frontend/src/utils/rouletteDecryptor.js` que:

1. Recebe os dados criptografados da API
2. Remove o prefixo e hash aleatório (Fe26_XXXX)
3. Decodifica usando a biblioteca @hapi/iron
4. Retorna os dados originais

## Exemplo de Uso

```javascript
import { processRouletteResponse } from '../utils/rouletteDecryptor';
import axios from 'axios';

// Função para buscar dados
async function fetchRouletteData() {
  // Chamada para a API
  const response = await axios.get('/api/roulettes');
  
  // Processar resposta (decodificar)
  const processedData = await processRouletteResponse(response.data);
  
  // Dados prontos para uso
  return processedData;
}
```

## Página de Teste

Foi criada uma página de teste em `frontend/src/pages/RouletteTest.js` que demonstra o uso da API com o novo formato.

## Configuração

Para utilizar o sistema, certifique-se de que a mesma chave de criptografia está configurada em:

1. Backend: `process.env.DATA_ENCRYPTION_KEY`
2. Frontend: `process.env.NEXT_PUBLIC_DATA_DECRYPTION_KEY`

A chave padrão é `runcashh_data_encryption_secret_key_32ch`, mas recomenda-se substituí-la por uma chave segura no ambiente de produção. 