# Solução para os Cards não exibirem dados SSE (Server-Sent Events)

## Problema

Os cards na aplicação não estavam sendo atualizados com dados provenientes do Server-Sent Events (SSE). A aplicação utilizava um sistema de fallback onde o `SocketService` era apenas uma re-exportação do `RESTSocketService`, perdendo a capacidade de processar eventos em tempo real via SSE.

## Solução

Implementamos uma solução em duas partes:

1. **Modificação do SocketService**:
   - Substituímos a simples re-exportação por uma implementação completa que combina SSE e REST.
   - Implementamos uma classe que utiliza `EventService` para a conexão SSE e mantém o `RESTSocketService` como fallback.
   - Adicionamos sistema de notificação para propagar eventos recebidos via SSE para todos os ouvintes.

2. **Modificação do RouletteCard**:
   - Modificamos o componente RouletteCard para se inscrever tanto no `EventService` quanto no `SocketService`.
   - Implementamos um manipulador de eventos que processa corretamente os dados recebidos via SSE.
   - Adicionamos suporte para formatação de dados SSE no formato esperado pelo processador de dados de roleta.
   - Adicionamos som e efeito visual quando novos números chegam via SSE.

## Principais Alterações:

### SocketService.ts
- Criamos uma classe que herda funcionalidades do RESTSocketService e adiciona suporte a SSE.
- Implementamos métodos para se inscrever e processar eventos SSE.
- Adicionamos mecanismo para informar qual método está sendo usado (SSE ou REST).

### RouletteCard.tsx
- Adicionamos importação dinâmica do SocketService e EventService.
- Implementamos manipulador de eventos que reconhece tanto o formato SSE quanto o formato REST.
- Adicionamos processamento de dados SSE para o formato esperado pelo componente.
- Melhoramos o gerenciamento de recursos desinscrevendo-se de eventos quando o componente é desmontado.

## Como Testar

Para verificar se a solução está funcionando:

1. Abra a página principal com os cards de roletas.
2. Abra o console do navegador e procure logs como:
   - `[SocketService] Evento SSE recebido: new_number para roleta X`
   - `[RouletteCard] Atualizando estado com novos dados: Y`
3. Observe se os cards estão sendo atualizados em tempo real sem recarregar a página.
4. Verifique se o card recém atualizado exibe uma animação ou destaque visual.

Com esta implementação, a aplicação agora utiliza uma abordagem híbrida, aproveitando SSE quando disponível e recorrendo à API REST como fallback, garantindo que os usuários vejam dados atualizados em tempo real. 