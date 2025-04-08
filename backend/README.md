# RunCash - Backend

## Estrutura do Projeto

O backend do RunCash é construído com Node.js, Express e MongoDB. A estrutura do diretório está organizada seguindo os princípios MVC:

```
src/
├── config/          # Configurações do servidor, banco de dados, etc.
├── controllers/     # Controladores para lidar com as requisições
├── middlewares/     # Middlewares para processar requisições
├── models/          # Modelos de dados e acesso ao banco de dados
├── routes/          # Definições de rotas da API
├── services/        # Serviços e lógica de negócios
│   ├── scraper/     # Scripts para coleta de dados das roletas
│   └── websocket/   # Serviço de WebSocket para atualizações em tempo real
└── utils/           # Funções utilitárias
```

## Componentes Principais

### API

A API REST fornece endpoints para:
- Obtenção de dados das roletas
- Autenticação de usuários
- Operações CRUD para estratégias
- Histórico de números

### WebSocket

O serviço de WebSocket oferece:
- Transmissão em tempo real dos números das roletas
- Sistema de pub/sub para atualizações eficientes
- Manutenção de conexões resilientes

### Scraper

O sistema de scraping:
- Coleta dados de roletas de diversos cassinos
- Processa e normaliza os números
- Alimenta o banco de dados e o serviço de WebSocket

## Configuração e Execução

### Instalação

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

### Iniciar Scraper

```bash
npm run scraper
```

### Iniciar WebSocket

```bash
npm run websocket
```

## Dependências Principais

- Node.js
- Express
- MongoDB
- Socket.IO (WebSocket)
- Mongoose (ORM)
- Puppeteer (Scraping)
- JWT (Autenticação)

# RunCash Backend

Este diretório contém dois componentes principais:
1. **API:** Servidor Express.js para servir dados das roletas
2. **Scraper:** Script Python para coletar dados das roletas

## API

A API serve como intermediário entre o frontend e o banco de dados Supabase. Ela fornece endpoints para acessar dados das roletas.

### Endpoints

- `GET /api/roletas` - Obter todas as roletas
- `GET /api/roletas/latest` - Obter números mais recentes de todas as roletas
- `GET /api/roletas/:id` - Obter detalhes de uma roleta específica
- `GET /api/health` - Endpoint de verificação de saúde

### Desenvolvimento Local

```bash
cd api
npm install
npm start
```

### Configuração

Crie um arquivo `.env` no diretório api com:

```
SUPABASE_URL=sua_url_supabase
SUPABASE_KEY=sua_chave_supabase
PORT=3001
```

## Scraper

O scraper coleta dados de roletas online e os armazena no Supabase.

### Execução Local

```bash
cd scraper
pip install -r requirements.txt
python app.py
```

### Configuração

Crie um arquivo `.env` no diretório scraper com:

```
SUPABASE_URL=sua_url_supabase
SUPABASE_KEY=sua_chave_supabase
SCRAPE_INTERVAL_MINUTES=5
ALLOWED_ROULETTES=2010016,2380335,2010065,2010096,2010017,2010098
```

### Estrutura do Scraper

```
scraper/
├── app.py              # Script principal
├── config.py           # Configurações e constantes
├── strategy_analyzer.py # Análise de estratégias
└── ...
```

## Pagamentos (API)

Os endpoints de pagamento estão localizados em `api/payment/` e integram-se com:

- Stripe para pagamentos internacionais
- Asaas para pagamentos brasileiros

### Endpoints de Pagamento

- `/api/payment/create-checkout-session` - Criar sessão de checkout
- `/api/payment/webhook` - Webhook para notificações de pagamento

Consulte a documentação em `docs/STRIPE_SETUP.md` e `docs/API_KEYS.md` para detalhes de configuração.

## Estrutura de Diretórios

```
backend/
├── api/                # API Express.js
│   ├── payment/        # Endpoints de processamento de pagamento
│   └── ...
├── scraper/            # Scraper Python
└── ...
``` 