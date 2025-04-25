# Otimizações do Backend RunCash

Este documento descreve as otimizações implementadas para melhorar o desempenho da API, especialmente para a consulta de grandes volumes de dados das roletas.

## Problema Original

A API apresentava lentidão ao carregar dados de roletas via `/api/roulettes?1000`, especialmente devido à necessidade de obter 1000 números para cada uma das 39 roletas disponíveis.

## Otimizações Implementadas

### 1. Sistema de Cache em Múltiplos Níveis

Foi implementado um sistema de cache com vários níveis:

- **Cache global**: Armazena o resultado completo da consulta de todas as roletas
- **Cache por roleta**: Armazena os números de cada roleta individualmente
- **TTL (Time-To-Live)**: Configurado para 5 minutos, equilibrando atualização e performance

```javascript
const cache = {
  roulettes: { data: null, timestamp: 0 },
  rouletteNumbers: {}, // Cache por ID de roleta
  allRouletteNumbers: { data: null, timestamp: 0 }
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
```

### 2. Otimização de Consultas ao MongoDB

- **Uso de índices**: Criação de índices para otimizar as consultas
- **Projeções**: Retorno apenas dos campos necessários com `project()`
- **Consultas otimizadas**: Limitação do número de documentos consultados

```javascript
const numeros = await collection
  .find({ roleta_id: roleta.id })
  .sort({ timestamp: -1 })
  .limit(requestedLimit)
  .project({ _id: 0, numero: 1 })
  .toArray();
```

### 3. Índices MongoDB

Foram criados os seguintes índices para otimizar as consultas:

- Índice simples para `roleta_id`
- Índice composto para `roleta_id` e `timestamp`
- Índice para o campo `numero`

```javascript
await collection.createIndex({ "roleta_id": 1 }, { background: true });
await collection.createIndex({ "roleta_id": 1, "timestamp": -1 }, { background: true });
await collection.createIndex({ "numero": 1 }, { background: true });
```

### 4. Processamento em Lotes (Batching)

Para evitar sobrecarga de memória, o processamento de múltiplas roletas foi dividido em lotes menores:

```javascript
const BATCH_SIZE = 5; // Processar 5 roletas por vez
for (let i = 0; i < roletas.length; i += BATCH_SIZE) {
  const lote = roletas.slice(i, i + BATCH_SIZE);
  // Processar lote...
}
```

### 5. Limpeza Periódica de Cache

Mecanismo automático para limpar o cache antigo e evitar vazamento de memória:

```javascript
setInterval(limparCacheAntigo, 15 * 60 * 1000); // A cada 15 minutos
```

### 6. Novas Rotas Otimizadas

- `/api/roulettes-optimized`: Carrega todas as roletas com seus números de forma otimizada
- `/api/roulette/:id/numbers`: Carrega os números de uma roleta específica de forma otimizada
- `/api/mongodb-stats`: Disponibiliza estatísticas de utilização do MongoDB, incluindo índices

## Como Usar as Novas Rotas

### Obter Todas as Roletas Otimizadas

```
GET /api/roulettes-optimized?limit=1000
```

Parâmetros:
- `limit`: Quantidade máxima de números a retornar por roleta (padrão: 1000)
- `refresh`: Definir como `true` para forçar atualização do cache

### Obter Números de uma Roleta Específica

```
GET /api/roulette/2010096/numbers?limit=1000
```

Parâmetros:
- `limit`: Quantidade máxima de números a retornar (padrão: 1000)
- `refresh`: Definir como `true` para forçar atualização do cache

### Verificar Estatísticas do MongoDB

```
GET /api/mongodb-stats
```

## Monitoramento

Para verificar se as otimizações estão funcionando, utilize a rota `/api/mongodb-stats` que mostrará:

- Estatísticas da coleção `roleta_numeros`
- Índices criados e seus tamanhos
- Estatísticas de uso do cache
- Contagem de documentos por roleta

## Próximos Passos Recomendados

1. **Atualizar o frontend** para usar as novas rotas otimizadas
2. **Implementar carregamento sob demanda** (lazy loading) para as roletas no frontend
3. **Adicionar monitoramento de performance** para identificar possíveis gargalos adicionais
4. **Considerar implementar sharding** se o volume de dados continuar crescendo significativamente 