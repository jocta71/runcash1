# Sistema de Estratégias Personalizadas

O sistema de estratégias personalizadas do RunCash permite que cada usuário crie, gerencie e atribua estratégias específicas para diferentes roletas.

## Arquitetura

O sistema é composto pelos seguintes componentes:

1. **API Backend**
   - Modelos para estratégias e associações
   - Endpoints RESTful para CRUD de estratégias
   - Sistema de autenticação para proteção das rotas

2. **Frontend**
   - Página de listagem de estratégias 
   - Formulário para criação e edição
   - Componente de seleção de estratégia nos cards de roletas

3. **Scraper**
   - Processamento das regras de estratégia
   - Aplicação da estratégia selecionada para cada roleta

## Fluxo de Funcionamento

1. O usuário cria uma estratégia ou escolhe uma existente
2. O usuário associa a estratégia a uma roleta específica
3. O scraper processa os dados da roleta usando as regras da estratégia associada
4. Os resultados (estado, terminais, sugestões) são exibidos na interface

## Regras Disponíveis

As estratégias podem usar várias regras de processamento:

- **Detectar Repetições**: Identifica padrões de repetição de números
- **Verificar Paridade**: Analisa sequências de números pares e ímpares
- **Verificar Cores**: Detecta predominância de cores (vermelho/preto)
- **Analisar Dezenas**: Analisa grupos de dezenas (1-12, 13-24, 25-36)
- **Analisar Colunas**: Detecta padrões nas colunas da roleta

## Estratégia do Sistema

Uma estratégia padrão do sistema está disponível mesmo quando o usuário não criou nenhuma estratégia própria. Esta estratégia contém as regras que antes estavam diretamente embutidas no scraper.

## Configuração

Para inicializar a estratégia do sistema:

```
cd backend/api
node scripts/create-system-strategy.js
```

## Resolução de Problemas

Se você encontrar erros relacionados a dependências:

1. Verifique se o mongoose está instalado:
```
npm install mongoose --save
```

2. Certifique-se de que o middleware de autenticação existe:
```
ls backend/api/middleware/auth.js
```

## Próximos Passos

- Implementar teste A/B de estratégias
- Adicionar suporte para compartilhamento de estratégias entre usuários
- Criar visualização de desempenho histórico por estratégia 