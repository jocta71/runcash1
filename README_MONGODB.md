# Otimização do MongoDB para RunCash

Este documento descreve a nova estrutura de coleções do MongoDB otimizada para o RunCash, usando coleções separadas por roleta.

## Visão Geral

Ao invés de armazenar todos os números de roleta em uma única coleção `roleta_numeros`, a nova estrutura utiliza:

1. **Uma coleção para cada roleta**: `roleta_numeros_{ID_DA_ROLETA}`
2. **Uma view unificada**: `roleta_numeros_view` que combina todas as coleções separadas
3. **Compatibilidade com o modo legado**: Fallback para a coleção única se necessário

## Vantagens

- **Melhor performance**: Consultas muito mais rápidas para roletas específicas
- **Índices otimizados**: Cada coleção de roleta tem seus próprios índices
- **Flexibilidade**: Políticas de TTL (time-to-live) diferentes para cada roleta
- **Escalabilidade**: Preparado para crescimento contínuo de dados
- **Compatibilidade**: Mantém suporte ao modo legado

## Estrutura das Coleções

- `roletas`: Informações sobre todas as roletas
- `roleta_numeros_{ID_DA_ROLETA}`: Números para cada roleta específica
- `roleta_numeros_view`: View que unifica todas as coleções de roletas
- `roleta_estatisticas_diarias`: Estatísticas calculadas diariamente
- `roleta_sequencias`: Sequências detectadas nos números

## Migração de Dados

O script `mongo_migration_roletas.py` realiza a migração da estrutura antiga (coleção única) para a nova estrutura (coleções separadas).

### Como executar a migração

```bash
# Modo normal (preserva dados existentes)
python mongo_migration_roletas.py

# Modo forçado (substitui dados em coleções de destino existentes)
python mongo_migration_roletas.py --force
```

### Etapas da Migração

1. **Criação da estrutura**: Cria uma coleção para cada roleta ativa
2. **Migração de dados**: Move os dados da coleção única para as coleções separadas
3. **Criação da view**: Cria a view unificada que combina todas as coleções separadas
4. **Verificação**: Compara contagens para garantir que todos os dados foram migrados
5. **Finalização**: Opção de manter ou excluir a coleção original após confirmação

## Configuração do Scraper

A nova versão do scraper (`data_source_mongo_updated.py`) e da configuração do MongoDB (`mongo_config_updated.py`) suportam ambos os modos:

- Modo de coleções separadas (recomendado)
- Modo legado de coleção única (compatibilidade)

### Como usar no scraper

```python
from data_source_mongo_updated import MongoDataSource

# Modo recomendado: coleções separadas
data_source = MongoDataSource(usar_colecoes_separadas=True)

# Modo legado: coleção única
data_source = MongoDataSource(usar_colecoes_separadas=False)
```

## Verificação de Performance

Após a migração, é recomendável monitorar a performance do sistema para confirmar as melhorias:

1. Tempo de resposta para consultas frequentes
2. Uso de recursos do servidor MongoDB
3. Tempo de inserção de novos números

## Arquivos Relacionados

- `mongo_migration_roletas.py`: Script de migração
- `mongo_config_updated.py`: Versão atualizada da configuração do MongoDB
- `data_source_mongo_updated.py`: Versão atualizada da fonte de dados

## Rollback (se necessário)

Para voltar à estrutura antiga:

1. Mantenha a coleção original durante a migração
2. Use `MongoDataSource(usar_colecoes_separadas=False)` para voltar ao modo legado 