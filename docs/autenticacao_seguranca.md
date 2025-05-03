# Documentação de Segurança e Autenticação

## Resumo das Melhorias de Segurança Implementadas

### 1. Introdução

Este documento detalha as melhorias de segurança implementadas no sistema RunCash, focando especificamente na autenticação JWT (JSON Web Token) e proteção de endpoints sensíveis.

### 2. Vulnerabilidades Corrigidas

Identificamos e corrigimos as seguintes vulnerabilidades críticas:

- **Acesso não autenticado ao WebSocket**: Anteriormente, conexões WebSocket eram permitidas sem verificação de autenticação, permitindo acesso não autorizado aos dados em tempo real.
- **Endpoints de API desprotegidos**: Vários endpoints, como `/api/roulettes`, `/api/roletas` e outros relacionados a dados de roleta estavam acessíveis sem autenticação adequada.

### 3. Soluções Implementadas

#### 3.1 Autenticação JWT Centralizada

- Implementamos uma constante global `JWT_SECRET` compartilhada entre todos os middlewares e serviços
- Centralizamos a lógica de verificação de token no módulo `jwtAuthMiddleware.js`
- Exportamos a constante `JWT_SECRET` para ser reutilizada em toda a aplicação

#### 3.2 Proteção Multi-Camadas

Implementamos um esquema de proteção em múltiplas camadas para endpoints críticos:

1. **Validação de Token JWT em Nível de Endpoint**:
   - Verificação direta do cabeçalho `Authorization` 
   - Validação do formato do token (Bearer)
   - Verificação criptográfica com a chave secreta `JWT_SECRET`
   - Validação da estrutura e conteúdo do payload
   - Logging detalhado com IDs de requisição único

2. **Middleware de Verificação de Assinatura**:
   - Utilização do middleware `verifyTokenAndSubscription` como segunda camada
   - Validação de planos e permissões específicas para cada recurso

3. **Verificação Terciária nos Handlers de Rota**:
   - Verificações adicionais de segurança dentro dos manipuladores de rotas
   - Validação de expiração de assinatura em tempo real
   - Controle granular de acesso baseado em propriedades do usuário

#### 3.3 Padrão de Implementação

O mesmo padrão de segurança foi aplicado consistentemente a todos os endpoints sensíveis:

- `/api/roulettes` (endpoint em inglês)
- `/api/ROULETTES` (endpoint em maiúsculas para compatibilidade)
- `/api/roletas` (endpoint em português)
- `/api/numbers/:roletaNome` (consulta por nome de roleta)
- `/api/numbers/byid/:roletaId` (consulta por ID de roleta)
- Conexões WebSocket

### 4. Testes e Verificação

Para verificar a efetividade das implementações de segurança, recomendamos os seguintes testes:

1. **Teste de Acesso Sem Token**:
   ```bash
   curl -v https://backendapi-production-36b5.up.railway.app/api/roulettes
   ```
   Resposta esperada: Status 401 Unauthorized

2. **Teste com Token Inválido**:
   ```bash
   curl -v -H "Authorization: Bearer token_invalido" https://backendapi-production-36b5.up.railway.app/api/roulettes
   ```
   Resposta esperada: Status 401 Unauthorized

3. **Teste de WebSocket Sem Autenticação**:
   ```javascript
   const socket = io("wss://backendapi-production-36b5.up.railway.app");
   ```
   Comportamento esperado: Conexão recusada com erro de autenticação

4. **Teste de WebSocket Com Autenticação Válida**:
   ```javascript
   const socket = io("wss://backendapi-production-36b5.up.railway.app", {
     extraHeaders: {
       Authorization: "Bearer SEU_TOKEN_JWT"
     }
   });
   ```
   Comportamento esperado: Conexão estabelecida com sucesso

### 5. Logs e Monitoramento

Implementamos logging detalhado para facilitar o monitoramento e análise de tentativas de acesso:

- Cada requisição recebe um ID único para rastreabilidade
- Todas as tentativas de autenticação são registradas com detalhes como:
  - Endereço IP do cliente
  - Horário da tentativa
  - Status de autenticação (sucesso/falha)
  - Causa específica da falha, quando aplicável
  - Detalhes do usuário em caso de sucesso

### 6. Recomendações Adicionais

Para manter e aprimorar o nível de segurança do sistema, recomendamos:

1. **Rotação Periódica da Chave JWT**: Implementar um sistema de rotação da chave secreta JWT a cada período determinado (30-90 dias)
2. **Implantação de Rate Limiting**: Limitar o número de tentativas de autenticação por IP para prevenir ataques de força bruta
3. **Análise Regular de Logs**: Estabelecer um processo de revisão regular dos logs de autenticação para identificar padrões suspeitos
4. **Testes de Penetração**: Realizar testes de penetração periódicos para identificar possíveis novas vulnerabilidades

### 7. Conclusão

As melhorias implementadas fortalecem significativamente a segurança do sistema RunCash, garantindo que apenas usuários autenticados e autorizados possam acessar dados sensíveis. A implementação de um sistema de autenticação em múltiplas camadas oferece proteção robusta contra tentativas de acesso não autorizado. 