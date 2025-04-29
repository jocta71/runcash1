# Asaas Subscription Service

Serviço para gerenciar assinaturas de usuários com a plataforma Asaas, controlando o acesso à API principal baseado no status da assinatura.

## Funcionalidades

- Receber e processar webhooks do Asaas
- Gerenciar assinaturas de usuários
- Controlar acesso à API principal (roulettes)
- Autenticação de usuários
- Geração de tokens JWT com informações de acesso

## Requisitos

- Node.js 18+
- MongoDB
- Conta na Asaas (Sandbox ou Produção)

## Configuração

1. Clone o repositório
2. Instale as dependências:
   ```
   npm install
   ```
3. Configure as variáveis de ambiente criando um arquivo `.env` baseado no `.env.example`
4. Configure o webhook na plataforma Asaas para apontar para o endpoint `/api/asaas/webhook` deste serviço

## Desenvolvimento

Para executar o servidor em modo de desenvolvimento:

```
npm run dev
```

## Produção

Para fazer o build e executar em produção:

```
npm start
```

## Implantação no Railway

Este serviço está configurado para ser implantado no Railway:

1. Conecte o repositório ao Railway
2. Configure as variáveis de ambiente no Railway
3. O deploy será feito automaticamente quando houver um novo commit

## Fluxo de Integração com a API Principal

1. A API principal envia uma requisição para `/api/subscription/verify/:externalId` antes de permitir acesso aos endpoints protegidos
2. Este serviço verifica se o usuário tem assinatura ativa
3. Em caso positivo, retorna um token JWT com as permissões
4. A API principal utiliza o token para autorizar o acesso

## Endpoints

### Webhooks

- `POST /api/asaas/webhook` - Recebe notificações da Asaas

### Assinaturas

- `GET /api/subscription/status` - Verifica o status da assinatura do usuário autenticado
- `GET /api/subscription/verify/:externalId` - Verifica se um usuário tem acesso à API
- `POST /api/subscription/create-customer` - Cria um cliente no Asaas
- `POST /api/subscription/create-subscription` - Cria uma assinatura no Asaas

### Usuários

- `POST /api/users/register` - Registra um novo usuário
- `POST /api/users/login` - Autentica um usuário
- `GET /api/users/me` - Retorna os dados do usuário autenticado
- `PUT /api/users/update` - Atualiza os dados do usuário autenticado 