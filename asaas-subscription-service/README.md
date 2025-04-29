# Serviço de Assinaturas Asaas

Serviço para gerenciar assinaturas de usuários no RunCash usando a API Asaas.

## Funcionalidades

- Registro e autenticação de usuários
- Criação de clientes no Asaas
- Gerenciamento de assinaturas (criar, consultar, cancelar)
- Processamento de webhooks do Asaas
- Verificação de assinaturas para outros serviços
- Middleware para proteção da API de roletas

## Pré-requisitos

- Node.js 16+
- MongoDB
- Conta na Asaas
- Configuração de webhook na Asaas

## Instalação

1. Clone o repositório:
```
git clone https://github.com/seu-usuario/asaas-subscription-service.git
cd asaas-subscription-service
```

2. Instale as dependências:
```
npm install
```

3. Configure as variáveis de ambiente:
```
cp .env.example .env
```
Edite o arquivo `.env` com suas configurações.

4. Inicie o servidor:
```
npm run dev
```

## Integração com API de Roletas

Para integrar este serviço com a API de roletas, siga os passos abaixo:

### 1. Adicione as variáveis de ambiente na API de roletas

No arquivo `.env` da API de roletas, adicione:

```
SUBSCRIPTION_SERVICE_URL=https://seu-servico-de-assinaturas.railway.app
```

### 2. Copie o middleware de verificação de assinatura

Copie o arquivo `src/middleware/roulettesApiMiddleware.js` para o projeto da API de roletas.

### 3. Adicione o middleware às rotas protegidas

No arquivo de rotas da API de roletas, adicione o middleware:

```javascript
const { protect } = require('../middleware/auth'); // Middleware de autenticação existente
const { checkActiveSubscription } = require('../middleware/roulettesApiMiddleware');

// Rota protegida que exige assinatura ativa
router.get('/api/roulettes', protect, checkActiveSubscription, rouletteController.getRoulettes);
```

### 4. Configure a autenticação para incluir informação de assinatura

No serviço da API de roletas, modifique a geração de tokens para incluir a verificação de assinatura do usuário, ou configure para usar os tokens gerados por este serviço.

## Webhooks do Asaas

Configure os webhooks do Asaas para apontar para:

```
https://seu-servico-de-assinaturas.railway.app/api/webhooks/asaas
```

Eventos recomendados para configurar:
- PAYMENT_RECEIVED
- PAYMENT_CONFIRMED 
- PAYMENT_OVERDUE
- PAYMENT_REFUNDED
- SUBSCRIPTION_ACTIVATED
- SUBSCRIPTION_CANCELED

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar um novo usuário
- `POST /api/auth/login` - Login de usuário
- `GET /api/auth/me` - Obter dados do usuário atual

### Assinaturas
- `POST /api/subscriptions/customer` - Criar cliente no Asaas
- `POST /api/subscriptions` - Criar assinatura
- `GET /api/subscriptions/status` - Obter status da assinatura
- `POST /api/subscriptions/cancel` - Cancelar assinatura

### Webhooks
- `POST /api/webhooks/asaas` - Receber webhooks do Asaas

### Verificação
- `GET /api/verify/subscription/:userId` - Verificar se usuário tem assinatura ativa
- `POST /api/verify/token` - Verificar token JWT com informações de assinatura 