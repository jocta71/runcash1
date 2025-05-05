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

# API Unificada de Roletas

Este documento descreve a implementação da API Unificada de Roletas, uma alternativa ao método de streaming (SSE) para obtenção de dados de roletas.

## Comparação: Streaming (SSE) vs API Unificada

| Característica | Streaming (SSE) | API Unificada |
|---------------|----------------|---------------|
| **Atualizações em tempo real** | Sim (push imediato) | Não (requer polling) |
| **Tráfego de rede** | Menor (envia apenas atualizações) | Maior (envia todos os dados a cada requisição) |
| **Uso de recursos do servidor** | Maior (mantém conexões abertas) | Menor (conexões curtas) |
| **Complexidade de implementação** | Alta | Baixa |
| **Suporte a proxy/firewall** | Pode ter problemas | Geralmente sem problemas |
| **Escalabilidade** | Limitada pelo número de conexões | Melhor para grande número de clientes |
| **Segurança** | Criptografia por token | Criptografia por token |

### Vantagens e Desvantagens

#### Streaming (SSE)
- **Vantagens:**
  - Atualizações imediatas para o cliente
  - Menor tráfego de rede (envia apenas novos dados)
  - Melhor experiência em tempo real
- **Desvantagens:**
  - Mantém conexões abertas no servidor
  - Pode ter problemas com proxies e firewalls
  - Implementação mais complexa
  - Limite de conexões simultâneas

#### API Unificada
- **Vantagens:**
  - Implementação simples
  - Compatível com qualquer ambiente
  - Não mantém conexões abertas
  - Melhor para grande número de clientes
- **Desvantagens:**
  - Não é tempo real (requer polling)
  - Maior tráfego de rede (envia todos os dados a cada requisição)
  - Possível atraso nas atualizações

## Implementação da Criptografia

Ambas as abordagens utilizam o formato Fe26.2 para criptografia dos dados. Os clientes precisam usar uma chave para descriptografar os dados.

### Sistema de Chaves

1. **Geração de Chaves**: Os clientes podem gerar chaves através do endpoint:
   ```
   POST /api/roulettes/keys/generate
   ```

2. **Autenticação**: Os clientes devem incluir a chave como parâmetro de consulta:
   ```
   ?k=CHAVE_DO_CLIENTE
   ```

3. **Autorização**: A API verifica se a chave:
   - É válida (formato correto)
   - Não expirou
   - Não foi revogada

### Comportamento da API

- Se nenhuma chave ou uma chave inválida for fornecida, a API retorna dados criptografados
- Se uma chave válida for fornecida, a API retorna dados descriptografados
- As chaves expiram automaticamente após um período configurado
- Chaves específicas podem ser revogadas pelo sistema

## Endpoints Disponíveis

### Endpoint Básico
```
GET /api/roulettes/all
```
Retorna todas as roletas com seus números

### Endpoint Compacto 
```
GET /api/roulettes/compact
```
Retorna dados em formato mais condensado para reduzir o tamanho da resposta

### Endpoint Consolidado
```
GET /api/roulettes/consolidated
```
Retorna dados agrupados, eliminando duplicações

### Endpoint de Formato SSE (Emulation de Eventos)
```
GET /api/roulettes/events
```
Retorna dados no formato de eventos (similar ao SSE) mas sem streaming real

### Endpoint de Roleta Específica
```
GET /api/roulettes/:id
```
Retorna dados de uma roleta específica

### Endpoint de Evento Unificado
```
GET /api/roulettes/events/all-in-one
```
Retorna todas as roletas e seus números em um único evento criptografado

Parâmetros opcionais:
- `max_roletas`: Limita o número de roletas retornadas (padrão: todas)
- `max_numeros`: Limita o número de números por roleta (padrão: todos)

Exemplo:
```
GET /api/roulettes/events/all-in-one?max_roletas=5&max_numeros=10
```

## Escolha da Abordagem

A escolha entre Streaming (SSE) e API Unificada depende dos requisitos do projeto:

- Use **Streaming (SSE)** quando:
  - Atualizações em tempo real são críticas
  - O número de clientes é moderado
  - A latência é importante
  - O tráfego de rede deve ser minimizado

- Use **API Unificada** quando:
  - Simplicidade de implementação é prioridade
  - O número de clientes é muito grande
  - Atualizações com alguns segundos de atraso são aceitáveis
  - Há problemas com proxies/firewalls

Considere uma implementação híbrida, oferecendo ambos os métodos para maior flexibilidade.

## Teste da Implementação

### Implementação de Teste vs. Implementação Real

Existem duas maneiras de testar a API unificada:

1. **Implementação de Teste**: Inicia um servidor independente apenas com a funcionalidade da API Unificada
2. **Implementação Real**: Integra a API Unificada ao servidor principal da aplicação

### Iniciar o Servidor de Teste

Para iniciar apenas o servidor de teste da API Unificada:
```
node backend/start_unified_api.js
```

O servidor estará disponível em `http://localhost:3005`

### Integrar ao Servidor Principal

A API Unificada já está integrada ao servidor principal. Os endpoints da API unificada são acessíveis através da mesma URL base usada para o servidor principal.

### Testar a API

1. Abra o cliente de teste:
```
backend/api/roulettes/docs/unified_api_test.html
```

2. Configure o URL base:
   - Para o servidor de teste: `http://localhost:3005`
   - Para o servidor principal: (URL do seu servidor principal)

3. Selecione o endpoint desejado no menu dropdown

4. Clique em "Carregar Dados" para ver os dados criptografados

### Testar o Fluxo de Criptografia

1. Clique em "Gerar Nova Chave" para obter uma chave de cliente
2. A chave será automaticamente aplicada na próxima requisição
3. Clique em "Carregar Dados" para ver os dados descriptografados
4. Remova a chave e clique em "Carregar Dados" novamente para ver os dados criptografados

### Testando o Endpoint All-in-One

Para testar o endpoint que retorna todas as roletas em um único evento:

1. Selecione o endpoint "Evento Único (All-in-One)" no dropdown
2. Configure os parâmetros opcionais se desejar limitar o volume de dados:
   - `max_roletas`: Número máximo de roletas (ex: 5)
   - `max_numeros`: Número máximo de números por roleta (ex: 10)
3. Clique em "Carregar Dados" para ver o evento único com todas as roletas
4. Alterne entre as abas "Dados Brutos", "Dados Descriptografados" e "Tabela" para ver diferentes visualizações dos dados

## Implementação Técnica

A API Unificada foi implementada seguindo uma arquitetura de camadas:

1. **Controllers** (`unified_controller.js`): Implementa a lógica de recuperação e formatação dos dados
2. **Middleware** (`unified_middleware.js`): Gerencia autenticação, chaves de cliente e permissões
3. **Routes** (parte de `routes.js`): Define os endpoints disponíveis
4. **Utils** (reutilizados de `utils/crypto.js` e `utils/stream.js`): Fornece funções utilitárias para criptografia

A implementação aproveita ao máximo o código existente e os utilitários para manter consistência com a abordagem de streaming.

## Conclusão

Não há uma abordagem definitivamente "melhor" - cada uma tem suas vantagens e desvantagens. A escolha deve ser baseada nos requisitos específicos do projeto, incluindo necessidades de tempo real, escala esperada, recursos disponíveis e experiência da equipe de desenvolvimento.

Esta implementação oferece ambas as opções para testes e escolha da melhor abordagem para o seu caso de uso. 