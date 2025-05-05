# Sistema de Server-Sent Events para Roleta

Este projeto demonstra como implementar um sistema de Server-Sent Events (SSE) para transmitir dados de roleta em tempo real, similar ao observado no tipminer.com.

## O que é SSE (Server-Sent Events)?

Server-Sent Events é uma tecnologia que permite ao servidor enviar atualizações ao navegador do cliente sem que este precise solicitar explicitamente. Isso cria um canal de comunicação unidirecional onde o servidor pode "empurrar" dados para o cliente sempre que houver informações novas disponíveis.

Diferente do WebSocket, o SSE:
- É unidirecional (servidor → cliente)
- Usa o protocolo HTTP padrão
- Tem reconexão automática
- É mais simples de implementar

## Estrutura do Projeto

O projeto consiste em dois componentes principais:

1. **Servidor SSE para Roleta** (`server-sent-events-roleta.js`):
   - Implementa um servidor Express.js
   - Fornece autenticação via JWT
   - Estabelece conexões SSE com clientes
   - Envia atualizações em tempo real sobre números da roleta
   - Codifica dados em formato similar ao observado no tipminer.com

2. **Cliente SSE para Roleta** (`cliente-sse-roleta.html`):
   - Interface web para conexão com o servidor SSE
   - Implementa autenticação e gerenciamento de tokens
   - Exibe os números recebidos em tempo real
   - Decodifica as mensagens recebidas

## Requisitos

- Node.js 14.x ou superior
- MongoDB (opcional, para armazenamento persistente)
- NPM ou Yarn

## Dependências

```bash
npm install express mongodb cors jsonwebtoken dotenv
```

## Configuração

1. Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/roleta_db
JWT_SECRET=sua_chave_secreta_muito_segura
POLL_INTERVAL=2000
```

## Executando o Servidor

```bash
node server-sent-events-roleta.js
```

## Usando o Cliente

1. Abra o arquivo `cliente-sse-roleta.html` em um navegador moderno
2. Preencha as credenciais (padrão: admin/password)
3. Clique em "Fazer Login" para obter um token
4. Clique em "Conectar ao Stream" para iniciar a recepção de dados

## Como Funciona

### Fluxo de Dados

1. O servidor Express inicia e conecta ao MongoDB
2. Um cliente faz login e recebe um token JWT
3. O cliente estabelece uma conexão SSE com o servidor
4. O servidor envia eventos codificados para o cliente quando novos números são gerados
5. O cliente decodifica os eventos e exibe os números da roleta

### Formato dos Dados

Os dados são codificados de forma similar ao observado no tipminer.com:

1. Dados são convertidos para JSON
2. São adicionados campos extras com timestamp e valores aleatórios para entropia
3. O JSON é codificado em Base64
4. Os dados são enviados como eventos SSE

Exemplo de resposta do servidor:
```
event: update
id: 1
data: eyJyb2xldGFfaWQiOiI2NTgyZjY1MDc2Y2ZiZGY2YjUxOTFkN2YiLCJudW1lcm8iOjE1LCJjb3IiOiJwcmV0byIsInRpbWVzdGFtcCI6IjIwMjQtMDUtMDVUMDI6MzA6MDAuMDAwWiIsIl90IjoxNzE2NzEyMjAwMDAwLCJfciI6ImFiY2RlZjEyMzQ1NiJ9
```

## Segurança

O sistema implementa várias camadas de segurança:

1. Autenticação via JWT para todas as requisições
2. Codificação dos dados transmitidos
3. Validação de origem das requisições via CORS
4. Proteção contra acessos não autorizados aos endpoints

## Personalização

Você pode personalizar o sistema para atender às suas necessidades:

- Altere a fonte de dados para usar um banco diferente de MongoDB
- Modifique o intervalo de polling para controlar a frequência de atualizações
- Implemente um sistema real de extração de dados (scraper) para obter números reais de roletas online
- Adicione análise estatística dos números para identificar padrões

## Comparação com o Sistema do tipminer.com

A implementação do tipminer.com parece usar:

1. Server-Sent Events para transmissão contínua de dados
2. Dados codificados em formato Base64 
3. Autenticação baseada em tokens
4. Números transmitidos com metadados (cor, timestamp)

Nossa implementação replica essas características principais, permitindo um sistema similar de transmissão em tempo real.

## Aviso Legal

Este projeto é apenas para fins educacionais. Certifique-se de cumprir os termos de serviço de quaisquer plataformas com as quais interagir. Gambling online pode estar sujeito a restrições legais em muitas jurisdições.

## Recursos Adicionais

- [Documentação sobre Server-Sent Events (MDN)](https://developer.mozilla.org/pt-BR/docs/Web/API/Server-sent_events)
- [Autenticação JWT](https://jwt.io/introduction)
- [EventSource API](https://developer.mozilla.org/pt-BR/docs/Web/API/EventSource) 