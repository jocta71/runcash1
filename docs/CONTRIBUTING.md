# Guia de Contribuição - RunCash

Este documento fornece orientações para contribuir com o projeto RunCash, especialmente para a nova arquitetura de roletas.

## Princípios de Desenvolvimento

1. **Separação de Responsabilidades**: Cada componente deve ter uma função única e específica
2. **Código Limpo**: Escreva código legível, bem documentado e que siga as convenções do projeto
3. **Testabilidade**: Escreva código que possa ser facilmente testado, com componentes isolados
4. **Desempenho**: Considere o desempenho ao implementar novas funcionalidades
5. **Manutenibilidade**: Projete seu código pensando na facilidade de manutenção futura

## Estrutura de Diretórios

Ao adicionar novos arquivos, siga a estrutura de diretórios existente:

```
frontend/src/
├── services/               # Serviços e utilitários
│   ├── api/                # Clientes de API REST
│   ├── socket/             # Cliente de WebSocket
│   ├── data/               # Repositório de dados
│   ├── config/             # Configurações
│   └── ui/components/      # Componentes de UI 
├── hooks/                  # Hooks personalizados React
├── pages/                  # Páginas da aplicação
└── __tests__/              # Testes
```

## Convenções de Código

### Nomenclatura

- **Arquivos**: Use `camelCase` para utilitários e `PascalCase` para componentes React
- **Funções**: Use `camelCase` para funções e métodos
- **Constantes**: Use `UPPER_SNAKE_CASE` para constantes
- **Interfaces e Types**: Use `PascalCase` com prefixo apropriado (ex: `RouletteData`)

### Estilo de Código

- Use TypeScript para todos os novos arquivos
- Documente funções e componentes com comentários JSDoc
- Mantenha arquivos com menos de 300 linhas; divida em módulos menores quando necessário
- Prefira funções puras e componentes funcionais com hooks
- Use async/await para código assíncrono em vez de promises encadeadas

## Testes

- Escreva testes para todas as novas funcionalidades
- Use o padrão AAA (Arrange, Act, Assert) para estruturar seus testes
- Teste casos de borda e condições de erro
- Mantenha os testes focados e isolados

## Processo de Pull Request

1. Crie uma branch a partir de `main` usando o padrão `feature/nome-da-feature` ou `fix/nome-do-bug`
2. Desenvolva e teste suas alterações
3. Garanta que todos os testes passem
4. Envie um Pull Request para `main` com uma descrição clara das alterações
5. Aguarde a revisão de código

## Guia para Componentes de UI

Ao criar novos componentes de UI, siga estas práticas:

1. Crie o componente em `services/ui/components/NomeDoComponente/`
2. Inclua arquivos separados para o componente, seus estilos e testes
3. Crie um arquivo `index.ts` para exportação

Exemplo de estrutura:

```
MeuComponente/
├── MeuComponente.tsx      # Implementação
├── MeuComponente.css      # Estilos
├── MeuComponente.test.tsx # Testes
└── index.ts               # Exportações
```

## Trabalhando com a Arquitetura de Roletas

Para expandir a arquitetura de roletas:

1. **API Clients**: Adicione novos métodos em `services/api/rouletteApi.ts`
2. **Transformadores de Dados**: Amplie `services/data/rouletteTransformer.ts`
3. **Repositório**: Expanda o `RouletteRepository` em `services/data/rouletteRepository.ts`
4. **Componentes de UI**: Crie em `services/ui/components/`
5. **Hooks**: Adicione hooks personalizados em `hooks/`

## Tratamento de Erros

- Use try/catch para operações que podem falhar
- Forneça mensagens de erro descritivas
- Registre erros no console para depuração
- Propague erros para a UI de forma amigável para o usuário

## Guia de Estilo

### CSS

- Use nomes de classes específicos para evitar conflitos (ex: `.roulette-card`)
- Organize as propriedades CSS em grupos lógicos
- Use variáveis CSS para cores, espaçamentos e fontes
- Considere o design responsivo para todas as telas

## Recursos e Documentação

- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Socket.IO Documentation](https://socket.io/docs/v4/) 