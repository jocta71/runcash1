# Correção para Streaming de Eventos (SSE) no RunCash

Este projeto contém uma correção para o problema de Server-Sent Events (SSE) no RunCash, permitindo que a funcionalidade de streaming de dados em tempo real funcione corretamente, similar ao tipminer.com.

## O Problema

O frontend está tentando se conectar ao endpoint `/api/stream/roulettes`, mas está recebendo um erro 404 (Not Found), indicando que a rota não existe ou não está acessível.

## A Solução

Esta correção implementa as seguintes melhorias:

1. Adiciona as rotas SSE diretamente no arquivo principal do servidor
2. Fornece logs detalhados para facilitar a depuração
3. Inclui ambas as rotas necessárias:
   - `/api/stream/roulettes` - Para streaming de todas as roletas
   - `/api/stream/roulettes/:id` - Para streaming de uma roleta específica
4. Implementa eventos em tempo real com MongoDB changeStream
5. Inclui criptografia dos dados com @hapi/iron

## Arquivos da Correção

1. **railway-fix-sse.js** - Script de solução alternativa que pode ser executado independentemente
2. **backend/fix-sse-integration.js** - Módulo para integração com o servidor principal
3. **backend/install-sse-dependencies.js** - Script para instalar dependências
4. **README-FIX-SSE.md** - Este arquivo de documentação

## Instruções de Instalação

### Opção 1: Integração com o Servidor Principal (Recomendado)

1. Copie o arquivo `backend/fix-sse-integration.js` para o diretório `backend/` no Railway
2. Copie o arquivo `backend/install-sse-dependencies.js` para o mesmo diretório
3. Execute o script de instalação de dependências:
   ```
   cd backend
   node install-sse-dependencies.js
   ```
4. Modifique o arquivo `backend/index.js` para incluir o fix-sse-integration:
   ```javascript
   // Adicione após os middlewares básicos e antes de carregar a API
   // Integrar rotas SSE corrigidas
   try {
     console.log('[Server] Tentando carregar rotas SSE corrigidas...');
     const fixSSERouter = require('./fix-sse-integration');
     app.use('/api', fixSSERouter);
     console.log('[Server] Rotas SSE corrigidas carregadas com sucesso em /api');
   } catch (err) {
     console.warn('[Server] Aviso: Rotas SSE corrigidas não disponíveis:', err.message);
   }
   ```
5. Reinicie o servidor no Railway

### Opção 2: Solução Alternativa Standalone

Se a integração com o servidor principal não for possível:

1. Copie o arquivo `railway-fix-sse.js` para a raiz do projeto no Railway
2. Execute o script standalone:
   ```
   node railway-fix-sse.js
   ```
3. Este script irá iniciar um servidor na porta 5002 (ou a porta definida em `process.env.PORT`)
4. Acesse `http://seu-dominio/api-fix/stream/roulettes` para testar
5. Modifique o frontend para usar o novo endpoint `/api-fix/stream/roulettes` em vez de `/api/stream/roulettes`

## Testando a Correção

1. Use a página de teste incluída em:
   - Com a integração principal: `http://seu-dominio/api/teste-sse`
   - Com a solução alternativa: `http://seu-dominio/teste-sse` 

2. Monitoramento via log:
   - Procure por entradas de log começando com `[FIX-SSE]`
   - Estas entradas mostram conexões, desconexões e atualizações de dados

3. Teste no frontend:
   - O componente `LiveRoulettes` deve conseguir se conectar e mostrar dados em tempo real
   - A conexão deve ser mantida ativa com heartbeats a cada 30 segundos
   - A UI deve atualizar automaticamente quando houver alterações nas roletas

## Solução de Problemas

Se ainda encontrar problemas:

1. Verifique os logs do servidor para mensagens de erro
2. Confirme que as dependências foram instaladas corretamente:
   - @hapi/iron
   - express
   - mongodb
3. Verifique se o endpoint está respondendo via curl:
   ```
   curl -N -H "Authorization: Bearer SEU_TOKEN" http://seu-dominio/api/stream/roulettes
   ```
4. Verifique se o MongoDB está configurado corretamente para suportar changeStream (requer uma instância replicaSet)

## Manutenção Futura

Para melhorias futuras, considere:

1. Refatorar o código para seguir o padrão de design do resto da aplicação
2. Adicionar testes automatizados para os endpoints SSE
3. Otimizar o uso de recursos para conexões de longa duração
4. Implementar reconexão automática no lado do cliente

## Suporte

Se precisar de ajuda adicional, entre em contato com a equipe de desenvolvimento. 