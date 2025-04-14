# Sistema de Polling Adaptativo do RunCash

Este documento explica o sistema de polling adaptativo implementado no frontend para comunicação eficiente com o servidor WebSocket e otimização do consumo de recursos.

## Visão Geral

O sistema de polling adaptativo foi implementado para melhorar a eficiência na comunicação entre o frontend e o backend, reduzindo o número de requisições desnecessárias e seguindo padrões semelhantes aos usados por sites como GetLiveTable.

### Benefícios

- **Redução de tráfego desnecessário**: Apenas solicita dados quando há alta probabilidade de atualizações disponíveis
- **Economia de recursos do cliente**: Reduz consumo de CPU, bateria e dados móveis
- **Melhor experiência do usuário**: Diminui atualizações visuais desnecessárias na interface
- **Menor carga no servidor**: Reduz o número total de requisições ao backend

## Como Funciona

O sistema implementa um algoritmo adaptativo que ajusta a frequência das requisições com base nos seguintes fatores:

1. **Disponibilidade de dados**: Aumenta a frequência após receber dados reais
2. **Ausência de dados**: Reduz gradualmente a frequência quando não há novos dados
3. **Estado da conexão**: Monitora a qualidade da conexão e ajusta adequadamente
4. **Prioridade da roleta**: Roletas com mais atividade têm polling mais frequente

### Algoritmo de Frequência Adaptativa

```javascript
// Valores de intervalo (em milissegundos)
const minInterval = 5000;  // 5 segundos mínimo
const maxInterval = 30000; // 30 segundos máximo

// Quando recebe dados
if (dadosRecebidos) {
  intervaloAtual = minInterval;
  tentativasSemDados = 0;
}
// Quando não recebe dados
else {
  tentativasSemDados++;
  // Após 3 tentativas sem dados, começar a aumentar o intervalo
  if (tentativasSemDados > 3) {
    // Aumentar em 25% até atingir o máximo
    intervaloAtual = Math.min(intervaloAtual * 1.25, maxInterval);
  }
}
```

## Implementação Técnica

### Componentes Principais

1. **SocketService**: Gerencia a conexão WebSocket e implementa o polling adaptativo
2. **startAggressivePolling()**: Inicia o sistema de polling para uma roleta específica
3. **requestRouletteUpdate()**: Solicita dados específicos com sistema de Promise
4. **processIncomingNumber()**: Filtra e processa dados recebidos, evitando duplicações

### Como o Sistema Evita Atualizações Desnecessárias

1. **Filtragem de dados**: Ignora atualizações que não contêm novos números
2. **Controle de tempo**: Ignora atualizações muito frequentes (menos de 3 segundos)
3. **Verificação de dados existentes**: Compara com os números já conhecidos antes de atualizar
4. **Cache de dados**: Mantém um histórico do que já foi exibido para evitar duplicações

## Exemplo de Fluxo de Dados

1. Usuário acessa a aplicação
2. Frontend inicia com intervalo curto (5s) para obter dados iniciais rapidamente
3. Após receber dados, continua com intervalo curto para obter atualizações em tempo real
4. Se não receber novos dados após algumas tentativas, aumenta gradativamente o intervalo
5. Quando novas atualizações chegam, volta a um intervalo mais curto

## Comparação com Abordagem Anterior

| Aspecto | Sistema Anterior | Sistema Adaptativo |
|---------|------------------|-------------------|
| Frequência | Fixa (2 segundos) | Variável (5-30 segundos) |
| Requisições/hora* | ~1800 | ~240-720 |
| Uso de rede | Alto | Baixo a Moderado |
| Duplicação de dados | Frequente | Rara |
| Experiência do usuário | Muitas atualizações desnecessárias | Apenas atualizações relevantes |

*Estimativa por roleta ativa

## Integrando com Backend

Para que o backend funcione melhor com o sistema adaptativo, recomenda-se:

1. Implementar endpoint `/api/roulette_update/:id` que retorna 204 quando não há atualizações
2. Adicionar headers de cache apropriados nas respostas para auxiliar navegadores
3. Implementar registro de atividade das roletas para melhorar diagnósticos

## Conclusão

O sistema de polling adaptativo representa uma melhoria significativa na eficiência e experiência de usuário do RunCash, reduzindo requisições desnecessárias e otimizando recursos tanto do cliente quanto do servidor. Este padrão segue as melhores práticas de aplicações modernas de tempo real que precisam balancear responsividade com eficiência de recursos. 