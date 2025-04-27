# Servidor Unificado RunCash

Este documento explica a nova configuração unificada do servidor backend do RunCash.

## Visão Geral

Anteriormente, o sistema utilizava dois serviços separados no Railway:
1. **backendapi-production-36b5.up.railway.app** (root directory: `/backend/api`) - API REST principal
2. **backend-production-2f96.up.railway.app** (root directory: `/backend`) - Servidor WebSocket

A nova configuração unifica esses serviços em um único servidor, permitindo que serviços fora da pasta `/api` sejam utilizados sem a necessidade de manter dois deployments separados.

## Arquitetura

### Estrutura do Servidor Unificado

- **Arquivo Principal**: `backend/index.js`
- **API Principal**: Montada no caminho `/api` 
- **WebSocket**: Integrado como parte do mesmo servidor (opcional)
- **Outros Serviços**: Podem ser adicionados ao servidor unificado

### Principais Componentes

1. **Servidor Express Principal** (`backend/index.js`)
   - Gerencia todas as rotas e serviços
   - Carrega dinamicamente componentes conforme necessário

2. **API REST** (`backend/api/index.js`)
   - Modificada para funcionar como um módulo exportável
   - Montada no caminho `/api` pelo servidor principal

3. **WebSocket** (opcional)
   - Pode ser habilitado/desabilitado via variável de ambiente `ENABLE_WEBSOCKET`
   - Utiliza o mesmo servidor HTTP da API REST

## Configuração no Railway

Para utilizar esta configuração:

1. Configure o serviço no Railway com:
   - **Root Directory**: `/backend`
   - **Comando de Início**: `node index.js` (já configurado no railway.json)

2. Variáveis de Ambiente Importantes:
   - **ENABLE_WEBSOCKET**: Defina como "true" para habilitar o WebSocket (opcional)
   - **GOOGLE_CALLBACK_URL**: Deve ser atualizada para `https://sua-url-do-railway.app/api/auth/google/callback`
   - **GOOGLE_CLIENT_ID**: Necessário para autenticação Google
   - **GOOGLE_CLIENT_SECRET**: Necessário para autenticação Google
   
3. Rotas Disponíveis:
   - `/` - Status do servidor unificado
   - `/api` - Endpoints da API principal
   - `/emit-event` - Endpoint para emissão de eventos WebSocket (se ativado)

## Configuração da Autenticação Google

Após a migração para a estrutura unificada, é necessário atualizar as configurações de autenticação do Google:

1. **No Railway**:
   - Atualize a variável de ambiente `GOOGLE_CALLBACK_URL` para apontar para o novo caminho: 
     `https://sua-url-do-railway.app/api/auth/google/callback`

2. **No Console de API do Google**:
   - Acesse https://console.cloud.google.com/apis/credentials
   - Encontre o projeto RunCash
   - Atualize o "URI de redirecionamento autorizado" para o mesmo URL acima

3. **Compatibilidade**:
   - O servidor unificado já inclui rotas de compatibilidade que redirecionam `/auth/google` para `/api/auth/google`
   - Isso garante que links antigos continuem funcionando sem necessidade de atualizar o frontend

## Benefícios

1. **Simplificação da Infraestrutura**: Um único serviço em vez de dois
2. **Redução de Custos**: Menos instâncias para manter
3. **Flexibilidade**: Facilidade para adicionar novos serviços e funcionalidades
4. **Manutenção Simplificada**: Um único codebase para gerenciar

## Migração do Frontend

O frontend já foi atualizado para usar a abordagem REST em vez de WebSocket, então não são necessárias alterações adicionais no frontend para compatibilidade.

## Monitoramento e Manutenção

Monitore os logs do servidor unificado para garantir que todos os componentes estejam funcionando corretamente. Se ocorrerem problemas:

1. Verifique os logs do Railway
2. Confirme que as rotas da API estão respondendo corretamente
3. Teste os endpoints principais para garantir a funcionalidade

## Próximos Passos Recomendados

1. Elimine o serviço separado de WebSocket quando a nova configuração estiver funcionando corretamente
2. Atualize a documentação de desenvolvimento para refletir a nova arquitetura
3. Considere adicionar mais testes de integração para garantir a robustez do sistema unificado 