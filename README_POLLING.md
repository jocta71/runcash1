# Sistema de Polling para Roletas

Este projeto implementa um sistema de polling HTTP para substituir a arquitetura anterior baseada em Server-Sent Events (SSE) e WebSockets, oferecendo maior confiabilidade e compatibilidade com ambientes restritivos.

## Visão Geral

O sistema de polling é uma alternativa robusta para cenários onde conexões persistentes podem ser problemáticas. Em vez de manter uma conexão aberta como no WebSockets ou SSE, o cliente faz requisições HTTP regulares para buscar novas informações.

### Componentes Principais

1. **Backend (API):**
   - Endpoints RESTful para listagem de roletas
   - Suporte a timestamp incremental para reduzir volume de dados
   - Registros eficientes de novas entradas

2. **Frontend (Serviço de Polling):**
   - Gerenciamento de intervalos de polling
   - Armazenamento em cache de dados
   - Processamento eficiente de atualizações

3. **UI do React:**
   - Exibição em tempo real dos dados das roletas
   - Indicador visual de status do serviço de polling

## Endpoints da API

### GET /api/roletas

Retorna todas as roletas com seus números recentes.

**Parâmetros:**
- `since` (opcional): Timestamp em milissegundos - retorna apenas atualizações desde este momento

**Resposta:**
```json
[
  {
    "id": "roleta1",
    "name": "Roleta Europeia",
    "recentNumbers": [12, 7, 0, 32, 15],
    "lastUpdated": "2023-04-08T14:55:23Z"
  },
  ...
]
```

### GET /api/roletas/:id

Retorna detalhes de uma roleta específica.

**Parâmetros:**
- `since` (opcional): Timestamp em milissegundos - retorna apenas atualizações desde este momento

**Resposta:**
```json
{
  "id": "roleta1",
  "name": "Roleta Europeia",
  "recentNumbers": [12, 7, 0, 32, 15],
  "lastUpdated": "2023-04-08T14:55:23Z"
}
```

### POST /api/roletas/:id/numeros

Adiciona um novo número à roleta.

**Corpo da requisição:**
```json
{
  "numero": 17
}
```

**Resposta:**
```json
{
  "message": "Número adicionado com sucesso",
  "numero": {
    "roleta_id": "roleta1",
    "roleta_nome": "Roleta Europeia",
    "numero": 17,
    "cor": "preto",
    "timestamp": "2023-04-08T14:55:23Z"
  }
}
```

## Serviço Frontend (RouletteFeedService)

O serviço de polling do frontend gerencia a conexão com a API e o processamento dos dados:

```javascript
// Iniciar o serviço
RouletteFeedService.start(handleRouletteUpdate, handleError, 3000);

// Parar o serviço
RouletteFeedService.stop();

// Obter dados de todas as roletas
const allRoulettes = RouletteFeedService.getAllRouletteData();

// Obter dados de uma roleta específica
const roleta = RouletteFeedService.getRouletteData('roleta1');

// Obter os últimos 10 números de uma roleta
const ultimosNumeros = RouletteFeedService.getLatestNumbers('roleta1', 10);
```

## Vantagens do Sistema de Polling

1. **Confiabilidade:** Menos suscetível a problemas de conexão em comparação com conexões persistentes
2. **Compatibilidade:** Funciona em praticamente qualquer ambiente, mesmo com proxies e firewalls restritivos
3. **Simplicidade:** Implementação e depuração mais simples
4. **Escalabilidade:** Permite escalar horizontalmente com facilidade
5. **Otimização de tráfego:** Uso do parâmetro `since` reduz o volume de dados transferidos

## Limitações

1. **Latência:** O tempo de atualização é limitado pelo intervalo de polling
2. **Sobrecarga de requisições:** Maior número de requisições HTTP comparado a soluções baseadas em push
3. **Uso de recursos do cliente:** Necessita de intervalo de polling gerenciado pelo cliente

## Script de Teste (test_polling.js)

Para testar o sistema, execute o script que insere números aleatórios em uma roleta de teste:

```
node backend/test_polling.js
```

Por padrão, este script:
- Insere números aleatórios de 0 a 36
- Usa um intervalo de 15 segundos entre inserções
- Insere um total de 100 números
- Usa a roleta de teste com ID "test-roleta-1"

Para personalizar, defina as variáveis de ambiente:
- `API_URL`: URL da API (padrão: http://localhost:3002)
- `ROLETA_ID`: ID da roleta de teste
- `INTERVALO`: Intervalo em milissegundos entre inserções
- `NUMEROS_TOTAIS`: Total de números a inserir

## Comparação com Outras Arquiteturas

| Característica          | Polling HTTP | WebSockets | SSE (Server-Sent Events) |
|-------------------------|--------------|------------|--------------------------|
| Complexidade            | Baixa        | Alta       | Média                    |
| Latência                | Média-Alta   | Baixa      | Média                    |
| Confiabilidade          | Alta         | Média      | Média-Alta               |
| Compatibilidade         | Muito Alta   | Média      | Alta                     |
| Tráfego de rede         | Alto         | Baixo      | Médio                    |
| Suporte a reconexão     | Nativo       | Manual     | Automático               |
| Escalabilidade          | Excelente    | Desafiadora| Boa                      |
| Suporte a Proxy/Firewall| Excelente    | Problemático| Bom                     | 