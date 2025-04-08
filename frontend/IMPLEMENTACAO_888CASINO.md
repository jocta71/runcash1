# Implementação de Polling baseado no 888casino

Este documento explica como a integração com dados de roletas foi implementada inspirada no site 888casino.

## Visão Geral

O sistema de aquisição de dados de roletas do 888casino foi analisado, e identificamos que eles usam um sistema de polling com as seguintes características:

1. **Intervalo de polling**: Exatamente 11 segundos (11000ms)
2. **Endpoints utilizados**:
   - `https://cgp.safe-iplay.com/cgpapi/riverFeed/GetLiveTables` - Para dados das mesas de roleta
   - `https://casino-orbit-feeds-cdn.888casino.com/api/jackpotFeeds/v1/BRL` - Para dados de jackpots

3. **Formato da requisição**:
   - Método: POST
   - Content-Type: application/x-www-form-urlencoded
   - Parâmetros: regulationID, lang, clientProperties, etc.

4. **Detecção de novos números**:
   - Comparação entre o estado anterior e o novo estado
   - Verificação específica se o primeiro número (mais recente) é diferente

## Componentes Implementados

### 1. Atualização do RouletteFeedService

O serviço `RouletteFeedService.ts` existente foi atualizado para:
- Usar o intervalo exato de 11 segundos para polling
- Implementar a lógica exata de detecção de novos números do 888casino
- Armazenar dados adicionais sobre as roletas (dealer, status, etc.)

### 2. CasinoAPIAdapter

O `CasinoAPIAdapter.ts` foi implementado para fazer chamadas diretas ao 888casino:
- Chamadas POST para o endpoint GetLiveTables
- Extração e processamento dos dados de roletas
- Sistema de eventos para notificar a interface sobre novos números

### 3. Componente de Interface Casino888RouletteDisplay

Componente React criado para exibir as roletas do 888casino com:
- Grid responsivo para mostrar múltiplas roletas
- Exibição dos últimos números de cada roleta
- Status da mesa (aberta/fechada) e informações do dealer

### 4. Integração na LiveRoulettePage

A página de roletas ao vivo foi atualizada para:
- Incluir o componente Casino888RouletteDisplay como uma seção adicional
- Permitir mostrar/ocultar os dados do 888casino
- Inicializar o CasinoAPIAdapter conforme necessário

## Inicialização do Sistema

Em `main.tsx`:
- Inicialização do RouletteFeedService com o intervalo correto
- Configuração do CasinoAPIAdapter (desabilitado por padrão)
- Integração com o SocketService existente

## Funcionamento

1. O RouletteFeedService realiza polling da API interna a cada 11 segundos
2. Quando a página de roletas ao vivo é acessada, o CasinoAPIAdapter é habilitado se necessário
3. O CasinoAPIAdapter faz polling direto dos endpoints do 888casino para obter dados em tempo real
4. Os componentes de interface são atualizados quando novos números são detectados

## Considerações de Performance

- O intervalo de 11 segundos foi escolhido para corresponder exatamente ao do 888casino
- O sistema implementado evita atualizações desnecessárias verificando se há novos números
- Apenas as roletas são atualizadas quando novos dados chegam, não a página inteira

## Possíveis Melhorias Futuras

1. Proxy para dados do 888casino no backend para evitar problemas de CORS
2. Extração mais precisa dos números de roletas quando a estrutura de dados for melhor compreendida
3. Sistema de cache para reduzir chamadas redundantes
4. Modo offline para continuar exibindo os últimos dados conhecidos em caso de falha na rede 