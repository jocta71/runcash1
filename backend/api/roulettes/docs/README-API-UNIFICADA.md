# API Unificada de Roletas vs. Streaming

Este documento explica as diferenças entre as duas abordagens para fornecer dados de roletas aos clientes:

1. **Abordagem de Streaming (SSE)** - Envio em tempo real de atualizações das roletas
2. **Abordagem de API Unificada** - Consulta periódica a um endpoint único com todas as roletas

## Comparação das Abordagens

| Característica | Streaming (SSE) | API Unificada |
|----------------|-----------------|---------------|
| Tempo real | ✅ Imediato | ❌ Depende do intervalo de polling |
| Tráfego de rede | ✅ Menor (apenas atualizações) | ❌ Maior (dados completos) |
| Uso de recursos do servidor | ❌ Maior (conexões persistentes) | ✅ Menor (requisições pontuais) |
| Complexidade de implementação | ❌ Maior | ✅ Menor |
| Suporte a proxies/firewalls | ❌ Pode ter problemas | ✅ Melhor compatibilidade |
| Escalabilidade | ❌ Limitada pelo número de conexões | ✅ Melhor distribuição de carga |
| Segurança | ✅ Criptografia por conexão | ✅ Pode usar HTTPS padrão |

## Endpoints da API Unificada

A API Unificada oferece várias opções de formato para obter os dados das roletas:

### 1. Formato Padrão

**Endpoint:** `GET /api/roulettes`

Retorna todas as roletas com seus históricos completos de números.

**Exemplo de resposta:**
```json
[
  {
    "id": "a8a1f746-6002-eabf-b14d-d78d13877599",
    "nome": "VIP Roulette",
    "ativa": true,
    "numero": [
      { "numero": 4, "roleta_id": "2380117", "roleta_nome": "VIP Roulette", "cor": "preto", "timestamp": "2025-05-05T02:56:21.372Z" },
      /* mais números... */
    ],
    "estado_estrategia": "NEUTRAL",
    "vitorias": 0,
    "derrotas": 0,
    "win_rate": "N/A",
    "updated_at": "2025-05-05T02:56:21.372Z"
  },
  /* mais roletas... */
]
```

### 2. Formato Compacto

**Endpoint:** `GET /api/roulettes/compact/all`

Retorna todas as roletas em formato condensado, incluindo apenas os dados essenciais e o último número de cada roleta.

**Vantagens:**
- Resposta significativamente menor
- Ideal para listas/tabelas de roletas
- Menor carga na rede e processamento mais rápido

**Exemplo de resposta:**
```json
[
  {
    "id": "a8a1f746-6002-eabf-b14d-d78d13877599",
    "nome": "VIP Roulette",
    "ativa": true,
    "ultimo_numero": { "numero": 4, "roleta_id": "2380117", "roleta_nome": "VIP Roulette", "cor": "preto", "timestamp": "2025-05-05T02:56:21.372Z" },
    "total_numeros": 20,
    "updated_at": "2025-05-05T02:56:21.372Z"
  },
  /* mais roletas... */
]
```

### 3. Formato Consolidado

**Endpoint:** `GET /api/roulettes/consolidated`

Retorna um formato unificado com informações básicas de todas as roletas e uma lista única dos números mais recentes de todas as roletas, ordenados por timestamp.

**Vantagens:**
- Evita duplicação de dados
- Ideal para exibir um histórico cronológico de todas as roletas
- Facilita a visualização dos últimos números independentemente da roleta

**Exemplo de resposta:**
```json
{
  "roletas": [
    { "id": "a8a1f746-6002-eabf-b14d-d78d13877599", "nome": "VIP Roulette", "ativa": true },
    /* mais roletas... */
  ],
  "numeros": [
    { "numero": 4, "roleta_id": "2380117", "roleta_nome": "VIP Roulette", "cor": "preto", "timestamp": "2025-05-05T02:56:21.372Z" },
    { "numero": 20, "roleta_id": "2010097", "roleta_nome": "VIP Roulette", "cor": "preto", "timestamp": "2025-05-05T02:55:27.301Z" },
    /* mais números de várias roletas, ordenados do mais recente para o mais antigo... */
  ],
  "total_numeros": 80,
  "timestamp": "2025-05-05T03:00:00.000Z"
}
```

## Streaming (SSE)

### Vantagens
- Atualizações em tempo real
- Menor tráfego de rede (apenas novas atualizações)
- Menor latência entre evento e notificação
- Melhor experiência para o usuário

### Desvantagens
- Mais complexo de implementar
- Mantém conexões abertas (consumo de recursos do servidor)
- Pode ter problemas com proxies, firewalls e balanceadores de carga
- Limitado pelo número máximo de conexões simultâneas

## API Unificada

### Vantagens
- Simples de implementar e consumir
- Compatível com padrões REST tradicionais
- Funciona bem com todas as infraestruturas
- Melhor para grande número de clientes
- Facilita o armazenamento em cache
- Múltiplos formatos de resposta para diferentes necessidades

### Desvantagens
- Não é tempo real (depende de polling)
- Maior tráfego de rede (carrega dados completos a cada requisição)
- Maior latência entre evento e visualização
- Pode sobrecarregar a API com muitas requisições simultâneas

## Implementação de Criptografia

Ambas as abordagens implementam criptografia para proteger os dados das roletas:

### Modelo de Criptografia
- Utilização do formato Fe26.2 (similar ao usado pelo @hapi/iron)
- Os dados são criptografados antes de serem enviados ao cliente
- Cliente precisa de uma chave para descriptografar os dados

### Sistema de Chaves
1. **Geração de Chaves**: Endpoint `POST /api/roulettes/keys/generate` gera uma chave de cliente
2. **Autenticação**: Cliente utiliza a chave como parâmetro de consulta `?k=SUA_CHAVE_AQUI`
3. **Autorização**: API verifica se a chave é válida antes de fornecer dados descriptografados

### Comportamento
- **Sem chave ou chave inválida**: API retorna dados criptografados
- **Com chave válida**: API retorna dados descriptografados, prontos para uso

### Segurança
- Proteção contra acesso não autorizado aos dados das roletas
- Chaves com expiração automática (24 horas por padrão)
- Possibilidade de revogar chaves específicas

## Qual Abordagem Escolher?

A decisão entre usar streaming ou API unificada depende de vários fatores:

### Escolha Streaming (SSE) quando:
- A atualização em tempo real é crítica para a aplicação
- O número de clientes simultâneos é administrável
- A experiência do usuário depende de atualizações imediatas
- A infraestrutura suporta conexões persistentes

### Escolha API Unificada quando:
- O tempo real não é absolutamente crítico
- Há um grande número de clientes
- A aplicação precisa funcionar em diversos ambientes
- Preferir simplicidade na implementação e manutenção

## Implementação Híbrida

Uma abordagem híbrida também é possível:
- Fornecer a API unificada como base para carregamento inicial e recuperação de histórico
- Oferecer endpoints de streaming para clientes que precisam de atualizações em tempo real
- Permitir que o cliente escolha o modelo mais adequado às suas necessidades

## Como Testar as Implementações

### Testando o Streaming (SSE)
1. Inicie o servidor de teste:
   ```
   node backend/start_test_stream.js
   ```
2. Abra o cliente de teste:
   ```
   backend/api/roulettes/docs/sse_test.html
   ```

### Testando a API Unificada
1. Inicie o servidor de API:
   ```
   node backend/start_api_unified.js
   ```
2. Abra o cliente de teste:
   ```
   backend/api/roulettes/docs/api_test.html
   ```
3. No cliente de teste, escolha entre os formatos disponíveis:
   - **Padrão**: Dados completos de roletas
   - **Compacto**: Apenas dados essenciais e último número
   - **Consolidado**: Lista unificada de números ordenados por tempo

### Fluxo de Testes com Criptografia
1. Ao abrir qualquer página de teste, os dados aparecem criptografados inicialmente
2. Clique em "Gerar Nova Chave" para obter uma chave de cliente
3. A chave é automaticamente aplicada às requisições seguintes
4. Os dados serão exibidos de forma descriptografada (em formato legível)
5. Tente modificar a chave para um valor inválido para testar a rejeição

## Conclusão

Não existe uma abordagem "melhor" - cada uma tem suas vantagens e desvantagens. A escolha deve ser baseada nos requisitos específicos do seu projeto, considerando fatores como necessidade de tempo real, escala esperada, recursos disponíveis e experiência da equipe de desenvolvimento.

Ambas as implementações oferecem:
- Proteção de dados através de criptografia
- Sistema de chaves para controlar acesso
- Interface de usuário amigável para visualização dos dados
- Documentação clara sobre o uso da API 