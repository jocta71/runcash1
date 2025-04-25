# Guia de Implementação de Endpoints Otimizados

Este documento descreve as alterações necessárias para implementar os endpoints otimizados no backend e frontend.

## Visão Geral

O frontend está preparado para usar endpoints otimizados para buscar dados das roletas, mas atualmente está usando o endpoint padrão (`/api/ROULETTES`) com parâmetros otimizados baseados em análise de concorrentes.

## Endpoints Otimizados a Implementar no Backend

1. **`/api/roulettes-batch`**
   - Retorna dados de roletas em lote com processamento otimizado
   - Parâmetros: 
     - `limit` (padrão: 800)
     - `t` (timestamp para cache)
     - `subject` (tipo de operação, ex: "filter")
   - Formato de resposta: Igual ao `/api/ROULETTES`, um array de objetos de roleta

2. **`/api/roulettes-list`**
   - Retorna uma lista simplificada de roletas (pode ter campos adicionais)
   - Parâmetros: 
     - `limit` (padrão: 800)
     - `t` (timestamp para cache)
     - `subject` (tipo de operação, ex: "filter")
   - Formato de resposta: Array de objetos de roleta

## Como Ativar os Endpoints Otimizados no Frontend

Quando os endpoints otimizados estiverem disponíveis no backend, siga estes passos:

1. Modifique o arquivo `src/services/GlobalRouletteDataService.ts`:

```typescript
// Em fetchRouletteData()
const timestamp = Date.now();
const data = await fetchWithCorsSupport<any[]>(`/api/roulettes-batch?limit=${DEFAULT_LIMIT}&t=${timestamp}&subject=filter`);

// Em fetchDetailedRouletteData()
const timestamp = Date.now();
const data = await fetchWithCorsSupport<any[]>(`/api/roulettes-list?limit=${DETAILED_LIMIT}&t=${timestamp}&subject=filter`);
```

2. Atualize o arquivo `src/utils/diagnostico.ts`:
   - Ajuste a ordem dos endpoints, colocando os otimizados como principais
   - Atualize as mensagens de log para refletir o uso dos endpoints otimizados

3. Atualize o CHANGELOG com as alterações

## Formato Esperado dos Dados

Os endpoints otimizados devem retornar dados no mesmo formato que o endpoint `/api/ROULETTES` para manter a compatibilidade:

```json
[
  {
    "id": "string",
    "nome": "string",
    "ultimoNumero": 123,
    "horario": "2023-11-16T12:00:00.000Z",
    "numero": [1, 2, 3, ...],
    ... outros campos
  },
  ...
]
```

## Otimizações Adicionais

Com base na análise de concorrentes, estas otimizações adicionais são recomendadas:

1. **Compressão de Payload**: Implementar compressão eficiente nos dados retornados (gzip ou Brotli)

2. **Estrutura de Resposta Compacta**: Considerar um formato JSON mais compacto para reduzir o tamanho dos dados transferidos 

3. **Cache Inteligente**: Utilizar o parâmetro timestamp para criar um sistema de caching eficiente

4. **Limite Reduzido**: Adotar o limite de 800 itens por requisição em vez de 1000

## Testando as Alterações

Após implementar os endpoints otimizados no backend:

1. Use a ferramenta de diagnóstico para verificar se os endpoints estão online:
   ```javascript
   window.__runcashDiagnostico()
   ```

2. Verifique os logs no console para confirmar que as requisições estão sendo feitas para os endpoints corretos

3. Monitore a performance para garantir que os endpoints otimizados estão realmente melhorando a velocidade da aplicação

## Notas de Implementação

- Ao implementar os novos endpoints no backend, considere uma arquitetura que permita escalar horizontalmente
- Priorize a velocidade de resposta e o tamanho reduzido do payload
- Implemente mecanismos de resiliência para caso de falha (fallback para outros endpoints) 