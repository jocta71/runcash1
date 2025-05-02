# Sistema de Fallback para API

## Visão Geral

Este documento descreve o sistema de fallback implementado para garantir que a aplicação RunCash continue funcionando mesmo quando o backend principal estiver indisponível. O sistema foi projetado para fornecer uma experiência de usuário contínua, permitindo:

1. Visualização de planos de assinatura
2. Simulação de checkout e pagamento
3. Verificação de status de assinatura
4. Acesso a recursos básicos da aplicação

## Componentes Principais

### 1. Página de Planos (`pages/planos.js`)

A página de planos foi melhorada para:
- Detectar automaticamente a disponibilidade da API
- Alternar entre dados da API real e dados locais de fallback
- Exibir um indicador de "Modo de Simulação" quando a API estiver offline
- Redirecionar para a simulação de checkout quando necessário

### 2. Banner de Status da API (`components/ApiStatusBanner.jsx`)

Um componente que:
- Verifica a disponibilidade de vários endpoints da API
- Exibe um banner informativo quando a API está indisponível
- Oferece opções para verificar novamente ou recarregar a página
- Adapta a aparência com base no nível de indisponibilidade (completa ou parcial)

### 3. API de Fallback de Subscrição (`pages/api/subscription/fallback.js`)

Um endpoint local que:
- Fornece dados simulados de planos
- Verifica status de assinatura
- Responde a verificações de disponibilidade
- Simula históricos de assinatura

### 4. API de Fallback de Checkout (`pages/api/checkout/fallback.js`)

Um endpoint local que:
- Simula a criação de checkouts
- Gera URLs para o processo de simulação
- Valida dados da requisição

### 5. Página de Simulação de Checkout (`pages/api/checkout/simulation.js`)

Uma página HTML interativa que:
- Simula uma experiência de checkout completa
- Exibe detalhes do plano selecionado
- Oferece opções de método de pagamento
- Simula um processo de pagamento bem-sucedido
- Redireciona de volta para a página de planos após a conclusão

## Como Funciona

1. **Verificação de Disponibilidade**: Ao carregar a página de planos, o sistema tenta acessar vários endpoints para verificar se o backend está disponível.

2. **Detecção de Modo**: Com base nos resultados, o sistema determina um dos três modos:
   - **Normal**: Backend totalmente funcional
   - **Fallback**: Backend parcialmente funcional (alguns endpoints respondendo)
   - **Simulação**: Backend completamente indisponível

3. **Adaptação da Interface**: A UI se adapta mostrando indicadores apropriados e alterando textos dos botões.

4. **Fluxo de Checkout**:
   - No modo Normal: Redirecionamento para o Asaas
   - Nos modos Fallback/Simulação: Redirecionamento para a página de simulação interna

## Benefícios

1. **Continuidade de Serviço**: Os usuários podem continuar explorando planos mesmo durante interrupções do backend.

2. **Transparência**: Banners informativos mantêm os usuários informados sobre o status atual.

3. **Demonstração de Recursos**: Novos usuários ainda podem experimentar o fluxo completo de checkout.

4. **Minimização de Erros**: Ao invés de exibir mensagens de erro técnicas, o sistema fornece uma experiência degradada mas funcional.

## Limitações

1. Dados estáticos: Os dados são pré-definidos e não refletem informações atualizadas.

2. Sem processamento real: Pagamentos não são realmente processados no modo de simulação.

3. Sem persistência: As "assinaturas" simuladas não são salvas entre sessões.

## Melhorias Futuras

1. Implementar sincronização offline para manter dados mais recentes localmente.

2. Adicionar mais simulações de funcionalidades da API.

3. Melhorar a detecção de quais partes específicas do backend estão indisponíveis. 