# Otimização da API de Roletas

Este documento descreve as otimizações implementadas na API para lidar com grandes volumes de dados de roletas.

## Problema

A API apresentava lentidão ao carregar grandes volumes de dados (1000 números para cada uma das 39 roletas) devido a:

1. Carregamento completo sem paginação eficiente
2. Processamento excessivo sem cache
3. Formato de resposta não otimizado para transferência

## Soluções Implementadas

### 1. API Otimizada com Cache

Endpoint: `/api/ROULETTES-optimized`

Este endpoint implementa:
- Cache de resultados (1 minuto)
- Compressão gzip para respostas grandes
- Formato compacto opcional
- Streaming para grandes volumes de dados

**Parâmetros:**
- `limit`: Quantidade de números (padrão: 200)
- `roleta_id`: ID da roleta específica (opcional)
- `format`: Formato da resposta (`json` ou `compact`)
- `stream`: Se `true`, usa streaming para grandes volumes de dados
- `refresh`: Se `true`, ignora o cache

**Exemplo:**
```
GET /api/ROULETTES-optimized?limit=1000&format=compact
```

### 2. Carregamento em Lotes

Endpoint: `/api/roulettes-batch`

Implementa carregamento em lotes com:
- Paginação eficiente
- Cache por chave de consulta
- Formatos otimizados

**Parâmetros:**
- `limit`: Tamanho do lote (padrão: 200)
- `page`: Página a ser carregada (começando por 0)
- `rouletteId`: ID da roleta (opcional)
- `format`: Formato dos dados (`full`, `compact`, `minimal`)
- `skipCache`: Se `true`, ignora o cache

**Exemplo:**
```
GET /api/roulettes-batch?limit=200&page=0&format=compact
```

### 3. Lista de Roletas Otimizada

Endpoint: `/api/roulettes-list`

Retorna apenas a lista de roletas disponíveis, sem os números.

**Parâmetros:**
- `status`: Se `true`, inclui status atual de cada roleta

**Exemplo:**
```
GET /api/roulettes-list?status=true
```

### 4. Gerenciamento de Cache

Endpoint: `/api/cache/status` - Mostra estatísticas do cache
Endpoint: `/api/cache/clear` - Limpa o cache (POST)
Endpoint: `/api/roulettes-batch/clear-cache` - Limpa cache do serviço de lotes (POST)

## Recomendações de Uso

### Para Frontend

1. **Carregamento inicial:**
   - Use `/api/roulettes-list` para obter a lista de roletas
   - Mostre ao usuário que os dados estão sendo carregados

2. **Carregamento por lotes:**
   - Use `/api/roulettes-batch` com paginação para carregar dados de 3-5 roletas por vez
   - Implemente carregamento progressivo enquanto o usuário navega

3. **Para visualização de uma única roleta:**
   - Use `/api/ROULETTES-optimized?roleta_id=XXX` para obter os dados de uma roleta específica

### Práticas Recomendadas

1. **Use paginação:**
   ```javascript
   // Carregamento progressivo
   let page = 0;
   const loadNextBatch = async () => {
     const response = await fetch(`/api/roulettes-batch?page=${page}&limit=200`);
     page++;
     return response.json();
   };
   ```

2. **Aproveite o cache:**
   - Não solicite os mesmos dados repetidamente
   - Use `skipCache=true` apenas quando precisar de dados atualizados

3. **Use o formato compacto para economia de banda:**
   ```javascript
   fetch('/api/roulettes-batch?format=compact')
     .then(res => res.json())
     .then(data => {
       // Converter formato compacto para o formato completo
       const expanded = data.data.map(item => ({
         roleta_id: item.r,
         roleta_nome: item.n,
         numero: item.v,
         cor: item.c,
         timestamp: item.t
       }));
       // Processar dados expandidos
     });
   ```

4. **Para grandes lotes, use streaming:**
   ```javascript
   fetch('/api/ROULETTES-optimized?limit=1000&stream=true')
     .then(response => {
       const reader = response.body.getReader();
       // Processar stream de dados
     });
   ```

## Monitoramento

Os endpoints otimizados incluem logs detalhados para ajudar a diagnosticar problemas de desempenho:

```
[API] Requisição recebida para /api/ROULETTES-optimized
[API] Usando limit: 1000, format: compact
[API] Comprimindo resposta com gzip
```

## Próximos Passos

1. Implementar limpeza automática de cache para entradas antigas
2. Adicionar suporte para websockets para transmissão eficiente de atualizações
3. Otimizar consultas ao banco de dados com índices adicionais 