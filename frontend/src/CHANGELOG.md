# Changelog - RunCash v1.1.0

## [1.1.0] - 2023-11-15

### Adicionado
- Implementado novo sistema de diagnóstico da aplicação
  - Componente de modal de diagnóstico para administradores
  - Utilitário para verificar o status de todos os endpoints
  - Ferramenta de diagnóstico acessível pelo console (`__runcashDiagnostico()`)
  - Botão de diagnóstico no menu do usuário para administradores

### Modificado
- Atualizado `GlobalRouletteDataService` para usar os endpoints otimizados
  - Alterado para usar `/api/roulettes-batch` em vez de `/api/ROULETTES`
  - Implementado suporte completo para `/api/roulettes-list` no método `fetchDetailedRouletteData`
  - Exposto o serviço para diagnóstico via propriedade global no window

### Corrigido
- Corrigido problema de múltiplas requisições para o endpoint `/api/ROULETTES`
- Melhorada a detecção e uso de endpoints otimizados no `api/proxy.js`
- Adicionadas mensagens de log mais detalhadas para facilitar o diagnóstico

## Como usar o diagnóstico

### Para administradores:
1. Clique no ícone de perfil no canto superior direito
2. Selecione "Diagnóstico" no menu dropdown
3. O modal mostrará o status de todos os endpoints e serviços

### Para desenvolvedores (via console):
```javascript
// Executar diagnóstico completo
window.__runcashDiagnostico()

// Acessar o serviço de roletas diretamente
window.__globalRouletteService
```

O diagnóstico verifica:
- Status de todos os endpoints da API
- Configurações de ambiente
- Estado dos serviços internos
- Erros encontrados durante a verificação

## Próximos passos
- Implementar monitoramento em tempo real dos endpoints
- Adicionar rastreamento de performance das requisições
- Melhorar a detecção automática de problemas 