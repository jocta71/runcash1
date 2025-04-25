# Guia de Implementação de Endpoints Otimizados

Este documento descreve as alterações necessárias para implementar os endpoints otimizados no backend e frontend.

## Visão Geral

O frontend está preparado para usar endpoints otimizados para buscar dados das roletas, mas atualmente está usando o endpoint padrão (`/api/ROULETTES`) devido à indisponibilidade dos endpoints otimizados no backend.

## Endpoints Otimizados a Implementar no Backend

1. **`/api/roulettes-batch`**
   - Retorna dados de roletas em lote com processamento otimizado
   - Parâmetros: `limit` (padrão: 1000)
   - Formato de resposta: Igual ao `/api/ROULETTES`, um array de objetos de roleta

2. **`/api/roulettes-list`**
   - Retorna uma lista simplificada de roletas (pode ter campos adicionais)
   - Parâmetros: `limit` (padrão: 1000)
   - Formato de resposta: Array de objetos de roleta

## Como Ativar os Endpoints Otimizados no Frontend

Quando os endpoints otimizados estiverem disponíveis no backend, siga estes passos:

1. Modifique o arquivo `src/services/GlobalRouletteDataService.ts`:

```typescript
// Em fetchRouletteData()
const data = await fetchWithCorsSupport<any[]>(`/api/roulettes-batch?limit=${DEFAULT_LIMIT}`);

// Em fetchDetailedRouletteData()
// Descomente e adapte a implementação detalhada para usar roulettes-list
```

2. Atualize o arquivo `src/utils/diagnostico.ts`:
   - Remova a nota sobre o uso temporário do endpoint padrão
   - Ajuste a ordem dos endpoints, colocando os otimizados como principais

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

## Testando as Alterações

Após implementar os endpoints otimizados no backend:

1. Use a ferramenta de diagnóstico para verificar se os endpoints estão online:
   ```javascript
   window.__runcashDiagnostico()
   ```

2. Verifique os logs no console para confirmar que as requisições estão sendo feitas para os endpoints corretos

3. Monitore a performance para garantir que os endpoints otimizados estão realmente melhorando a velocidade da aplicação

## Notas de Implementação

- Considere implementar cache no backend para melhorar ainda mais a performance
- Ao implementar `/api/roulettes-list`, priorize os campos mais usados para reduzir o tamanho da resposta
- Considere adicionar compressão (gzip) nas respostas para reduzir ainda mais o tamanho dos dados transferidos 