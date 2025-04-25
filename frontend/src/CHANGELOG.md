# Changelog - RunCash v1.1.0

## [1.1.3] - 2023-11-18

### Melhorado
- Implementado mecanismo de fallback inteligente para endpoints:
  - Tenta primeiro usar o endpoint otimizado `/api/roulettes-batch`
  - Se falhar, usa automaticamente o endpoint legado `/api/ROULETTES`
  - Adiciona logs detalhados sobre qual endpoint está sendo usado
  - Suporte para transição gradual para endpoints otimizados
  
### Adicionado
- Novas ferramentas de diagnóstico disponíveis via console:
  - `window.__runcashVerificarEndpoint()` - Verifica qual endpoint está sendo usado
  - `window.__runcashForceUpdate()` - Força atualização imediata dos dados
  - Relatórios detalhados com informações de performance

### Corrigido
- Resolvido problema de falha na busca de dados quando o endpoint otimizado não está disponível
- Melhorada resiliência do sistema contra problemas de conectividade

## [1.1.2] - 2023-11-17

### Otimizado
- Aplicadas melhorias inspiradas na análise de concorrentes:
  - Reduzido o limite de dados de `1000` para `800` itens por requisição
  - Adicionado parâmetro de timestamp `t={timestamp}` para melhorar o cache e evitar requisições duplicadas
  - Adicionado parâmetro `subject=filter` para identificação do tipo de requisição
  - Atualizada a documentação de diagnóstico para refletir as mudanças

### Benefícios
- Menor volume de dados transferidos por requisição
- Melhor caching pelo navegador e CDNs
- Formato de requisição mais alinhado com padrões de mercado

## [1.1.1] - 2023-11-16

### Alterado
- Revertido temporariamente o uso do endpoint otimizado `/api/roulettes-batch` para o endpoint padrão `/api/ROULETTES`
  - Os endpoints otimizados estavam retornando erro 404 (Not Found)
  - Esta é uma mudança temporária até que o backend seja atualizado para suportar os endpoints otimizados

### Melhorado
- Adicionado monitoramento do endpoint `/api/health` no diagnóstico
- Melhoradas as mensagens informativas no diagnóstico para indicar o uso temporário do endpoint padrão

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