# Autenticação e Proteção da API com JWT e Asaas

Este documento descreve a implementação do sistema de autenticação com JWT e verificação de assinatura Asaas para proteger a API de roletas do RunCash.

## Visão Geral

O sistema implementa uma camada de segurança dupla:

1. **Autenticação via JWT (JSON Web Token)**: Verifica se o usuário está autenticado no sistema.
2. **Verificação de Assinatura Asaas**: Confirma se o usuário possui uma assinatura ativa na plataforma Asaas.

Ambas as verificações são necessárias para permitir o acesso às APIs de roletas. Se qualquer uma falhar, o acesso é negado.

## Arquivos Implementados

### 1. middleware/authAsaasMiddleware.js

Middleware responsável pela verificação do token JWT e da assinatura ativa no Asaas. Utiliza a API do Asaas para verificar o status da assinatura do usuário.

### 2. api/protectedRoulette.js

API que serve como proxy para a API de roletas, aplicando o middleware de autenticação e verificação de assinatura em todas as rotas.

### 3. test/test-auth-asaas-middleware.js

Script para testar o middleware em diferentes cenários:
- Acesso sem token
- Acesso com token inválido
- Acesso com token sem ID de cliente Asaas
- Acesso com token com ID de cliente sem assinatura ativa
- Acesso com token com ID de cliente e assinatura ativa

## Fluxo de Autenticação

```
1. Cliente faz requisição → Inclui token JWT no cabeçalho
2. Middleware verifica token → Decodifica e valida JWT
3. Middleware extrai asaasCustomerId → Obtém ID do cliente no Asaas
4. Middleware consulta API Asaas → Verifica status da assinatura
5. Se autenticado e com assinatura ativa → Permite acesso à API
6. Se não autenticado ou sem assinatura ativa → Retorna erro 401 ou 403
```

## Configuração

### Variáveis de Ambiente

```
JWT_SECRET=seu_segredo_jwt_aqui
ASAAS_API_KEY=sua_chave_api_asaas_aqui
ASAAS_ENVIRONMENT=sandbox|production
ROLETAS_API_URL=http://url-da-api-interna-de-roletas
```

## Códigos de Erro

- `ERROR_NO_TOKEN`: Token JWT não fornecido
- `ERROR_INVALID_TOKEN`: Token JWT inválido
- `ERROR_TOKEN_EXPIRED`: Token JWT expirado
- `ERROR_NO_SUBSCRIPTION`: Usuário não possui assinatura cadastrada
- `ERROR_INACTIVE_SUBSCRIPTION`: Assinatura inativa ou cancelada
- `ERROR_ASAAS_API`: Erro na API do Asaas

## Testes

Para executar os testes do middleware:

```bash
node test/test-auth-asaas-middleware.js
```

## Integração com Frontend

O frontend deve incluir o token JWT em todas as requisições para a API de roletas:

```javascript
const token = localStorage.getItem('token');

fetch('/api/roletas', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => {
  if (response.status === 403) {
    // Redirecionar para página de assinatura
  }
  return response.json();
})
.then(data => {
  // Processar dados da API
});
```

## Segurança

Este sistema implementa as seguintes práticas de segurança:

1. Tokens JWT com tempo de expiração
2. Verificação de assinatura ativa em tempo real
3. Tratamento de erros com mensagens específicas
4. Não exposição de detalhes técnicos nas respostas de erro

## Limitações

- Se a API do Asaas estiver indisponível, o middleware pode permitir o acesso para evitar interrupção do serviço
- Os tokens JWT são armazenados no localStorage, o que pode apresentar riscos de segurança em caso de XSS

## Próximas Etapas

- Implementar cache para reduzir chamadas à API do Asaas
- Adicionar refresh tokens para melhorar a experiência do usuário
- Implementar rate limiting para proteger contra ataques de força bruta 