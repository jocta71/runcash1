# Fluxo de Pagamento e Assinatura

Este documento descreve o fluxo de pagamento e assinatura implementado na plataforma RunCash.

## Visão Geral

O sistema de pagamentos é integrado com a plataforma Asaas e oferece as seguintes funcionalidades:

1. Visualização de planos disponíveis
2. Seleção e pagamento de assinaturas
3. Gerenciamento de assinaturas existentes
4. Visualização de histórico de pagamentos
5. Cancelamento de assinaturas

## Fluxo de Pagamento

O fluxo de pagamento segue estas etapas:

1. Usuário acessa a página de planos (`/planos`)
2. Seleciona um plano para assinar
3. É redirecionado para a página de pagamento (`/pagamento/:planId`)
4. Escolhe o método de pagamento (PIX, Cartão de Crédito, etc.)
5. Finaliza o pagamento
6. Após confirmação, é redirecionado para `/account`
7. A página `/account` serve como um redirecionador para `/minha-conta/assinatura`
8. Na página de assinatura, o usuário pode ver todos os detalhes da assinatura e pagamentos

## Status de Assinatura

O acesso aos recursos premium, especialmente à API de roletas, é determinado pelo status da assinatura:

1. **ACTIVE**: Assinatura ativa e com pagamentos em dia
2. **RECEIVED**: Pagamento recebido mas ainda em processamento - permite acesso à API de roletas
3. **CONFIRMED**: Pagamento confirmado - permite acesso à API de roletas
4. **OVERDUE**: Pagamento atrasado - acesso restrito
5. **CANCELED**: Assinatura cancelada - acesso negado

Os status RECEIVED, CONFIRMED e ACTIVE são considerados válidos para acesso aos recursos premium, incluindo a API de roletas.

## Estrutura de Arquivos Relevantes

- **`/frontend/src/pages/PlansPage.tsx`**: Exibe os planos disponíveis
- **`/frontend/src/pages/PaymentPage.tsx`**: Processa o pagamento do plano selecionado  
- **`/frontend/src/pages/AccountRedirect.tsx`**: Página de redirecionamento após pagamento
- **`/frontend/src/pages/ProfileSubscription.tsx`**: Exibe detalhes da assinatura e histórico de pagamentos
- **`/frontend/src/context/SubscriptionContext.tsx`**: Gerencia o estado da assinatura do usuário
- **`/frontend/src/components/ProfileDropdown.tsx`**: Exibe um indicador de status de assinatura no menu do usuário

## Redirecionamento Após Pagamento

Para manter compatibilidade com o sistema existente, foi implementado um redirecionamento:

1. Após o pagamento, o sistema redireciona para `/account`
2. A página `AccountRedirect.tsx` é exibida brevemente com uma animação de carregamento
3. Após 1,5 segundos, o usuário é redirecionado para `/minha-conta/assinatura`
4. A página de assinatura exibe todos os detalhes da assinatura ativa e histórico de pagamentos

Este fluxo permite manter códigos de referência existentes em funcionamento sem quebrar a experiência do usuário.

## Feedback Visual para o Usuário

O sistema oferece feedback visual em vários pontos:

1. **No menu de perfil**: Badge indicando o plano atual do usuário
2. **Na página de perfil**: Resumo da assinatura atual
3. **Na página de assinatura**: Detalhes completos, incluindo:
   - Status da assinatura
   - Detalhes do plano
   - Progresso do ciclo atual
   - Próxima data de cobrança
   - Histórico de pagamentos
   - Opções para gerenciar a assinatura

## Webhook e Atualização de Status

O sistema usa webhooks do Asaas para atualizar automaticamente o status da assinatura quando ocorrem eventos:

1. Quando um pagamento é recebido (status RECEIVED), a assinatura é marcada como ACTIVE
2. Quando um pagamento é confirmado (status CONFIRMED), a assinatura é mantida como ACTIVE
3. Os webhooks são processados pelo endpoint `/api/webhook-manager.js`

## Considerações para o Futuro

Possíveis melhorias:

1. Implementar notificações push para lembrar sobre pagamentos próximos
2. Adicionar opções para upgrade/downgrade de planos
3. Implementar um sistema de cupons de desconto
4. Melhorar a visualização de faturas/recibos 