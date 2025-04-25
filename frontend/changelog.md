# Changelog (Registro de Alterações)

## v1.2.3 (26/04/2023)

### Corrigido
- Painel lateral (sidepanel) que havia desaparecido após a remoção do componente `PlanProtectedFeature` do `RouletteCard` foi restaurado.
- Corrigido problema de opacidade no layout principal que afetava a visibilidade do painel lateral.
- Removida a dependência de opacidade condicional na div do layout principal.
- Problema de compilação relacionado à importação de `../../utils/auth` no `rouletteRepository.js`.

### Adicionado
- Documentação para bugs conhecidos e suas soluções.
- Novo endpoint para obter dados de roletas devido a API indisponível.

### Alterado
- Configuração da URL da API para usar um endpoint que está disponível.
- Modificação do método `fetchBasicRouletteInfo` e `fetchAllRoulettesWithNumbers` para usar o endpoint `/roulettes`.

### Detalhes Técnicos
- Arquivo alterado: `frontend/src/pages/Index.tsx` - Removida a classe `opacity-60` que era aplicada condicionalmente.
- Criada documentação em `/docs/bug-fixes.md` detalhando o problema e a solução.
- Atualizado arquivo `config/index.ts` para usar URL de API funcionando.

### Próximos Passos
- Refatorar a lógica de mostrar/esconder elementos com base no status do plano para usar um sistema mais robusto.
- Implementar verificação de conectividade com a API principal e fallback automático.
- Melhorar a documentação das dependências entre componentes visuais.

## [Correção de Endpoints API] - 2023-12

### Corrigido
- Problema com endpoints inacessíveis: modificados os métodos `fetchBasicRouletteInfo` e `fetchAllRoulettesWithNumbers` para usar o endpoint `/roulettes` que está funcionando, em vez dos endpoints que retornam erro 404.
- Atualizada a URL base da API no arquivo `config/index.ts` para usar a URL correta do backend.

### Adicionado
- Documentação de endpoints da API em `docs/api-endpoints.md` listando todos os endpoints disponíveis, seu status atual e soluções de contorno.
- URL alternativa de fallback para a API caso a principal falhe.

### Alterado
- Implementada transformação de dados nos métodos de busca para garantir compatibilidade com o formato esperado pelas outras partes da aplicação.

## [Correção] - 2023-12

### Corrigido
- Painel lateral (sidepanel) que havia desaparecido após a remoção do componente `PlanProtectedFeature` do `RouletteCard` foi restaurado.
- Corrigido problema de opacidade no layout principal que afetava a visibilidade do painel lateral.
- Removida a dependência de opacidade condicional na div do layout principal.

### Adicionado
- Arquivo `utils/auth.ts` contendo a função `getAuthToken` para centralizar a obtenção do token de autenticação.
- Interface `RouletteRepositoryInterface` agora inclui explicitamente o método `fetchBasicRouletteInfo`.

### Alterado
- Modificada a renderização do painel lateral no `Index.tsx` para não depender mais da verificação de plano ativo, garantindo que o sidepanel sempre será exibido quando uma roleta estiver selecionada.
- Importação de `RouletteRepositoryInterface` no `Index.tsx` para resolver problemas de tipagem.
- Uso de `@ts-ignore` para ignorar temporariamente o erro de tipagem relacionado ao `fetchBasicRouletteInfo` no `RouletteRepository`. 