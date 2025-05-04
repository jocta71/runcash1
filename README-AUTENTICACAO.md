# RunCash - Testes de Autenticação

Este repositório contém ferramentas e scripts para testar a implementação de autenticação JWT do RunCash, tanto para a API REST quanto para o serviço WebSocket.

## Problema Corrigido

Foi identificada uma vulnerabilidade crítica onde vários endpoints, incluindo o serviço WebSocket, permitiam acesso sem autenticação JWT adequada. Implementamos uma solução abrangente com múltiplas camadas de segurança para garantir que todos os recursos sensíveis exijam autenticação adequada.

## Arquivos Incluídos

1. **websocket-test-authenticated.html**
   - Cliente WebSocket HTML para testar a conexão autenticada
   - Interface gráfica completa com suporte a múltiplos métodos de autenticação
   - Logs detalhados para debug e monitoramento

2. **test-authentication.js**
   - Script Node.js para testar a autenticação dos endpoints REST
   - Verifica se os endpoints rejeitam requisições sem token
   - Verifica se os endpoints rejeitam tokens inválidos

3. **docs/autenticacao_seguranca.md**
   - Documentação detalhada sobre as melhorias de segurança
   - Explicação da implementação JWT
   - Recomendações para manutenção e monitoramento

## Como Testar

### Pré-requisitos

```
Node.js 14+ instalado
npm instalado
```

### Instalação

```bash
# Instalar dependências
npm install
```

### Testar Endpoints REST

```bash
# Executar teste de autenticação em todos os endpoints
npm run test-auth
```

### Testar WebSocket Autenticado

```bash
# Iniciar servidor HTTP local com o cliente WebSocket
npm run test-websocket

# Alternativa: abrir o arquivo diretamente no navegador
# Abra o arquivo websocket-test-authenticated.html em seu navegador
```

## Resultados Esperados

### API REST

Todos os endpoints devem retornar:
- Código 401 Unauthorized quando requisições são feitas sem token
- Código 401 Unauthorized quando requisições são feitas com token inválido
- Log detalhado no console indicando a falha de autenticação

### WebSocket

- Tentativa de conexão sem token: Conexão recusada com erro de autenticação
- Tentativa de conexão com token inválido: Conexão recusada com erro de autenticação
- Tentativa de conexão com token válido: Conexão estabelecida com sucesso

## Estrutura de Segurança Implementada

### WebSocket

1. **Middleware Global**
   - Verificação inicial de token JWT em todas as conexões
   - Bloqueio imediato de conexões não autenticadas
   
2. **Verificação por Evento**
   - Cada evento WebSocket verifica a autenticação
   - Impede uso não autorizado mesmo se o middleware falhar

### API REST

1. **Middleware de Endpoint**
   - Verificação direta no nível de rota
   - Validação de token JWT antes de qualquer processamento

2. **Middleware Secundário**
   - Verificação de token e assinatura
   - Validação de permissões de usuário

3. **Handler de Rota Protegido**
   - Verificação adicional de usuário e assinatura
   - Garantia de múltiplas camadas de proteção

## Manutenção e Monitoramento

- Verifique regularmente os logs do servidor para tentativas de acesso não autorizado
- Execute os scripts de teste periodicamente para garantir que a autenticação continue funcionando
- Mantenha as dependências atualizadas, especialmente as relacionadas à segurança

## Contato

Para questões relacionadas à segurança, entre em contato com a equipe de segurança do RunCash.

---

*Este documento é parte da documentação de segurança do RunCash. Não compartilhe publicamente.* 