# Changelog

## [Correção] - 2023-12

### Corrigido
- Painel lateral (sidepanel) que havia desaparecido após a remoção do componente `PlanProtectedFeature` do `RouletteCard`.
- Problema de compilação relacionado à importação de `../../utils/auth` no `rouletteRepository.js`.

### Adicionado
- Arquivo `utils/auth.ts` contendo a função `getAuthToken` para centralizar a obtenção do token de autenticação.
- Interface `RouletteRepositoryInterface` agora inclui explicitamente o método `fetchBasicRouletteInfo`.

### Alterado
- Modificada a renderização do painel lateral no `Index.tsx` para não depender mais da verificação de plano ativo, garantindo que o sidepanel sempre será exibido quando uma roleta estiver selecionada.
- Importação de `RouletteRepositoryInterface` no `Index.tsx` para resolver problemas de tipagem.
- Uso de `@ts-ignore` para ignorar temporariamente o erro de tipagem relacionado ao `fetchBasicRouletteInfo` no `RouletteRepository`. 