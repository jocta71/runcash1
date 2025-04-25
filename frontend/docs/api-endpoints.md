# Documentação de Endpoints da API

Este documento lista os endpoints disponíveis na API do RunCash e seu status atual.

## Base URL
A API está disponível em:
```
https://backendapi-production-36b5.up.railway.app/api
```

## Endpoints Disponíveis

### Autenticação
| Endpoint | Método | Status | Descrição |
|----------|--------|--------|-----------|
| `/auth/me` | GET | ✅ Funcionando | Obtém os dados do usuário autenticado |

### Roletas
| Endpoint | Método | Status | Descrição |
|----------|--------|--------|-----------|
| `/roulettes` | GET | ✅ Funcionando | Lista todas as roletas |
| `/roulettes/with-numbers` | GET | ❌ Error 404 | Busca roletas com números (não disponível) |
| `/roulettes/basic-info` | GET | ❌ Error 404 | Busca informações básicas das roletas (não disponível) |
| `/roulettes/detailed/:id` | GET | ⚠️ Não verificado | Busca detalhes de uma roleta específica |
| `/roulettes/historical/:id` | GET | ⚠️ Não verificado | Busca histórico de números de uma roleta |
| `/roulettes/stats/:id` | GET | ⚠️ Não verificado | Busca estatísticas de uma roleta |
| `/roulettes/public/providers` | GET | ⚠️ Não verificado | Busca provedores de roletas |

### Assinatura
| Endpoint | Método | Status | Descrição |
|----------|--------|--------|-----------|
| `/asaas-find-subscription` | GET | ✅ Funcionando | Verifica assinatura de um cliente |

## Soluções de Contorno

Para contornar os endpoints que não estão funcionando, a aplicação implementa as seguintes estratégias:

1. **Informações básicas das roletas**: Em vez de usar o endpoint `/roulettes/basic-info`, a aplicação usa o endpoint `/roulettes` e filtra apenas os dados básicos necessários.

2. **Roletas com números**: A aplicação tenta obter os dados através de diferentes métodos:
   - API Proxy Local
   - Next.js API Route
   - CORS Proxy

## Como Atualizar Este Documento

Ao descobrir novos endpoints ou alterações no status dos existentes, atualize este documento para manter a equipe informada sobre o estado atual da API. 