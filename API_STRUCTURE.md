# Estrutura de APIs do RunCash

Este documento descreve a organização das APIs do sistema RunCash, explicando a relação entre os diretórios `/api` e `/backend/api`.

## Visão Geral

O sistema RunCash utiliza uma arquitetura onde:

1. **`/backend/api`**: Contém a implementação principal de todas as APIs
2. **`/api`**: Contém redirecionadores simples que encaminham as requisições para o backend

## Estrutura de Diretórios

```
/backend
  /api
    /payment             # Implementações de integração com o Asaas
      /asaas-webhook.js  # Processamento de webhooks do Asaas
      /asaas-create-subscription.js
      /asaas-create-customer.js
      /asaas-find-customer.js
      /...
    /scraper             # Funcionalidades de scraping
    /socket              # Implementação de websockets
    /utils               # Funções compartilhadas (segurança, validação, etc.)

/api                     # Redirecionadores para compatibilidade
  /asaas-webhook.js      # Redireciona para /backend/api/payment/asaas-webhook.js
  /asaas-create-subscription.js
  /asaas-create-customer.js
  /...
```

## Como Funciona

1. **Chamadas do Frontend**: 
   - O frontend continua chamando endpoints em `/api` como antes
   - Exemplo: `POST /api/asaas-create-subscription`

2. **Redirecionamento**:
   - Os redirecionadores em `/api` recebem a requisição
   - Encaminham para o endpoint correspondente em `/backend/api`
   - Exemplo: `/api/asaas-create-subscription` → `/backend/api/payment/asaas-create-subscription`

3. **Processamento**:
   - Toda a lógica de negócio, validação e segurança acontece em `/backend/api`
   - Os redirecionadores apenas passam os parâmetros e headers

## Configuração Necessária

Para que os redirecionadores funcionem corretamente, configure a variável de ambiente:

```
BACKEND_URL=http://localhost:3001  # URL base do servidor backend
```

## Segurança

A consolidação de código em `/backend/api` incluiu diversas melhorias de segurança:

1. **Verificação de Assinatura**: Validação criptográfica de webhooks do Asaas
2. **Rate Limiting**: Proteção contra excesso de requisições 
3. **CORS Restritivo**: Apenas domínios confiáveis podem acessar a API
4. **Validação de Permissões**: Usuários só podem acessar seus próprios dados

## Notas para Desenvolvedores

1. **Novos Endpoints**: 
   - Adicione apenas em `/backend/api`
   - Crie redirecionadores em `/api` apenas se necessário para compatibilidade

2. **Manutenção**:
   - Modifique apenas o código em `/backend/api`
   - Os redirecionadores devem permanecer simples

3. **URLs de Callback**:
   - Os callbacks para o Asaas agora apontam para `/backend/api/payment/asaas-webhook`
   - Configure o Asaas para enviar webhooks para esta URL
``` 